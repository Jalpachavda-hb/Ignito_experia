import { ok } from "../lib/apigw.js";
import { signAccessToken } from "../lib/jwt.js";
import { badRequest, unauthorized } from "../lib/errors.js";
import { findUserByCredentials } from "../data/users.js";

export const authLoginHandler = async ({ body }) => {
  const { email, password } = body || {};
  if (!email || !password) throw badRequest("email and password are required");

  const user = findUserByCredentials(email, password);
  if (!user) throw unauthorized("Invalid email or password");

  const token = signAccessToken(user);
  return ok({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      credits: user.credits ?? 1000,
    },
    token,
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  });
};
