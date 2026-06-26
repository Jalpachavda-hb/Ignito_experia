import { forbidden, unauthorized } from "../lib/errors.js";

/**
 * Asserts that the authenticated user possesses one of the allowed roles.
 * Throws HttpError 403 Forbidden if not authorized.
 * @param {object} parsed The parsed API Gateway event object
 * @param {string[]} allowedRoles Array of allowed role names
 */
export const requireRole = (parsed, allowedRoles) => {
  if (!parsed.auth) {
    throw unauthorized("Authentication required");
  }
  const userRole = parsed.auth.role;
  if (!allowedRoles.includes(userRole)) {
    throw forbidden(`Access Denied: Role '${userRole}' is not authorized to access this resource.`);
  }
};

export default requireRole;
