import { ok } from "../lib/apigw.js";
import { badRequest, notFound, forbidden } from "../lib/errors.js";
import userService from "../services/UserService.js";
import requirePermission from "../middleware/PermissionMiddleware.js";
import pool from "../lib/mysql.js";

/**
 * GET /users — list all users
 */
export const usersListHandler = async (parsed) => {
  await requirePermission(parsed, "USER_MANAGEMENT", "read");
  const queryParams = parsed.queryStringParameters || {};

  const { role, userId } = parsed.auth || {};
  let authTenantId = parsed.auth?.tenantId || parsed.headers?.['x-tenant-id'] || parsed.headers?.['X-Tenant-Id'] || queryParams.tenantId || null;
  const normalizedRole = (role || "").toUpperCase().replace(/\s+/g, "_");
  const isSuperAdmin = normalizedRole === "SUPER_ADMIN" || normalizedRole === "SUPERADMIN" || normalizedRole === "SUPER_ADMINISTRATOR" || normalizedRole === "ADMIN";

  if (!isSuperAdmin && !authTenantId && userId) {
    const [userRows] = await pool.query("SELECT TenantId FROM Users WHERE UserId = ?", [userId]);
    if (userRows.length > 0 && userRows[0].TenantId) {
      authTenantId = userRows[0].TenantId;
    } else {
      const [mappingRows] = await pool.query(
        "SELECT TenantId FROM user_tenant_mapping WHERE UserId = ? AND Status = 'ACTIVE' ORDER BY MappingId DESC LIMIT 1",
        [userId]
      );
      if (mappingRows.length > 0 && mappingRows[0].TenantId) {
        authTenantId = mappingRows[0].TenantId;
      } else {
        const [tenantRows] = await pool.query(
          "SELECT TenantId FROM tenants WHERE LOWER(AdminEmail) = (SELECT LOWER(Email) FROM Users WHERE UserId = ?)",
          [userId]
        );
        if (tenantRows.length > 0 && tenantRows[0].TenantId) {
          authTenantId = tenantRows[0].TenantId;
        } else {
          const [sessRows] = await pool.query(
            "SELECT UniversityId FROM StudentSessions WHERE UserId = ? AND UniversityId IS NOT NULL ORDER BY LoginTime DESC LIMIT 1",
            [userId]
          );
          if (sessRows.length > 0 && sessRows[0].UniversityId) {
            authTenantId = String(sessRows[0].UniversityId);
          }
        }
      }
    }
  }

  // If still not resolved but user has admin privileges, fallback to first active tenant or default
  if (!isSuperAdmin && !authTenantId && (normalizedRole.includes("ADMIN") || isSuperAdmin)) {
    const [anyMapping] = await pool.query("SELECT TenantId FROM user_tenant_mapping WHERE Status = 'ACTIVE' LIMIT 1");
    if (anyMapping.length > 0 && anyMapping[0].TenantId) {
      authTenantId = anyMapping[0].TenantId;
    } else {
      const [anyTenant] = await pool.query("SELECT TenantId FROM tenants WHERE Status = 'ACTIVE' LIMIT 1");
      if (anyTenant.length > 0 && anyTenant[0].TenantId) {
        authTenantId = anyTenant[0].TenantId;
      } else {
        authTenantId = 'TEN000001';
      }
    }
  }

  if (!isSuperAdmin && !authTenantId) {
    throw forbidden("Access Denied: Tenant context is missing from authenticated session.");
  }

  const result = await userService.getAllUsers({
    actorRole: normalizedRole,
    actorTenantId: authTenantId || null,
    filterTenantId: queryParams.tenantId || null,
    page: queryParams.page,
    pageSize: queryParams.pageSize,
    search: queryParams.search,
    role: queryParams.role,
    status: queryParams.status,
    sortBy: queryParams.sortBy,
    sortOrder: queryParams.sortOrder
  });

  return ok({
    success: true,
    message: "Users retrieved successfully",
    data: result.data,
    pagination: result.pagination
  });
};

/**
 * GET /users/:userId — get user by id
 */
export const usersGetByIdHandler = async (parsed) => {
  await requirePermission(parsed, "USER_MANAGEMENT", "read");
  const { userId } = parsed.pathParameters || {};
  const user = await userService.getUserById(userId);
  if (!user) throw notFound("User not found");

  return ok({
    success: true,
    message: "User retrieved successfully",
    data: user
  });
};

/**
 * POST /users — create a new user
 */
export const usersCreateHandler = async (parsed) => {
  await requirePermission(parsed, "USER_MANAGEMENT", "create");
  const { fullName, email, password, roleId, programId, semesterId, phoneNumber, enrollmentNumber, status, tenantId } = parsed.body || {};
  if (!email) throw badRequest("email is required");
  if (!roleId) throw badRequest("roleId is required");

  const creatorId = parsed.auth?.userId;
  const userTenantId = tenantId || parsed.auth?.tenantId || null;

  const newUser = await userService.createUser({
    fullName,
    email,
    password,
    roleId,
    phoneNumber,
    enrollmentNumber,
    status,
    programId,
    semesterId,
    tenantId: userTenantId,
    createdBy: creatorId
  });

  return ok({
    success: true,
    message: "User created successfully",
    data: newUser
  });
};

/**
 * PUT /users/:userId — update user
 */
export const usersUpdateHandler = async (parsed) => {
  await requirePermission(parsed, "USER_MANAGEMENT", "update");
  const { userId } = parsed.pathParameters || {};
  const updatedBy = parsed.auth.userId;

  const updatedUser = await userService.updateUser(userId, {
    ...parsed.body,
    updatedBy
  });

  return ok({
    success: true,
    message: "User updated successfully",
    data: updatedUser
  });
};

/**
 * PATCH /users/:userId/status — update user status
 */
export const usersUpdateStatusHandler = async (parsed) => {
  await requirePermission(parsed, "USER_MANAGEMENT", "update");
  const { userId } = parsed.pathParameters || {};
  const { status } = parsed.body || {};
  if (!status) throw badRequest("status is required");

  const updatedBy = parsed.auth.userId;
  const user = await userService.updateUserStatus(userId, status, updatedBy);
  if (!user) throw notFound("User not found");

  return ok({ success: true, message: `User status updated to ${status}`, data: user });
};

/**
 * DELETE /users/:userId — soft delete a user
 */
export const usersDeleteHandler = async (parsed) => {
  await requirePermission(parsed, "USER_MANAGEMENT", "delete");
  const { userId } = parsed.pathParameters || {};
  const deletedBy = parsed.auth.userId;

  await userService.deleteUser(userId, deletedBy);
  return ok({ success: true, message: "User deleted successfully" });
};

/**
 * POST /users/:userId/reset-password — reset user password
 */
export const usersResetPasswordHandler = async (parsed) => {
  await requirePermission(parsed, "USER_MANAGEMENT", "update");
  const { userId } = parsed.pathParameters || {};
  const { newPassword } = parsed.body || {};
  
  const result = await userService.resetPassword(userId, newPassword);
  return ok({ success: true, message: result.message });
};

/**
 * POST /users/import — bulk import users
 */
export const usersImportHandler = async (parsed) => {
  await requirePermission(parsed, "USER_MANAGEMENT", "create");
  const { users } = parsed.body || {};
  if (!users || !Array.isArray(users)) throw badRequest("users array is required");

  const createdBy = parsed.auth.userId;
  const result = await userService.importUsers(users, createdBy);

  return ok({
    success: true,
    message: "Import completed",
    data: result
  });
};

/**
 * POST /users/:userId/credits — add credits to user
 */
export const usersAddCreditsHandler = async (parsed) => {
  await requirePermission(parsed, "USER_MANAGEMENT", "update");
  const { userId } = parsed.pathParameters || {};
  const { amount } = parsed.body || {};
  if (!amount || amount <= 0) throw badRequest("Amount must be greater than zero");

  const updatedUser = await userService.addCredits(userId, amount);
  return ok({
    success: true,
    message: `Added ${amount} credits successfully`,
    data: updatedUser
  });
};
