import pool from "./mysql.js";

const PLATFORM = "PLATFORM";

function concrete(value) {
  const text = value == null ? "" : String(value).trim();
  return text && text.toUpperCase() !== PLATFORM && text !== "null" && text !== "undefined" ? text : null;
}

/**
 * Trusted tenant for an authenticated caller.
 *
 * Order: signed token claim -> the caller's own Users.TenantId -> the caller's ACTIVE
 * user_tenant_mapping row. Request headers, query strings and bodies are never consulted.
 * Returns `fallback` when the caller has no university tenant (direct students).
 */
export async function resolveAuthTenantId(auth, { fallback = null, db = pool } = {}) {
  if (!auth) return fallback;
  if (auth.__resolvedTenantId !== undefined) return auth.__resolvedTenantId ?? fallback;

  const claim = concrete(auth.tenantId || auth.universityId || auth.tenant_id);
  if (claim) {
    auth.__resolvedTenantId = claim;
    return claim;
  }

  let resolved = null;
  const userId = Number(auth.userId);
  if (Number.isFinite(userId) && userId > 0) {
    try {
      const [rows] = await db.query("SELECT TenantId FROM `Users` WHERE UserId = ? LIMIT 1", [userId]);
      resolved = concrete(rows?.[0]?.TenantId);
      if (!resolved) {
        const [maps] = await db.query(
          "SELECT TenantId FROM user_tenant_mapping WHERE UserId = ? AND Status = 'ACTIVE' AND TenantId <> ? ORDER BY MappingId DESC LIMIT 1",
          [userId, PLATFORM]
        );
        resolved = concrete(maps?.[0]?.TenantId);
      }
    } catch (err) {
      console.warn("[studentTenant] tenant lookup failed:", err.message);
    }
  }
  // Remember per request (the auth object lives for one request only).
  Object.defineProperty(auth, "__resolvedTenantId", { value: resolved, enumerable: false, configurable: true, writable: true });
  return resolved ?? fallback;
}
