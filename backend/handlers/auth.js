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

import { lmsLoginDto, loginDto, refreshDto } from "../dto/auth.dto.js";
import { ssoService } from "../services/SsoService.js";
import { badRequest } from "../lib/errors.js";

const validate = (schema, data) => {
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw badRequest(`Validation Error: ${error.details.map(d => d.message).join(', ')}`);
  }
  return value;
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

export const authLoginHandler = async ({ body, headers, requestContext }) => {
  const validatedBody = validate(loginDto, body || {});
  // Use sourceIp if available via APIGW or req.ip
  const ipAddress = requestContext?.identity?.sourceIp || "unknown";
  
  const result = await authService.login({
    ...validatedBody,
    ipAddress,
    browser: headers['user-agent'] || 'unknown',
    os: 'unknown', // Could parse from user-agent
    device: 'unknown'
  });
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

export const ssoLoginHandler = async ({ headers, requestContext }) => {
  const authHeader = headers.authorization || headers.Authorization || headers.AUTHORIZATION || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw unauthorized("Missing Authorization Bearer token");
  }
  const token = match[1].trim();

  const ipAddress = requestContext?.identity?.sourceIp || "unknown";
  
  // Use APIGW request ID or generate one
  const correlationId = requestContext?.requestId || require('crypto').randomUUID();

  const result = await ssoService.verifyLmsToken({
    token,
    ipAddress,
    browser: headers['user-agent'] || 'unknown',
    os: 'unknown',
    device: 'unknown',
    correlationId
  });

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(headers) // No frontend cookies trusted or sent for SSO.
    },
    body: JSON.stringify({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: 3600, // 1 hour for access token
      student: result.user,
      permissions: result.permissions || {}
    })
  };
};

export const authRefreshHandler = async ({ body, headers, requestContext }) => {
  const cookies = parseCookies(headers);
  const oldRefreshToken = cookies.refreshToken || body?.refreshToken;

  if (!oldRefreshToken) {
    throw unauthorized("Missing refresh token in cookie or request body");
  }
  
  const ipAddress = requestContext?.identity?.sourceIp || "unknown";

  const result = await authService.refresh({
    refreshToken: oldRefreshToken,
    ipAddress,
    browser: headers['user-agent'] || 'unknown',
    os: 'unknown',
    device: 'unknown'
  });
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
      userId: user ? user.id : null,
      email: user ? user.email : null,
      role: user ? user.role : null,
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

import { permissionService } from "../services/PermissionService.js";
import studentProfileRepository from "../repositories/StudentProfileRepository.js";

export const authMeHandler = async ({ auth }) => {
  if (!auth) {
    throw unauthorized("Not authenticated");
  }

  // 1. Validate Session if SessionId is present in claims
  if (auth.sessionId) {
    const [sessions] = await pool.query(
      "SELECT Status FROM StudentSessions WHERE SessionId = ?",
      [auth.sessionId]
    );
    if (!sessions.length || sessions[0].Status !== 'ACTIVE') {
      throw unauthorized("Session has expired or was revoked. Please log in again.");
    }
  }

  let profile = null;
  let roleCode = auth.role ? String(auth.role).toUpperCase().replace(/\s+/g, '_') : null;

  // 2. Fetch User Data (distinguish between Admin Users and Students based on token/role)
  if (roleCode === 'STUDENT') {
    profile = await studentProfileRepository.findById(auth.userId);
  } else {
    profile = await userRepository.findById(auth.userId);
  }

  if (!profile) {
    throw unauthorized("User not found or inactive");
  }

  // 3. Resolve Enterprise RBAC Permission Matrix (Phase 1 Logic)
  let roleId = profile.RoleId;
  if (!roleId && roleCode) {
    const [roles] = await pool.query("SELECT RoleId FROM Roles WHERE RoleCode = ?", [roleCode]);
    if (roles.length > 0) roleId = roles[0].RoleId;
  }

  const permissions = {};
  if (roleId) {
    const [rolePerms] = await pool.query(
      "SELECT ModuleCode, CanCreate, CanRead, CanUpdate, CanDelete FROM RolePermissions WHERE RoleId = ?",
      [roleId]
    );
    for (const rp of rolePerms) {
      permissions[rp.ModuleCode] = {
        create: Boolean(rp.CanCreate),
        read: Boolean(rp.CanRead),
        update: Boolean(rp.CanUpdate),
        delete: Boolean(rp.CanDelete)
      };
    }
  }

  return ok({
    success: true,
    user: {
      id: profile.UserId || profile.StudentProfileId, // accommodate both schemas
      fullName: profile.FullName || `${profile.FirstName} ${profile.LastName}`,
      email: profile.Email,
      role: profile.Role || 'Student',
      roleCode: roleCode,
      status: profile.Status,
      universityId: profile.UniversityId,
      departmentId: profile.DepartmentId,
      permissions,
    }
  });
};
