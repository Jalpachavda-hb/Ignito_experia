import { ok } from "../lib/apigw.js";
import { badRequest, notFound, forbidden } from "../lib/errors.js";
import userService from "../services/UserService.js";
import requirePermission from "../middleware/PermissionMiddleware.js";

/**
 * GET /users — list all users
 */
export const usersListHandler = async (parsed) => {
  await requirePermission(parsed, "USER_MANAGEMENT", "read");
  const params = parsed.queryStringParameters || {};
  const result = await userService.getAllUsers(params);
  
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
  const { fullName, email, password, roleId, programId, semesterId, phoneNumber, enrollmentNumber, status } = parsed.body || {};
  if (!email) throw badRequest("email is required");
  if (!roleId) throw badRequest("roleId is required");

  const creatorId = parsed.auth.userId;

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
