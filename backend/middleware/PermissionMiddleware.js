import { forbidden, unauthorized } from "../lib/errors.js";
import pool from "../lib/mysql.js";

/**
 * Asserts that the authenticated user possesses the required permission.
 * Throws HttpError 403 Forbidden if not authorized.
 * @param {object} parsed The parsed API Gateway event object
 * @param {string} moduleCode The module to check (e.g. ROLE_MANAGEMENT)
 * @param {string} action The action to check ('create', 'read', 'update', 'delete')
 */
export const requirePermission = async (parsed, moduleCode, action) => {
  if (!parsed || !parsed.auth) {
    throw unauthorized("Authentication required");
  }

  const { roleId, role } = parsed.auth;
  
  // Super Admin bypasses all checks
  if (role === "Super Admin") {
    return;
  }

  if (!roleId) {
    throw forbidden("Access Denied: No role assigned.");
  }

  // Fetch permissions for this RoleId and ModuleCode
  const [rows] = await pool.query(
    "SELECT CanCreate, CanRead, CanUpdate, CanDelete FROM RolePermissions WHERE RoleId = ? AND ModuleCode = ?",
    [roleId, moduleCode]
  );

  if (!rows || rows.length === 0) {
    throw forbidden(`Access Denied: No permissions defined for module '${moduleCode}'`);
  }

  const perm = rows[0];
  let hasAccess = false;

  switch (action) {
    case "create":
      hasAccess = Boolean(perm.CanCreate);
      break;
    case "read":
      hasAccess = Boolean(perm.CanRead);
      break;
    case "update":
      hasAccess = Boolean(perm.CanUpdate);
      break;
    case "delete":
      hasAccess = Boolean(perm.CanDelete);
      break;
    default:
      throw forbidden(`Access Denied: Invalid permission action '${action}'`);
  }

  if (!hasAccess) {
    throw forbidden(`Access Denied: You do not have permission to perform '${action}' on '${moduleCode}'`);
  }
};

export default requirePermission;
