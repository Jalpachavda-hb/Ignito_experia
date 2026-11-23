import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "unit-test-jwt-secret";
const { requireAuth, signAccessToken } = await import("../../lib/jwt.js");
const { resolveAuthTenantId } = await import("../../lib/studentTenant.js");

function fakeDb(rowsByQuery) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      for (const [needle, rows] of rowsByQuery) if (sql.includes(needle)) return [rows];
      return [[]];
    },
  };
}

test("x-tenant-id header can no longer set the tenant (token without tenant claim)", () => {
  const token = signAccessToken({ id: 5, userId: 5, email: "a@b.test", role: "Student" });
  const auth = requireAuth({ headers: { authorization: `Bearer ${token}`, "x-tenant-id": "OTHER_TENANT" } });
  assert.equal(auth.tenantId, null);
});

test("signed tenant claim wins over a different header", () => {
  const token = signAccessToken({ id: 5, userId: 5, tenantId: "TEN_A", role: "Student" });
  const auth = requireAuth({ headers: { authorization: `Bearer ${token}`, "x-tenant-id": "TEN_B" } });
  assert.equal(auth.tenantId, "TEN_A");
});

test("API Gateway authorizer context ignores the header too", () => {
  const auth = requireAuth({
    headers: { "x-tenant-id": "TEN_B" },
    requestContext: { authorizer: { lambda: { userId: "9", tenantId: "TEN_A" } } },
  });
  assert.equal(auth.tenantId, "TEN_A");
});

test("resolveAuthTenantId: claim -> own Users row -> mapping; never request data", async () => {
  assert.equal(await resolveAuthTenantId({ userId: 1, tenantId: "TEN_A" }, { db: fakeDb([]) }), "TEN_A");

  const db1 = fakeDb([["FROM `Users`", [{ TenantId: "TEN_USER" }]]]);
  assert.equal(await resolveAuthTenantId({ userId: 2, tenantId: "PLATFORM" }, { db: db1 }), "TEN_USER");

  const db2 = fakeDb([["FROM `Users`", [{ TenantId: null }]], ["user_tenant_mapping", [{ TenantId: "TEN_MAP" }]]]);
  assert.equal(await resolveAuthTenantId({ userId: 3 }, { db: db2 }), "TEN_MAP");

  const db3 = fakeDb([]);
  assert.equal(await resolveAuthTenantId({ userId: 4 }, { db: db3, fallback: "PLATFORM" }), "PLATFORM");
});

test("resolveAuthTenantId caches per auth object (one lookup per request)", async () => {
  const db = fakeDb([["FROM `Users`", [{ TenantId: "TEN_X" }]]]);
  const auth = { userId: 7 };
  await resolveAuthTenantId(auth, { db });
  await resolveAuthTenantId(auth, { db });
  assert.equal(db.calls.length, 1);
});
