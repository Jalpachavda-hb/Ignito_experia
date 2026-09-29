import pool from "./mysql.js";
import { unauthorized } from "./errors.js";
import { portalHostForSlug } from "./tenantSlug.js";
import { LMS_PROVIDER_CONFIG } from "../config/lms/lmsProviderConfig.js";
import { ENV } from "../config/env.js";

const OWNER_API_URL = (process.env.OWNER_API_URL || "http://localhost:4000").replace(/\/+$/, "");

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

async function loadOwnerTenantFromDb(slug) {
  const clean = String(slug || "").trim().toLowerCase();
  if (!clean) return null;
  try {
    const [rows] = await pool.query(
      `SELECT TenantId, Name, Slug, OfficialDomain, LogoUrl, Status, SettingsJson, IntegrationMode
       FROM ignito_experia_owner.tenants
       WHERE LOWER(Slug) = ? LIMIT 1`,
      [clean]
    );
    if (rows?.[0]) {
      return {
        TenantId: rows[0].TenantId,
        Name: rows[0].Name,
        Slug: String(rows[0].Slug).trim().toLowerCase(),
        OfficialDomain: rows[0].OfficialDomain || null,
        LogoUrl: rows[0].LogoUrl || null,
        Status: rows[0].Status || "ACTIVE",
        SettingsJson: rows[0].SettingsJson || null,
        IntegrationMode: rows[0].IntegrationMode || "LMS",
      };
    }
  } catch (err) {
    // Cross-database query ignored if not accessible
  }
  return null;
}

async function fetchOwnerTenantBySlug(slug) {
  const clean = String(slug || "").trim().toLowerCase();
  if (!clean) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const baseUrl = OWNER_API_URL.replace(/\/(api|owner-api)\/?$/, "");
    const ownerRes = await fetch(
      `${baseUrl}/api/internal/tenants/by-slug/${encodeURIComponent(clean)}`,
      {
        headers: { "X-Internal-Service-Token": ENV.internalServiceToken },
        signal: controller.signal,
      }
    );
    if (!ownerRes.ok) return null;
    const ownerData = await ownerRes.json();
    if (!ownerData?.success || !ownerData.slug || !ownerData.tenantId) return null;
    return {
      TenantId: ownerData.tenantId,
      Name: ownerData.name,
      Slug: String(ownerData.slug).trim().toLowerCase(),
      OfficialDomain: ownerData.officialDomain || null,
      LogoUrl: ownerData.logoUrl || null,
      Status: ownerData.status || "ACTIVE",
      SettingsJson: null,
      IntegrationMode: "LMS",
    };
  } catch (err) {
    console.warn("[studentAccess] Owner tenant lookup failed:", err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Copy or update an owner-dashboard university into the Experia database so SSO and branding can use it. */
async function mirrorOwnerTenant(tenant) {
  if (!tenant) return null;
  const tenantId = tenant.TenantId || tenant.tenantId;
  const name = tenant.Name || tenant.name;
  const slug = String(tenant.Slug || tenant.slug || "").trim().toLowerCase();
  if (!tenantId || !slug || !name) return tenant;

  const officialDomain = tenant.OfficialDomain || tenant.officialDomain || null;
  const logoUrl = tenant.LogoUrl || tenant.logoUrl || null;
  const integrationMode = tenant.IntegrationMode || tenant.integrationMode || "LMS";
  const status = tenant.Status || tenant.status || "ACTIVE";

  try {
    await pool.query(
      `INSERT INTO tenants (TenantId, Name, Slug, OfficialDomain, LogoUrl, IntegrationMode, Status)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         Name = VALUES(Name),
         OfficialDomain = VALUES(OfficialDomain),
         LogoUrl = VALUES(LogoUrl),
         IntegrationMode = VALUES(IntegrationMode),
         Status = VALUES(Status),
         UpdatedDate = NOW()`,
      [
        tenantId,
        name,
        slug,
        officialDomain,
        logoUrl,
        integrationMode,
        status,
      ]
    );
  } catch (err) {
    console.warn("[studentAccess] Could not copy/update owner tenant into Experia:", err.message);
  }
  return (await loadTenantBySlug(slug)) || {
    TenantId: tenantId,
    Name: name,
    Slug: slug,
    OfficialDomain: officialDomain,
    LogoUrl: logoUrl,
    IntegrationMode: integrationMode,
    Status: status,
  };
}

/**
 * The browser host slug is the university the student is signing into.
 * Owner-created tenants live in the owner database; Experia mirrors and syncs them.
 */
export async function resolvePortalTenant({ slug, tenantId } = {}) {
  const requestSlug = String(slug || "").trim().toLowerCase();
  if (requestSlug) {
    // 1. Check owner database or owner API for latest tenant data & branding logo
    let owner = await fetchOwnerTenantBySlug(requestSlug);
    if (!owner?.Slug) {
      owner = await loadOwnerTenantFromDb(requestSlug);
    }
    if (owner?.Slug) {
      return mirrorOwnerTenant(owner);
    }

    // 2. Fallback to local table if owner backend was unreachable
    const local = await loadTenantBySlug(requestSlug);
    if (local?.Slug) return local;
  }
  if (tenantId && String(tenantId) !== PLATFORM_TENANT_ID) {
    const byId = await loadTenantById(tenantId);
    if (byId?.Slug && (!requestSlug || String(byId.Slug).toLowerCase() === requestSlug)) {
      return byId;
    }
  }
  return null;
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
