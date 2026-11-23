import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

// Force the in-memory cache path (no Redis needed, nothing written to a real Redis).
process.env.REDIS_URL = "redis://127.0.0.1:1";
process.env.REDIS_RETRY_AFTER_MS = "600000";

const { lmsResponseCache } = await import("../../services/lms/LmsResponseCache.js");
const { applyRuntimeReadiness, readinessOf } = await import("../../services/sessionReadiness.js");
const { verifyWebhookSignature } = await import("../../lib/razorpayClient.js");

test("cache miss fetches once; concurrent callers share one LMS call", async () => {
  let calls = 0;
  const fetcher = async () => { calls += 1; await new Promise((r) => setTimeout(r, 30)); return { name: "Real Student" }; };
  const [a, b] = await Promise.all([
    lmsResponseCache.getOrFetch("t:single", { fetcher }),
    lmsResponseCache.getOrFetch("t:single", { fetcher }),
  ]);
  assert.equal(calls, 1);
  assert.equal(a.data.name, "Real Student");
  assert.equal(b.data.name, "Real Student");
  const hit = await lmsResponseCache.getOrFetch("t:single", { fetcher });
  assert.equal(hit.source, "REDIS_CACHE");
  assert.equal(calls, 1);
});

test("forced refresh that fails keeps the valid cached profile (not wiped, not emptied)", async () => {
  await lmsResponseCache.getOrFetch("t:keep", { fetcher: async () => ({ name: "Cached Name" }) });
  const res = await lmsResponseCache.getOrFetch("t:keep", {
    forceRefresh: true,
    fetcher: async () => { throw Object.assign(new Error("LMS down"), { code: "LMS_UNAVAILABLE" }); },
  });
  assert.equal(res.source, "CACHE_FALLBACK");
  assert.equal(res.data.name, "Cached Name");
  const after = await lmsResponseCache.read("t:keep");
  assert.equal(after.name, "Cached Name");
});

test("forced refresh that succeeds replaces the cached value", async () => {
  await lmsResponseCache.getOrFetch("t:replace", { fetcher: async () => ({ v: 1 }) });
  const res = await lmsResponseCache.getOrFetch("t:replace", { forceRefresh: true, fetcher: async () => ({ v: 2 }) });
  assert.equal(res.source, "LMS_API");
  assert.equal((await lmsResponseCache.read("t:replace")).v, 2);
});

test("failure with nothing cached is reported, not fabricated", async () => {
  await assert.rejects(
    lmsResponseCache.getOrFetch("t:none", { fetcher: async () => { throw new Error("LMS down"); } }),
    /LMS down/
  );
});

test("expired cache entry triggers a refetch", async () => {
  let n = 0;
  await lmsResponseCache.getOrFetch("t:ttl", { ttlSeconds: 1, fetcher: async () => ({ n: ++n }) });
  await new Promise((r) => setTimeout(r, 1100));
  const res = await lmsResponseCache.getOrFetch("t:ttl", { ttlSeconds: 1, fetcher: async () => ({ n: ++n }) });
  assert.equal(res.source, "LMS_API");
  assert.equal(res.data.n, 2);
});

function fakeDb(affectedRows = 1) {
  const calls = [];
  return { calls, async query(sql, params) { calls.push({ sql, params }); return [{ affectedRows }]; } };
}

test("no billing before READY: pending bootstrap leaves the session untouched", async () => {
  const db = fakeDb();
  for (const state of [undefined, "NOT_STARTED", "BOOTSTRAPPING"]) {
    const r = await applyRuntimeReadiness({ SessionId: "s1" }, { bootstrapState: state }, { db });
    assert.equal(r.outcome, "PENDING");
  }
  assert.equal(db.calls.length, 0);
});

test("READY promotes STARTING -> RUNNING with billing clock starting now (conditional update)", async () => {
  const db = fakeDb(1);
  const now = new Date("2026-11-23T10:00:00Z");
  const r = await applyRuntimeReadiness({ SessionId: "s2", AllocatedCredits: 30 }, { bootstrapState: "READY" }, { db, now });
  assert.equal(r.outcome, "RUNNING");
  assert.equal(r.changed, true);
  assert.match(db.calls[0].sql, /WHERE SessionId = \? AND Status = 'STARTING'/);
  assert.equal(db.calls[0].params[3].getTime(), now.getTime(), "LastBilledAt = promotion time");
  assert.equal(r.tokenExpiryAt.getTime(), now.getTime() + 30 * 60000);
});

test("FAILED bootstrap closes the session without billing and stops the task", async () => {
  const db = fakeDb(1);
  const stopped = [];
  const r = await applyRuntimeReadiness(
    { SessionId: "s3", TaskArn: "arn:task/1" },
    { bootstrapState: "FAILED" },
    { db, stopTask: async (arn) => stopped.push(arn) }
  );
  assert.equal(r.outcome, "FAILED");
  assert.match(db.calls[0].sql, /SET Status = 'FAILED'/);
  assert.doesNotMatch(db.calls[0].sql, /LastBilledAt/);
  assert.deepEqual(stopped, ["arn:task/1"]);
});

test("a second promotion attempt changes nothing", async () => {
  const r = await applyRuntimeReadiness({ SessionId: "s4" }, { bootstrapState: "READY" }, { db: fakeDb(0) });
  assert.equal(r.changed, false);
  assert.equal(readinessOf(null), "PENDING");
});

test("Razorpay webhook signature: HMAC of the raw body with the webhook secret", () => {
  const secret = "whsec_test";
  const raw = Buffer.from(JSON.stringify({ event: "payment.captured" }));
  const sig = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal(verifyWebhookSignature(raw, sig, secret), true);
  assert.equal(verifyWebhookSignature(raw, sig.replace(/.$/, "0"), secret), false);
  assert.equal(verifyWebhookSignature(Buffer.from("{}"), sig, secret), false, "body changed");
  assert.equal(verifyWebhookSignature(raw, sig, ""), false, "no secret configured");
});
