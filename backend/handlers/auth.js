import { ok } from "../lib/apigw.js";
import authService from "../services/AuthService.js";
import userRepository from "../repositories/UserRepository.js";
import { lmsProfileCacheService } from "../services/LmsProfileCacheService.js";
import creditWalletRepository from "../repositories/CreditWalletRepository.js";
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

import { ENV } from "../config/env.js";

const obfuscate = (data) => {
  const jsonStr = JSON.stringify(data);
  const base64 = Buffer.from(jsonStr).toString('base64');
  return ok({ payload: base64 });
};

export const tenantResolveHandler = async ({ queryStringParameters = {}, headers = {} }) => {
  const domainHost = (headers['x-tenant-domain'] || headers.host || headers.Host || "").split(":")[0].toLowerCase();
  let slug = queryStringParameters?.slug || "";

  if (!slug && domainHost) {
    const parts = domainHost.split(".");
    if (
      domainHost !== "localhost" &&
      domainHost !== "127.0.0.1" &&
      domainHost !== "experia.ignitolearn.com" &&
      domainHost !== "www.experia.ignitolearn.com"
    ) {
      if (parts.length > 1 && parts[0] !== "www" && parts[0] !== "localhost" && parts[0] !== "experia") {
        slug = parts[0];
      }
    }
  }

  if (!slug) {
    return obfuscate({
      success: true,
      isMainDomain: true,
      isTenant: false,
      message: "Main Experia domain context"
    });
  }

  let tenant = null;

  try {
    const ownerRes = await fetch(`http://localhost:4000/api/internal/tenants/by-slug/${slug.toLowerCase()}`, {
      headers: {
        "X-Internal-Service-Token": ENV.internalServiceToken,
      },
    });
    if (ownerRes.ok) {
      const ownerData = await ownerRes.json();
      if (ownerData.success) {
        tenant = {
          tenantId: ownerData.tenantId,
          name: ownerData.name,
          slug: ownerData.slug,
          officialDomain: ownerData.officialDomain,
          logoUrl: ownerData.logoUrl,
          status: ownerData.status,
        };
      }
    }
  } catch (err) {
    console.warn("Owner Tenant API unreachable, using local fallback:", err.message);
  }

  if (!tenant) {
    const [rows] = await pool.query(
      "SELECT TenantId, Name, Slug, OfficialDomain, LogoUrl, Status FROM tenants WHERE LOWER(Slug) = ?",
      [slug.toLowerCase()]
    );
    if (rows.length > 0) {
      const row = rows[0];
      tenant = {
        tenantId: row.TenantId,
        name: row.Name,
        slug: row.Slug,
        officialDomain: row.OfficialDomain,
        logoUrl: row.LogoUrl,
        status: row.Status,
      };
    }
  }

  if (!tenant) {
    return obfuscate({
      success: false,
      code: "TENANT_NOT_FOUND",
      message: "University portal not found."
    });
  }

  if ((tenant.status || "").toUpperCase() !== "ACTIVE") {
    return obfuscate({
      success: false,
      code: "TENANT_INACTIVE",
      message: `This university portal (${tenant.name}) is currently unavailable.`,
      tenant: {
        name: tenant.name,
        logoUrl: tenant.logoUrl
      }
    });
  }

  return obfuscate({
    success: true,
    isMainDomain: false,
    isTenant: true,
    tenant: {
      name: tenant.name,
      logoUrl: tenant.logoUrl
    },
  });
};

export const authLoginHandler = async ({ body, headers = {}, requestContext }) => {
  const validatedBody = validate(loginDto, body || {});
  const ipAddress = requestContext?.identity?.sourceIp || "unknown";
  
  const result = await authService.login({
    ...validatedBody,
    ipAddress,
    browser: headers['user-agent'] || 'unknown',
    os: 'unknown',
    device: 'unknown',
    host: headers.host || headers.Host || '',
    slug: body?.slug || ''
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

export const ssoLoginHandler = async ({ body = {}, headers, requestContext }) => {
  const authHeader = headers.authorization || headers.Authorization || headers.AUTHORIZATION || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : (body?.token || body?.jwt || "");
  if (!token) {
    throw unauthorized("Missing Authorization Bearer token or token in request body");
  }

  const ipAddress = requestContext?.identity?.sourceIp || "unknown";
  
  // Use APIGW request ID or generate one
  const correlationId = requestContext?.requestId || crypto.randomUUID();

  const result = await ssoService.verifyLmsToken({
    token,
    studentDegreeAdmissionId: body?.studentDegreeAdmissionId,
    studentId: body?.studentId,
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

  const admissionId = profile.StudentDegreeAdmissionId || profile.ExternalStudentId;
  const tenantId = profile.TenantId || profile.UniversityId || auth.tenantId || 'TEN000001';
  
  let cachedLmsProfile = null;
  let cacheSource = 'NONE';
  if (admissionId) {
    const cachedResult = await lmsProfileCacheService.getOrFetchProfile({
      tenantId,
      provider: 'GTU_LMS',
      externalStudentId: admissionId,
      forceRefresh: false
    });
    if (cachedResult && cachedResult.data) {
      cachedLmsProfile = cachedResult.data;
      cacheSource = cachedResult.source;
    }
  }

  const fullName = cachedLmsProfile?.applicantFullName || profile.FullName || `${profile.FirstName || ''} ${profile.LastName || ''}`.trim() || 'Student';

  const extMobile = cachedLmsProfile?.mobile || profile.Mobile || null;
  const extAltMobile = cachedLmsProfile?.alternateMobile || profile.AlternateMobile || null;
  const extGender = cachedLmsProfile?.gender || profile.Gender || null;
  const extDob = cachedLmsProfile?.dateOfBirth || profile.DateOfBirth || null;
  const extAddress = cachedLmsProfile?.address || profile.Address || null;
  const extImage = cachedLmsProfile?.studentProfileImage ? (cachedLmsProfile.studentProfileImage.startsWith('http') ? cachedLmsProfile.studentProfileImage : "https://verse.ignitolearn.com" + cachedLmsProfile.studentProfileImage) : (profile.ProfileImage || null);
  const extProgrammes = cachedLmsProfile?.enrollmentnumberprogrammenamelist || programmesList;
  const extEnrollment = extProgrammes[0]?.enrollmentNumber || profile.StudentCode || profile.ExternalStudentId || null;
  const extProgramName = extProgrammes[0]?.programmeName || profile.ProgramName || 'Master of Business Administration - International Business';
  const extCurrentSemester = extProgrammes[0]?.currentSemester || profile.CurrentSemester || '1';

  let walletBalance = 0.00;
  let walletStatus = 'ACTIVE';
  try {
    const wallet = await creditWalletRepository.findByUserAndTenant(auth.userId, tenantId);
    if (wallet) {
      walletBalance = Number(wallet.Balance || 0);
      walletStatus = wallet.Status || 'ACTIVE';
    }
  } catch (e) {}

  return ok({
    success: true,
    cacheStatus: cacheSource,
    identity: {
      userId: profile.UserId || profile.StudentProfileId,
      email: profile.Email,
      fullName: fullName,
      hasPassword: Boolean(profile.PasswordHash),
      authType: profile.AuthType || 'LMS',
      createdFrom: profile.CreatedFrom || 'LMS',
      status: profile.Status
    },
    tenant: {
      tenantId: tenantId,
      slug: 'gtu'
    },
    academic: {
      program: extProgramName,
      programName: extProgramName,
      semester: extCurrentSemester,
      currentSemester: extCurrentSemester,
      enrollmentNumber: extEnrollment,
      mobile: extMobile,
      alternateMobile: extAltMobile,
      gender: extGender,
      dateOfBirth: extDob,
      address: extAddress,
      profileImage: extImage,
      programmesList: extProgrammes,
      collegeName: 'Gujarat Technological University'
    },
    wallet: {
      balance: walletBalance,
      status: walletStatus
    },
    user: {
      id: profile.UserId || profile.StudentProfileId,
      userId: profile.UserId || profile.StudentProfileId,
      fullName: fullName,
      name: fullName,
      email: profile.Email,
      role: profile.Role || 'Student',
      roleCode: roleCode,
      status: profile.Status,
      mobile: extMobile,
      alternateMobile: extAltMobile,
      gender: extGender,
      dateOfBirth: extDob,
      address: extAddress,
      profileImage: extImage,
      studentDegreeAdmissionId: admissionId,
      programmesList: extProgrammes,
      tenantId: tenantId,
      universityId: tenantId,
      departmentId: profile.DepartmentId,
      studentCode: extEnrollment,
      enrollmentNumber: extEnrollment,
      programName: extProgramName,
      currentSemester: extCurrentSemester,
      collegeName: 'Gujarat Technological University',
      createdFrom: profile.CreatedFrom || 'LMS',
      authType: profile.AuthType || 'LMS',
      hasPassword: Boolean(profile.PasswordHash),
      permissions,
    }
  });
};

import { hashPassword } from "../lib/password.js";

export const authSetPasswordHandler = async ({ auth, body = {} }) => {
  if (!auth || !auth.userId) {
    throw unauthorized("Authentication required");
  }
  const { newPassword, confirmPassword } = body;
  if (!newPassword || newPassword.length < 7) {
    throw badRequest("Password must be at least 7 characters long");
  }
  if (newPassword !== confirmPassword) {
    throw badRequest("Passwords do not match");
  }

  const hashedPassword = await hashPassword(newPassword);

  await pool.query(
    `UPDATE Users SET PasswordHash = ?, AuthType = 'LMS_AND_DIRECT', Status = 'Active' WHERE UserId = ?`,
    [hashedPassword, auth.userId]
  );

  return ok({
    success: true,
    message: "Experia password set successfully. You can now access your account directly."
  });
};

export const studentRefreshProfileHandler = async ({ auth }) => {
  if (!auth || !auth.userId) {
    throw unauthorized("Authentication required");
  }

  const profile = await userRepository.findById(auth.userId);
  if (!profile) {
    throw unauthorized("User not found");
  }

  const admissionId = profile.StudentDegreeAdmissionId || profile.ExternalStudentId;
  const tenantId = profile.TenantId || profile.UniversityId || auth.tenantId || 'TEN000001';

  if (!admissionId) {
    throw badRequest("No LMS admission ID associated with this student account");
  }

  const result = await lmsProfileCacheService.getOrFetchProfile({
    tenantId,
    provider: 'GTU_LMS',
    externalStudentId: admissionId,
    forceRefresh: true
  });

  return ok({
    success: true,
    message: "LMS profile refreshed and cache updated successfully.",
    profile: result?.data || null
  });
};

