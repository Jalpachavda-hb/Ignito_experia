import { forbidden, unauthorized } from "../lib/errors.js";
import { permissionService } from "../services/PermissionService.js";

/**
 * Enterprise RBAC Middleware
 * Evaluates if the user has the required permission hierarchically.
 * @param {string} permissionCode - The permission to check (e.g., 'Student.Update')
 */
export const hasPermission = (permissionCode) => {
  return async (req, res, next) => {
    // If running in lambda proxy mode with aws-serverless-express, `req.apiGateway.event` might contain `auth`
    // Otherwise standard express `req.auth` should exist if auth middleware ran first
    
    // Support either APIGW structure or standard Express
    const authContext = req.auth || (req.apiGateway?.event?.auth) || null;

    if (!authContext) {
      // Because this is used within APIGW wrapper mostly, we actually throw an error
      // that the framework catches, or if express, next(err)
      const err = unauthorized("Authentication required");
      if (next) return next(err);
      throw err;
    }

    const { userId, role } = authContext; // Note: Ensure the JWT token injects `role` code

    if (!userId) {
      const err = forbidden("Access Denied: No user identity found.");
      if (next) return next(err);
      throw err;
    }

    // Role mapping hack for legacy token payload to RoleCode (e.g., 'Super Admin' -> 'SUPER_ADMIN')
    let roleCode = role ? String(role).toUpperCase().replace(/\s+/g, '_') : null;

    const isPermitted = await permissionService.hasPermission(userId, roleCode, permissionCode);

    if (!isPermitted) {
      const err = forbidden(`Access Denied: Missing required permission '${permissionCode}'`);
      if (next) return next(err);
      throw err;
    }

    if (next) next();
  };
};

export default hasPermission;
