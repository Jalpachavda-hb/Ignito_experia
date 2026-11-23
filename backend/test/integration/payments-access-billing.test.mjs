/**
 * Integration tests against the isolated MySQL schema vlab_access_test (strict SQL mode, like
 * live MySQL 8). Razorpay HTTP calls are answered by an in-process axios adapter; nothing leaves
 * this machine. The lab catalog is read (SELECT only) from ignito_experia_owner.labs.
 * University course codes are injected (resolveCourseCodes) because the live LMS needs real
 * student credentials; that stub exists only here and is not evidence of the LMS integration.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { prepareTestSchema, makePoolStrict, testConnection } from "../helpers/testDb.mjs";

const SCHEMA = "vlab_access_test";
await prepareTestSchema(SCHEMA);
process.env.RAZORPAY_KEY_ID = "rzp_test_unit";
process.env.RAZORPAY_KEY_SECRET = "unit_secret_value";
process.env.RAZORPAY_WEBHOOK_SECRET = "unit_webhook_secret";
process.env.REDIS_URL = "redis://127.0.0.1:1";
process.env.REDIS_RETRY_AFTER_MS = "600000";

const { default: pool } = await import("../../lib/mysql.js");
makePoolStrict(pool);
const { default: axios } = await import("axios");
const { labTokenCheckoutService } = await import("../../services/LabTokenCheckoutService.js");
const { paymentSettlementService } = await import("../../services/PaymentSettlementService.js");
const { tokenOrderRepository, resetTokenOrderSchemaCache } = await import("../../repositories/TokenOrderRepository.js");
const { tokenOrderWebhookHandler } = await import("../../handlers/tokenOrders.js");
const { purchaseCreditsHandler } = await import("../../handlers/credits.js");
const { studentLabAccessService, invalidateStudentLabAccess, loadLabCatalog } = await import("../../services/StudentLabAccessService.js");
const { usageBillingService } = await import("../../services/UsageBillingService.js");

// ---- Razorpay fake (server side of api.razorpay.com) ----
const razorpayOrders = new Map();
const razorpayPayments = new Map();
axios.defaults.adapter = async (config) => {
  const url = String(config.url);
  if (config.method === "post" && url.endsWith("/v1/orders")) {
    const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    const id = `order_${crypto.randomBytes(6).toString("hex")}`;
    const order = { id, amount: body.amount, currency: "INR", status: "created", notes: body.notes };
    razorpayOrders.set(id, order);
    return { data: order, status: 200, statusText: "OK", headers: {}, config };
  }
  const m = /\/v1\/payments\/([^/?]+)/.exec(url);
  if (config.method === "get" && m) {
    const payment = razorpayPayments.get(decodeURIComponent(m[1]));
    if (!payment) {
      const err = new Error("not found");
      err.response = { status: 404, data: { error: { description: "Payment not found" } } };
      throw err;
    }
    return { data: payment, status: 200, statusText: "OK", headers: {}, config };
  }
  throw new Error(`Unexpected Razorpay call ${config.method} ${url}`);
};
function pay(orderId, amount = razorpayOrders.get(orderId).amount, status = "captured") {
  const id = `pay_${crypto.randomBytes(6).toString("hex")}`;
  razorpayPayments.set(id, { id, order_id: orderId, amount, status });
  const signature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${id}`).digest("hex");
  return { paymentId: id, signature };
}

let db;
const A = { userId: 101, email: "student.a@uni.test", tenantId: "TEN_A", role: "Student" };
const B = { userId: 102, email: "student.b@uni.test", tenantId: "TEN_A", role: "Student" };
const D = { userId: 103, email: "direct.d@mail.test", tenantId: "PLATFORM", role: "Student" };

before(async () => {
  db = await testConnection(SCHEMA);
  await db.query(
    `INSERT INTO tenants (TenantId, Name, Slug, Status) VALUES ('TEN_A','Uni A','unia','ACTIVE'), ('TEN_B','Uni B','unib','ACTIVE')`
  );
  await db.query(
    `INSERT INTO Users (UserId, FullName, Email, Role, Status, CreatedFrom, AuthType, TenantId, ExternalStudentId, StudentId) VALUES
     (101,'Student A','student.a@uni.test','Student','Active','LMS','LMS','TEN_A','5001','5001'),
     (102,'Student B','student.b@uni.test','Student','Active','LMS','LMS','TEN_A','5002','5002'),
     (103,'Direct D','direct.d@mail.test','Student','Active','DIRECT','DIRECT','PLATFORM',NULL,NULL)`
  );
  await db.query(
    `INSERT INTO course_lab_mappings (tenant_id, program_id, semester_id, course_code, lab_id, status, practical_credit) VALUES
     ('TEN_A','2','1','MC01094011','dotnet-lab','active',80),
     ('PLATFORM','2','1','MC01094031','dbms-lab','active',90),
     ('TEN_B','2','1','MC01094011','java-lab','active',60),
     ('TEN_A','2','1','OLDCOURSE','linux-lab','inactive',60)`
  );
  const now = new Date();
  await db.query(
    `INSERT INTO lab_sessions (SessionId, TenantId, UserId, LabId, StartedAt, ExpiresAt, Status, LowTokenWarningSent)
     VALUES ('sess-running-a','TEN_A',101,'java-lab',?,?, 'RUNNING', 1)`,
    [now, new Date(now.getTime() + 3600e3)]
  );
});

after(async () => {
  await db?.end();
  await pool.end();
});

test("strict mode is active for the app pool (like live MySQL 8)", async () => {
  const [[row]] = await pool.query("SELECT @@SESSION.sql_mode AS m");
  assert.match(row.m, /STRICT_TRANS_TABLES/);
});

test("old settlement statement fails on the real schema (root cause of the rollback)", async () => {
  await assert.rejects(
    pool.query("UPDATE lab_sessions SET LowTokenWarningSent = 0 WHERE TenantId = ? AND StudentId = ? AND LabId = ? AND Status = 'RUNNING'", ["TEN_A", "101", "java-lab"]),
    (err) => err.code === "ER_BAD_FIELD_ERROR"
  );
});

let orderA;
test("checkout creates a server-priced order the database accepts in strict mode", async () => {
  resetTokenOrderSchemaCache();
  orderA = await labTokenCheckoutService.createOrder({
    auth: { ...A },
    items: [{ labId: "java-lab", tokens: 120, amountRupees: 1 }], // browser amount ignored
  });
  const catalog = await loadLabCatalog({ force: true });
  const java = catalog.find((l) => l.LabCode === "java-lab");
  const expected = Math.round(120 * (Number(java.BaseTokenPrice) / 60));
  assert.equal(orderA.amountInRupees, expected);
  assert.equal(orderA.amount, expected * 100);
  const [[row]] = await db.query("SELECT Status, TotalAmount, StudentId, TenantId FROM token_orders WHERE RazorpayOrderId = ?", [orderA.orderId]);
  assert.notEqual(row.Status, "", "a real ENUM value, not the empty string non-strict MariaDB wrote");
  assert.equal(Number(row.TotalAmount), expected);
  assert.equal(row.StudentId, "101");
  assert.equal(row.TenantId, "TEN_A");
  const [[item]] = await db.query("SELECT TokenQuantity, TokenAmount, UnitPrice, TotalAmount FROM token_order_items WHERE OrderId = ?", [orderA.orderRecordId]);
  assert.equal(item.TokenQuantity, 120);
  assert.equal(item.TokenAmount, 120, "legacy NOT NULL column filled");
});

test("another student cannot settle this order", async () => {
  const { paymentId, signature } = pay(orderA.orderId);
  await assert.rejects(
    labTokenCheckoutService.verify({ auth: { ...B }, razorpayOrderId: orderA.orderId, razorpayPaymentId: paymentId, razorpaySignature: signature }),
    { statusCode: 403 }
  );
  const [w] = await db.query("SELECT * FROM student_lab_token_wallets WHERE StudentId IN ('101','102')");
  assert.equal(w.length, 0, "no tokens credited to anyone");
});

test("forged signature is rejected", async () => {
  const other = await labTokenCheckoutService.createOrder({ auth: { ...A }, items: [{ labId: "dbms-lab", tokens: 60 }] });
  const { paymentId } = pay(other.orderId);
  await assert.rejects(
    labTokenCheckoutService.verify({ auth: { ...A }, razorpayOrderId: other.orderId, razorpayPaymentId: paymentId, razorpaySignature: "00".repeat(32) }),
    { statusCode: 400 }
  );
});

test("payment for a different amount is rejected", async () => {
  const other = await labTokenCheckoutService.createOrder({ auth: { ...A }, items: [{ labId: "dbms-lab", tokens: 60 }] });
  const { paymentId, signature } = pay(other.orderId, 100); // paid ₹1
  await assert.rejects(
    labTokenCheckoutService.verify({ auth: { ...A }, razorpayOrderId: other.orderId, razorpayPaymentId: paymentId, razorpaySignature: signature }),
    { statusCode: 400 }
  );
});

test("valid payment credits the purchased lab's wallet exactly once (settlement no longer rolls back)", async () => {
  const { paymentId, signature } = pay(orderA.orderId);
  const res = await labTokenCheckoutService.verify({ auth: { ...A }, razorpayOrderId: orderA.orderId, razorpayPaymentId: paymentId, razorpaySignature: signature });
  assert.equal(res.verified, true);
  assert.equal(res.creditsAdded, 120);

  const [wallets] = await db.query("SELECT LabId, TotalPurchasedTokens, RemainingTokens FROM student_lab_token_wallets WHERE StudentId = '101'");
  assert.equal(wallets.length, 1);
  assert.equal(wallets[0].LabId, "java");
  assert.equal(Number(wallets[0].TotalPurchasedTokens), 120);

  const [[order]] = await db.query("SELECT Status, CreditedAt, RazorpayPaymentId FROM token_orders WHERE RazorpayOrderId = ?", [orderA.orderId]);
  assert.ok(order.CreditedAt);
  assert.equal(order.RazorpayPaymentId, paymentId);

  const [ledger] = await db.query("SELECT TransactionType, Tokens, ReferenceType FROM student_lab_token_transactions WHERE StudentId = '101'");
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].TransactionType, "PURCHASE");

  const [[sess]] = await db.query("SELECT LowTokenWarningSent FROM lab_sessions WHERE SessionId = 'sess-running-a'");
  assert.equal(Number(sess.LowTokenWarningSent), 0, "running session's low-token flag reset");

  const again = await labTokenCheckoutService.verify({ auth: { ...A }, razorpayOrderId: orderA.orderId, razorpayPaymentId: paymentId, razorpaySignature: signature });
  assert.equal(again.alreadyProcessed, true);
  const [[w2]] = await db.query("SELECT TotalPurchasedTokens FROM student_lab_token_wallets WHERE StudentId = '101'");
  assert.equal(Number(w2.TotalPurchasedTokens), 120, "no double credit");
});

test("webhook: valid HMAC settles once, bad HMAC is refused", async () => {
  const order = await labTokenCheckoutService.createOrder({ auth: { ...D }, items: [{ labId: "postgres", tokens: 60 }] });
  const { paymentId } = pay(order.orderId);
  const body = { event: "payment.captured", payload: { payment: { entity: { id: paymentId, order_id: order.orderId } } } };
  const raw = Buffer.from(JSON.stringify(body));
  const sig = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex");

  const bad = await tokenOrderWebhookHandler({ body, headers: { "x-razorpay-signature": "deadbeef" }, raw: { rawBody: raw } });
  assert.equal(bad.statusCode, 401);

  const good = await tokenOrderWebhookHandler({ body, headers: { "x-razorpay-signature": sig }, raw: { rawBody: raw } });
  assert.equal(good.statusCode, 200);
  const dup = await tokenOrderWebhookHandler({ body, headers: { "x-razorpay-signature": sig }, raw: { rawBody: raw } });
  assert.equal(dup.statusCode, 200);
  const [[w]] = await db.query("SELECT TotalPurchasedTokens FROM student_lab_token_wallets WHERE StudentId = '103' AND LabId = 'postgres'");
  assert.equal(Number(w.TotalPurchasedTokens), 60);
});

test("free-credit route is closed", async () => {
  await assert.rejects(purchaseCreditsHandler({ auth: { ...D }, body: { credits: 99999 } }), { statusCode: 403 });
  const [[c]] = await db.query("SELECT COUNT(*) n FROM credit_wallets WHERE UserId = 103 AND Balance > 1000");
  assert.equal(Number(c.n), 0);
});

test("unified access: university ∪ purchased, one entry per lab, tenant-scoped", async () => {
  await invalidateStudentLabAccess(101);
  const codes = async () => ({ codes: ["MC01094011", "MC01094031", "OLDCOURSE"], lmsStatus: "LIVE" });
  const res = await studentLabAccessService.getAccess({ ...A }, { forceRefresh: true, resolveCourseCodes: codes });
  const byCode = Object.fromEntries(res.labs.map((l) => [l.labCode, l]));
  assert.ok(byCode["dotnet-lab"], "TEN_A mapping");
  assert.equal(byCode["dotnet-lab"].access.accessSource, "university");
  assert.ok(byCode["dbms-lab"], "PLATFORM mapping");
  assert.equal(byCode["java-lab"].access.accessSource, "purchased", "TEN_B's java mapping is NOT used for a TEN_A student");
  assert.equal(byCode["java-lab"].access.remainingTokens, 120);
  assert.equal(byCode["linux-lab"], undefined, "inactive mapping ignored");
  assert.equal(new Set(res.labs.map((l) => l.labCode)).size, res.labs.length, "no duplicates");
});

test("unified access: a student with no source sees no labs; another student's purchase is invisible", async () => {
  const res = await studentLabAccessService.getAccess({ ...B }, { forceRefresh: true, resolveCourseCodes: async () => ({ codes: [], lmsStatus: "LIVE" }) });
  assert.equal(res.labs.length, 0);
});

test("unified access: direct student sees the purchased lab", async () => {
  const res = await studentLabAccessService.getAccess({ ...D }, { forceRefresh: true });
  assert.deepEqual(res.labs.map((l) => l.labCode), ["postgres"]);
  assert.equal(res.labs[0].access.accessSource, "purchased");
});

test("purchase is visible without re-login (cache invalidated on verify)", async () => {
  const codes = async () => ({ codes: ["MC01094011"], lmsStatus: "LIVE" });
  const first = await studentLabAccessService.getAccess({ ...B }, { resolveCourseCodes: codes, forceRefresh: true });
  assert.equal(first.labs.find((l) => l.labCode === "agile-lab"), undefined);
  const order = await labTokenCheckoutService.createOrder({ auth: { ...B }, items: [{ labId: "agile-lab", tokens: 60 }] });
  const { paymentId, signature } = pay(order.orderId);
  await labTokenCheckoutService.verify({ auth: { ...B }, razorpayOrderId: order.orderId, razorpayPaymentId: paymentId, razorpaySignature: signature });
  const next = await studentLabAccessService.getAccess({ ...B }, { resolveCourseCodes: codes });
  assert.equal(next.cache, "MISS");
  assert.equal(next.labs.find((l) => l.labCode === "agile-lab")?.access.accessSource, "purchased");
});

test("billing: a STARTING session is never billed, however old", async () => {
  const old = new Date(Date.now() - 10 * 60e3);
  await db.query(
    `INSERT INTO lab_sessions (SessionId, TenantId, UserId, LabId, StartedAt, ExpiresAt, Status, CreatedAt, AllocatedCredits)
     VALUES ('sess-starting','TEN_A',101,'java-lab',?,?, 'STARTING', ?, 60)`,
    [old, new Date(Date.now() + 3600e3), old]
  );
  const result = await usageBillingService.billSession("sess-starting");
  assert.equal(result.billed, false);
  const [[row]] = await db.query("SELECT Status, LastBilledAt FROM lab_sessions WHERE SessionId = 'sess-starting'");
  assert.equal(row.Status, "STARTING", "old code promoted to RUNNING after 40 s");
  assert.equal(row.LastBilledAt, null);
});

test("order history loads items with one query for the page (no N+1)", async () => {
  let queries = 0;
  const counting = { query: (...args) => { queries += 1; return pool.query(...args); } };
  const orders = await tokenOrderRepository.getStudentOrders("TEN_A", 101, 50, 0, counting);
  assert.ok(orders.length >= 3);
  assert.equal(queries, 2, "orders + one items query");
  assert.ok(orders.every((o) => Array.isArray(o.items)));
});
