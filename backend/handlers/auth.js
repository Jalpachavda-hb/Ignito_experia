import { ok } from "../lib/apigw.js";
import authService from "../services/AuthService.js";
import userRepository from "../repositories/UserRepository.js";
import { unauthorized } from "../lib/errors.js";
import pool from "../lib/mysql.js";

function parseCookies(headers = {}) {
  const cookieHeader = headers.cookie || headers.Cookie || "";
  const cookies = {};
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    if (parts.length === 2) {
      cookies[parts[0].trim()] = decodeURIComponent(parts[1].trim());
    }
  });
  return cookies;
}

const makeCookieHeader = (token, maxAgeSeconds = 604800) => {
  return `refreshToken=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAgeSeconds}`;
};

const makeClearCookieHeader = () => {
  return `refreshToken=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

const corsHeaders = (headers = {}) => {
  const origin = headers.origin || headers.Origin || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
  };
};

export const authRegisterHandler = async ({ body }) => {
  const user = await authService.register(body || {});
  return ok({
    success: true,
    message: "User registered successfully",
    user: {
      id: user.UserId,
      fullName: user.FullName,
      email: user.Email,
      role: user.Role,
      status: user.Status,
    }
  });
};

export const authLoginHandler = async ({ body, headers }) => {
  const result = await authService.login(body || {});
  const { user, accessToken, refreshToken } = result;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": makeCookieHeader(refreshToken),
      ...corsHeaders(headers)
    },
    body: JSON.stringify({
      success: true,
      userId: user.id,
      email: user.email,
      role: user.role,
      accessToken,
      refreshToken,
      user,
      token: accessToken
    })
  };
};

export const authRefreshHandler = async ({ body, headers }) => {
  const cookies = parseCookies(headers);
  const oldRefreshToken = cookies.refreshToken || body?.refreshToken;

  if (!oldRefreshToken) {
    throw unauthorized("Missing refresh token in cookie or request body");
  }

  const result = await authService.refresh(oldRefreshToken);
  const { user, accessToken, refreshToken } = result;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": makeCookieHeader(refreshToken),
      ...corsHeaders(headers)
    },
    body: JSON.stringify({
      success: true,
      userId: user.id,
      email: user.email,
      role: user.role,
      accessToken,
      refreshToken,
      user,
      token: accessToken
    })
  };
};

export const authLogoutHandler = async ({ body, headers }) => {
  const cookies = parseCookies(headers);
  const refreshToken = cookies.refreshToken || body?.refreshToken;

  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": makeClearCookieHeader(),
      ...corsHeaders(headers)
    },
    body: JSON.stringify({
      success: true,
      message: "Logged out successfully"
    })
  };
};

export const authMeHandler = async ({ auth }) => {
  if (!auth) {
    throw unauthorized("Not authenticated");
  }

  const user = await userRepository.findById(auth.userId);
  if (!user || user.Status !== "Active") {
    throw unauthorized("User not found or inactive");
  }

  // Load user's permissions from DB
  const [rows] = await pool.query(
    "SELECT ModuleCode, CanCreate, CanRead, CanUpdate, CanDelete FROM RolePermissions WHERE RoleId = ?",
    [user.RoleId]
  );
  const permissions = {};
  for (const r of rows) {
    permissions[r.ModuleCode] = {
      create: Boolean(r.CanCreate),
      read: Boolean(r.CanRead),
      update: Boolean(r.CanUpdate),
      delete: Boolean(r.CanDelete),
    };
  }

  return ok({
    success: true,
    user: {
      id: user.UserId,
      fullName: user.FullName,
      email: user.Email,
      role: user.Role,
      roleId: user.RoleId,
      status: user.Status,
      programId: user.ProgramId,
      semesterId: user.SemesterId,
      permissions,
    }
  });
};
