import { ok } from "../lib/apigw.js";
import { badRequest, notFound } from "../lib/errors.js";
import { getAllUsers, addUser, updateUserStatusById } from "../data/users.js";

/**
 * GET /users — list all users (passwords excluded).
 */
export const usersListHandler = async () => {
  return ok({ success: true, users: getAllUsers() });
};

/**
 * POST /users — create a new user who can immediately log in.
 */
export const usersCreateHandler = async ({ body }) => {
  const { name, email, password, role } = body || {};
  if (!email) throw badRequest("email is required");

  const newUser = addUser({ name, email, password, role });
  return ok({ success: true, message: "User created successfully", user: newUser });
};

/**
 * PATCH /users/:userId/status — enable / disable a user.
 */
export const usersUpdateStatusHandler = async ({ body, pathParameters }) => {
  const { userId } = pathParameters || {};
  const { status } = body || {};
  if (!status) throw badRequest("status is required");

  const user = updateUserStatusById(userId, status);
  if (!user) throw notFound("User not found");

  return ok({ success: true, message: `User ${userId} status updated to ${status}` });
};
