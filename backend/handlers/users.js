import { ok } from "../lib/apigw.js";
import { badRequest, notFound, forbidden } from "../lib/errors.js";
import userService from "../services/UserService.js";
import requirePermission from "../middleware/PermissionMiddleware.js";

/**
 * GET /users — list all users (passwords excluded).
 */
export const usersListHandler = async (parsed) => {
  await requirePermission(parsed, "USER_MANAGEMENT", "read");
  const users = await userService.getAllUsers();
  return ok({ success: true, users });
};

/**
 * POST /users — create a new user who can immediately log in.
 */
export const usersCreateHandler = async (parsed) => {
  await requirePermission(parsed, "USER_MANAGEMENT", "create");
  const { name, email, password, role, programId, semesterId } = parsed.body || {};
  if (!email) throw badRequest("email is required");

  // Enforce creator permissions: Only Super Admin can create Super Admin or Tenant Admin
  const creatorRole = parsed.auth.role;
  const targetRole = role || "Student";
  
  if (targetRole === "Super Admin" && creatorRole !== "Super Admin") {
    throw forbidden("Only Super Admins can create Super Admin accounts.");
  }
  
  if (targetRole === "Tenant Admin" && creatorRole !== "Super Admin") {
    throw forbidden("Only Super Admins can create Tenant Admin accounts.");
  }

  const creatorId = parsed.auth.userId;

  const newUser = await userService.createUser({
    name,
    email,
    password,
    role: targetRole,
    programId,
    semesterId,
    createdBy: creatorId
  });

  return ok({
    success: true,
    message: "User created successfully",
    user: {
      id: newUser.UserId,
      fullName: newUser.FullName,
      email: newUser.Email,
      role: newUser.Role,
      status: newUser.Status,
      programId: newUser.ProgramId,
      semesterId: newUser.SemesterId,
    }
  });
};

/**
 * PATCH /users/:userId/status — enable / disable a user.
 */
export const usersUpdateStatusHandler = async (parsed) => {
  await requirePermission(parsed, "USER_MANAGEMENT", "update");
  const { userId } = parsed.pathParameters || {};
  const { status } = parsed.body || {};
  if (!status) throw badRequest("status is required");

  const updatedBy = parsed.auth.userId;
  const user = await userService.updateUserStatus(userId, status, updatedBy);
  if (!user) throw notFound("User not found");

  return ok({ success: true, message: `User ${userId} status updated to ${status}` });
};

