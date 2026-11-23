import test from "node:test";
import assert from "node:assert/strict";

const { mergeLabAccess, findCatalogLab } = await import("../../services/StudentLabAccessService.js");
const { priceCart, priceForTokens } = await import("../../services/LabTokenCheckoutService.js");
const { pickStatus, parseEnum } = await import("../../repositories/TokenOrderRepository.js");

const catalog = [
  { LabId: 2, LabCode: "java-lab", Title: "Java", BaseTokenPrice: "20.00", Status: "active", DisplayOrder: 1 },
  { LabId: 4, LabCode: "dbms-lab", Title: "DBMS", BaseTokenPrice: "12.00", Status: "active", DisplayOrder: 2 },
  { LabId: 10, LabCode: "dotnet-lab", Title: ".NET", BaseTokenPrice: "23.00", Status: "active", DisplayOrder: 3 },
  { LabId: 12, LabCode: "postgres", Title: "PostgreSQL", BaseTokenPrice: "34.00", Status: "Active", DisplayOrder: 4 },
  { LabId: 20, LabCode: "old-lab", Title: "Old", BaseTokenPrice: "10.00", Status: "inactive", DisplayOrder: 5 },
];

test("university and purchased sources merge into one entry per lab", () => {
  const labs = mergeLabAccess({
    catalog,
    universityRows: [
      { lab_id: "dotnet-lab", course_code: "MC01094011", practical_credit: 80, tenant_id: "T1" },
      { lab_id: "dotnet-lab", course_code: "MC01094011", practical_credit: 80, tenant_id: "PLATFORM" },
      { lab_id: "dbms-lab", course_code: "MC01094031", practical_credit: 90, tenant_id: "T1" },
    ],
    wallets: [
      { LabId: "dotnet", TotalPurchasedTokens: 180, ConsumedTokens: 30, RemainingTokens: 150 },
      { LabId: "java", TotalPurchasedTokens: 60, ConsumedTokens: 0, RemainingTokens: 60 },
    ],
    purchases: [{ LabId: "dotnet-lab" }, { LabId: "java-lab" }],
  });
  const byCode = Object.fromEntries(labs.map((l) => [l.labCode, l]));
  assert.equal(labs.length, 3, "no duplicates");
  assert.equal(byCode["dotnet-lab"].access.accessSource, "both");
  assert.deepEqual(byCode["dotnet-lab"].access.sources, ["purchased", "university"]);
  assert.equal(byCode["dotnet-lab"].access.remainingTokens, 150);
  assert.equal(byCode["java-lab"].access.accessSource, "purchased");
  assert.equal(byCode["dbms-lab"].access.accessSource, "university");
  assert.equal(byCode["dbms-lab"].access.hasTokens, false);
  assert.equal(byCode["dbms-lab"].access.canLaunch, true, "university lab without wallet gets course credit on start");
  assert.equal(byCode["dbms-lab"].access.practicalCredit, 90);
});

test("a lab the student has no source for is not exposed", () => {
  const labs = mergeLabAccess({ catalog, universityRows: [], wallets: [], purchases: [] });
  assert.equal(labs.length, 0);
});

test("deleted / unknown labs never appear; inactive labs are listed but not launchable", () => {
  const labs = mergeLabAccess({
    catalog,
    wallets: [
      { LabId: "deleted-lab", TotalPurchasedTokens: 60, ConsumedTokens: 0, RemainingTokens: 60 },
      { LabId: "old", TotalPurchasedTokens: 60, ConsumedTokens: 0, RemainingTokens: 60 },
    ],
    purchases: [{ LabId: "old-lab" }],
  });
  assert.equal(labs.length, 1);
  assert.equal(labs[0].labCode, "old-lab");
  assert.equal(labs[0].status, "inactive");
  assert.equal(labs[0].access.canLaunch, false);
});

test("wallet without purchase or course is labelled granted, balance kept", () => {
  const labs = mergeLabAccess({ catalog, wallets: [{ LabId: "postgres", TotalPurchasedTokens: 60, ConsumedTokens: 4, RemainingTokens: 56 }] });
  assert.equal(labs[0].access.accessSource, "granted");
  assert.equal(labs[0].access.remainingTokens, 56);
  assert.equal(labs[0].status, "active", "Status 'Active' (capital) counts as active");
});

test("legacy duplicate wallet rows for one lab are added up", () => {
  const labs = mergeLabAccess({
    catalog,
    wallets: [
      { LabId: "java", TotalPurchasedTokens: 60, ConsumedTokens: 10, RemainingTokens: 50 },
      { LabId: "java-lab", TotalPurchasedTokens: 30, ConsumedTokens: 0, RemainingTokens: 30 },
    ],
    purchases: [{ LabId: "java" }],
  });
  assert.equal(labs[0].access.remainingTokens, 80);
});

test("tokens are lab-specific: a wallet for one lab never shows on another", () => {
  const labs = mergeLabAccess({
    catalog,
    universityRows: [{ lab_id: "dbms-lab", course_code: "C1", practical_credit: 90 }],
    wallets: [{ LabId: "java", TotalPurchasedTokens: 60, ConsumedTokens: 0, RemainingTokens: 60 }],
    purchases: [{ LabId: "java" }],
  });
  const dbms = labs.find((l) => l.labCode === "dbms-lab");
  assert.equal(dbms.access.remainingTokens, 0);
});

test("catalog lookup by code, canonical key and numeric id", () => {
  assert.equal(findCatalogLab(catalog, "java")?.LabId, 2);
  assert.equal(findCatalogLab(catalog, "lab-java")?.LabId, 2);
  assert.equal(findCatalogLab(catalog, "10")?.LabCode, "dotnet-lab");
  assert.equal(findCatalogLab(catalog, "nope"), null);
});

test("server pricing uses the catalog price (per 60 tokens), not the browser's amount", () => {
  assert.equal(priceForTokens(60, 20), 20);
  assert.equal(priceForTokens(90, 20), 30);
  const priced = priceCart(
    [{ labId: "java-lab", tokens: 60, amountRupees: 1 }, { labId: "4", tokens: 120 }],
    catalog
  );
  assert.equal(priced.totalAmount, 20 + 24);
  assert.equal(priced.totalTokens, 180);
});

test("cart validation", () => {
  assert.throws(() => priceCart([], catalog), { statusCode: 400 });
  assert.throws(() => priceCart([{ labId: "java-lab", tokens: -5 }], catalog), { statusCode: 400 });
  assert.throws(() => priceCart([{ labId: "java-lab", tokens: 1.5 }], catalog), { statusCode: 400 });
  assert.throws(() => priceCart([{ labId: "unknown", tokens: 60 }], catalog), { statusCode: 400 });
  assert.throws(() => priceCart([{ labId: "java-lab", tokens: 1 }], catalog), { statusCode: 400 }, "under ₹1");
  const merged = priceCart([{ labId: "java-lab", tokens: 60 }, { labId: "java", tokens: 60 }], catalog);
  assert.equal(merged.lines.length, 1, "same lab twice is merged");
  assert.equal(merged.lines[0].tokens, 120);
});

test("order status follows the column's real ENUM", () => {
  const local = parseEnum("enum('PENDING','PAYMENT_PROCESSING','PAID','FAILED','CANCELLED')");
  assert.deepEqual(local, ["PENDING", "PAYMENT_PROCESSING", "PAID", "FAILED", "CANCELLED"]);
  assert.equal(pickStatus(local, "pending"), "PENDING");
  assert.equal(pickStatus(local, "credited"), "PAID");
  const m016 = parseEnum("enum('PENDING_PAYMENT','PAID','TOKEN_CREDITED','FAILED','EXPIRED')");
  assert.equal(pickStatus(m016, "pending"), "PENDING_PAYMENT");
  assert.equal(pickStatus(m016, "credited"), "TOKEN_CREDITED");
  const m014 = parseEnum("enum('CREATED','PAYMENT_PENDING','PAID','FAILED','EXPIRED','CANCELLED','REFUNDED')");
  assert.equal(pickStatus(m014, "pending"), "PAYMENT_PENDING");
});
