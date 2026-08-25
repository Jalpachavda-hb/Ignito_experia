import { forbidden, unauthorized } from "../lib/errors.js";
import { ROLES } from "../constants/roles.js";

/**
 * Asserts that the authenticated user's role is included in allowedRoles.
 * Throws HttpError 401 Unauthorized or 403 Forbidden if not authorized.
 * Preserves parsed.auth structure.
 */
export const requireRoles = (...allowedRoles) => {
  return (parsed) => {
    if (!parsed || !parsed.auth) {
      throw unauthorized("Authentication required");
    }

    const rawRole = (parsed.auth.role || "").toUpperCase().replace(/\s+/g, "_");
    if (!rawRole) {
      throw unauthorized("Authentication required: missing role");
    }

    // Normalize incoming role to standard ENUM values (STUDENT or TENANT_ADMIN)
    let normalizedRole = ROLES.STUDENT;
    if (["TENANT_ADMIN", "TENANTADMIN", "SUPER_ADMIN", "SUPERADMIN", "ADMIN"].includes(rawRole)) {
      normalizedRole = ROLES.TENANT_ADMIN;
    }

    const isAllowed = allowedRoles.some((r) => {
      const targetNorm = r.toUpperCase().replace(/\s+/g, "_");
      return normalizedRole === targetNorm || rawRole === targetNorm;
    });

    if (!isAllowed) {
      throw forbidden("Access Denied: Insufficient permissions.");
    }

    return true;
  };
};

/**
 * Backward-compatible helper for legacy handler calls.
 * Checks role concept without querying Roles or RolePermissions database tables.
 */
export const requirePermission = async (parsed, moduleCode, action) => {
  if (!parsed || !parsed.auth) {
    throw unauthorized("Authentication required");
  }

  const rawRole = (parsed.auth.role || "").toUpperCase().replace(/\s+/g, "_");

  // Admin modules require TENANT_ADMIN role
  const adminModules = [
    "USER_MANAGEMENT", "LAB_MANAGEMENT", "PROGRAM_MANAGEMENT",
    "SEMESTER_MANAGEMENT", "CREDIT_MANAGEMENT", "REPORTS", "SETTINGS", "SESSION_MONITORING"
  ];

  if (adminModules.includes(moduleCode)) {
    const isTenantAdmin = ["TENANT_ADMIN", "TENANTADMIN", "SUPER_ADMIN", "SUPERADMIN", "ADMIN"].includes(rawRole);
    if (!isTenantAdmin && action !== "read") {
      throw forbidden(`Access Denied: Action '${action}' on '${moduleCode}' requires Tenant Admin role.`);
    }
  }

  return true;
};

export default requirePermission;
