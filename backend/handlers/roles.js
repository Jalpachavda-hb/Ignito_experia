import { ok } from "../lib/apigw.js";
import { badRequest, notFound } from "../lib/errors.js";
import { roleService } from "../services/RoleService.js";
import { requirePermission } from "../middleware/PermissionMiddleware.js";

/**
 * GET /roles — List all roles with permissions map
 */
export const rolesListHandler = async (parsed) => {
  await requirePermission(parsed, "ROLE_MANAGEMENT", "read");
  const roles = await roleService.getAllRoles();
  return ok({ success: true, roles });
};

/**
 * GET /roles/:roleId — Get details of a single role
 */
export const rolesGetHandler = async (parsed) => {
  await requirePermission(parsed, "ROLE_MANAGEMENT", "read");
  const { roleId } = parsed.pathParameters || {};
  if (!roleId) throw badRequest("RoleId is required");

  const role = await roleService.getRoleById(roleId);
  if (!role) throw notFound("Role not found");

  return ok({ success: true, role });
};

/**
 * POST /roles — Create a new role with permissions mapping
 */
export const rolesCreateHandler = async (parsed) => {
  await requirePermission(parsed, "ROLE_MANAGEMENT", "create");
  const { Name, Description, Permissions } = parsed.body || {};
  if (!Name) throw badRequest("Role Name is required");

  const creatorId = parsed.auth.userId;
  const result = await roleService.createRole({ Name, Description, Permissions }, creatorId);

  return ok({
    success: true,
    message: "Role created successfully",
    roleId: result.InsertedId
  });
};

/**
 * PATCH /roles/:roleId — Update a role's metadata and permissions mapping
 */
export const rolesUpdateHandler = async (parsed) => {
  await requirePermission(parsed, "ROLE_MANAGEMENT", "update");
  const { roleId } = parsed.pathParameters || {};
  const { Name, Description, Permissions } = parsed.body || {};
  if (!roleId) throw badRequest("RoleId is required");
  if (!Name) throw badRequest("Role Name is required");

  const updaterId = parsed.auth.userId;
  await roleService.updateRole(roleId, { Name, Description, Permissions }, updaterId);

  return ok({
    success: true,
    message: "Role updated successfully"
  });
};

/**
 * DELETE /roles/:roleId — Delete a role (soft-delete)
 */
export const rolesDeleteHandler = async (parsed) => {
  await requirePermission(parsed, "ROLE_MANAGEMENT", "delete");
  const { roleId } = parsed.pathParameters || {};
  if (!roleId) throw badRequest("RoleId is required");

  const updaterId = parsed.auth.userId;
  await roleService.deleteRole(roleId, updaterId);

  return ok({
    success: true,
    message: "Role deleted successfully"
  });
};
