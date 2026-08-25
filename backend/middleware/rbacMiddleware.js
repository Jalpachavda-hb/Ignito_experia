import { forbidden, unauthorized } from "../lib/errors.js";
import { ROLES } from "../constants/roles.js";

/**
 * Enterprise RBAC Middleware
 * Evaluates role authorization based on user role concept.
 */
export const hasPermission = (permissionCode) => {
  return async (req, res, next) => {
    const authContext = req.auth || (req.apiGateway?.event?.auth) || null;

    if (!authContext) {
      const err = unauthorized("Authentication required");
      if (next) return next(err);
      throw err;
    }

    const { userId, role } = authContext;
    if (!userId) {
      const err = forbidden("Access Denied: No user identity found.");
      if (next) return next(err);
      throw err;
    }

    let roleCode = role ? String(role).toUpperCase().replace(/\s+/g, "_") : ROLES.STUDENT;

    // Tenant Admin bypasses module checks
    const isTenantAdmin = ["TENANT_ADMIN", "TENANTADMIN", "SUPER_ADMIN", "SUPERADMIN", "ADMIN"].includes(roleCode);
    if (!isTenantAdmin && permissionCode && !permissionCode.startsWith("Student.")) {
      const err = forbidden(`Access Denied: Missing required permission '${permissionCode}'`);
      if (next) return next(err);
      throw err;
    }

    if (next) next();
  };
};

export default hasPermission;
