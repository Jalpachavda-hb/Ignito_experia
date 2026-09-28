import pool from "./mysql.js";
import { unauthorized } from "./errors.js";
import { portalHostForSlug } from "./tenantSlug.js";
import { LMS_PROVIDER_CONFIG } from "../config/lms/lmsProviderConfig.js";

/** Platform bucket for students who are not members of a university tenant. */
export const PLATFORM_TENANT_ID = "TEN000001";

export function isUniversityIdentity(user) {
  if (!user) return false;
  const created = String(user.CreatedFrom || user.createdFrom || "").toUpperCase();
  const auth = String(user.AuthType || user.authType || "").toUpperCase();
  if (created === "LMS" || auth === "LMS" || auth === "LMS_AND_DIRECT") return true;
  if (user.StudentDegreeAdmissionId || user.studentDegreeAdmissionId) return true;
  if (user.ExternalStudentId || user.externalStudentId) return true;
  return false;
}

function parseSettings(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const TENANT_COLUMNS = "TenantId, Name, Slug, OfficialDomain, LogoUrl, Status, SettingsJson, IntegrationMode";

export async function loadTenantById(tenantId) {
  if (!tenantId || String(tenantId) === PLATFORM_TENANT_ID) return null;
  const [rows] = await pool.query(
    `SELECT ${TENANT_COLUMNS} FROM tenants WHERE TenantId = ? LIMIT 1`,
    [tenantId]
  );
  return rows[0] || null;
}

export async function loadTenantBySlug(slug) {
  const clean = String(slug || "").trim().toLowerCase();
  if (!clean) return null;
  const [rows] = await pool.query(
    `SELECT ${TENANT_COLUMNS} FROM tenants WHERE LOWER(Slug) = ? LIMIT 1`,
    [clean]
  );
  return rows[0] || null;
}

export async function loadLmsProvider(userId, tenant, explicitProvider) {
  if (explicitProvider) return String(explicitProvider);
  if (userId) {
    const [rows] = await pool.query(
      "SELECT Provider FROM external_identities WHERE UserId = ? ORDER BY UpdatedAt DESC LIMIT 1",
      [userId]
    ).catch(() => [[]]);
    if (rows?.[0]?.Provider) return String(rows[0].Provider);
  }
  const settings = parseSettings(tenant?.SettingsJson);
  if (settings.lmsProvider) return String(settings.lmsProvider);
  if (process.env.LMS_PROVIDER) return process.env.LMS_PROVIDER;
  return LMS_PROVIDER_CONFIG.provider;
}

/**
 * University students may sign in only on the slug that belongs to their tenant.
 * Direct students may register and sign in only when no university slug is present.
 */
export function assertStudentPortal({ user, tenant, slug, host }) {
  const requestSlug = String(slug || "").trim().toLowerCase();
  if (isUniversityIdentity(user)) {
    const expected = String(tenant?.Slug || "").trim().toLowerCase();
    const portal = expected ? portalHostForSlug(expected, host) : "";
    if (!expected) {
      throw unauthorized("This university account can only sign in on its university portal.");
    }
    if ((tenant.Status || "ACTIVE").toUpperCase() !== "ACTIVE") {
      throw unauthorized(`${tenant.Name} is currently unavailable. Contact the platform administrator.`);
    }
    if (requestSlug !== expected) {
      throw unauthorized(
        `Sign in at ${portal}. University students use their university portal, not the main Experia site.`
      );
    }
    return { kind: "university", tenant };
  }

  if (requestSlug) {
    throw unauthorized(
      "Direct accounts register and sign in on the main Experia site. This portal is only for students of that university."
    );
  }
  return { kind: "direct", tenant: null };
}
