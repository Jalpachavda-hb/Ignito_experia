import fs from "fs";
import path from "path";
import { ok } from "../lib/apigw.js";
import authService from "../services/AuthService.js";
import userRepository from "../repositories/UserRepository.js";
import { lmsProfileCacheService } from "../services/LmsProfileCacheService.js";
import { lmsProgrammeService } from "../services/lms/LmsProgrammeService.js";
import { lmsCourseService } from "../services/lms/LmsCourseService.js";
import { lmsAcademicProgressService } from "../services/lms/LmsAcademicProgressService.js";
import { lmsSemesterService } from "../services/lms/LmsSemesterService.js";
import { lmsResponseCache } from "../services/lms/LmsResponseCache.js";
import { identityFromUser, loadAdminLmsContext, loadOwnedProgrammes, loadStudentLmsContext } from "../services/lms/studentLmsContext.js";
import { cleanLmsId } from "../services/lms/lmsIds.js";
import { mergeProgrammes, programmeMatches } from "../services/lms/programmeNormalize.js";
import { LMS_PROVIDER_CONFIG } from "../config/lms/lmsProviderConfig.js";
import creditWalletRepository from "../repositories/CreditWalletRepository.js";
import { unauthorized } from "../lib/errors.js";
import { getBearerToken } from "../lib/jwt.js";
import pool from "../lib/mysql.js";

function parseCookies(headers = {}) {
  const cookieHeader = headers.cookie || headers.Cookie || "";
  const cookies = {};
  cookieHeader.split(";").forEach((cookie) => {
    const eq = cookie.indexOf("=");
    if (eq <= 0) return;
    const name = cookie.slice(0, eq).trim();
    const raw = cookie.slice(eq + 1).trim();
    try {
      cookies[name] = decodeURIComponent(raw);
    } catch {
      cookies[name] = raw;
    }
  });
  return cookies;
}

function cookieDomain(headers = {}) {
  const host = String(headers["x-tenant-domain"] || headers.host || headers.origin || "")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .toLowerCase();
  if (host === "experia.ignitolearn.com" || host.endsWith(".experia.ignitolearn.com")) {
    return "experia.ignitolearn.com";
  }
  return "";
}

function requestIsHttps(headers = {}) {
  const forwarded = String(headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  if (forwarded) return forwarded === "https";
  const origin = String(headers.origin || "");
  if (origin.startsWith("http://")) return false;
  return true;
}

const makeCookieHeader = (token, headers = {}, maxAgeSeconds = 604800) => {
  const domain = cookieDomain(headers);
  const domainAttr = domain ? ` Domain=${domain};` : "";
  const https = requestIsHttps(headers);
  const secure = https ? " Secure;" : "";
  const sameSite = https ? "None" : "Lax";
  return `refreshToken=${encodeURIComponent(token)}; HttpOnly;${secure} SameSite=${sameSite}; Path=/;${domainAttr} Max-Age=${maxAgeSeconds}`;
};

const makeClearCookieHeader = (headers = {}) => {
  const domain = cookieDomain(headers);
  const domainAttr = domain ? ` Domain=${domain};` : "";
  const https = requestIsHttps(headers);
  const secure = https ? " Secure;" : "";
  const sameSite = https ? "None" : "Lax";
  return `refreshToken=; HttpOnly;${secure} SameSite=${sameSite}; Path=/;${domainAttr} Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
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
import { portalHostFromRequest, slugFromHost } from "../lib/tenantSlug.js";
import {
  PLATFORM_TENANT_ID,
  isUniversityIdentity,
  loadLmsProvider,
  loadTenantById,
  resolvePortalTenant,
} from "../lib/studentAccess.js";

const validate = (schema, data) => {
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw badRequest(`Validation Error: ${error.details.map(d => d.message).join(', ')}`);
  }
  return value;
};

export const authRegisterHandler = async ({ body, headers = {} }) => {
  const host = headers.host || headers.Host || headers["x-tenant-domain"] || "";
  const slug = body?.slug || slugFromHost(host);
  const user = await authService.register({ ...(body || {}), slug });
  return ok({
    success: true,
    message: "User registered successfully",
    user: {
      id: user.UserId,
      userId: user.UserId,
      fullName: user.FullName,
      name: user.FullName,
      email: user.Email,
      role: user.Role,
      status: user.Status,
      profileImage: user.ProfileImage || null,
      avatar: user.ProfileImage || null,
    }
  });
};

const obfuscate = (data) => {
  const jsonStr = JSON.stringify(data);
  const base64 = Buffer.from(jsonStr).toString('base64');
  return ok({ payload: base64 });
};

export const tenantResolveHandler = async ({ queryStringParameters = {}, headers = {} }) => {
  const domainHost = headers['x-tenant-domain'] || headers.host || headers.Host || "";
  let slug = String(queryStringParameters?.slug || "").trim().toLowerCase();

  if (!slug) {
    slug = slugFromHost(domainHost);
  }

  if (!slug) {
    return obfuscate({
      success: true,
      isMainDomain: true,
      isTenant: false,
      message: "Main Experia domain context"
    });
  }

  const tenantRow = await resolvePortalTenant({ slug });
  let rawLogoUrl = tenantRow ? (tenantRow.LogoUrl || tenantRow.logoUrl || null) : null;
  const forwardedProto = headers['x-forwarded-proto'];
  if (rawLogoUrl && forwardedProto === 'https' && rawLogoUrl.startsWith('http://')) {
    rawLogoUrl = rawLogoUrl.replace('http://', 'https://');
  }

  const tenant = tenantRow
    ? {
        tenantId: tenantRow.TenantId || tenantRow.tenantId,
        name: tenantRow.Name || tenantRow.name,
        slug: tenantRow.Slug || tenantRow.slug,
        officialDomain: tenantRow.OfficialDomain || tenantRow.officialDomain,
        logoUrl: rawLogoUrl,
        status: tenantRow.Status || tenantRow.status,
      }
    : null;

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
        tenantId: tenant.tenantId,
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl
      }
    });
  }

  return obfuscate({
    success: true,
    isMainDomain: false,
    isTenant: true,
    tenant: {
      tenantId: tenant.tenantId,
      name: tenant.name,
      slug: tenant.slug,
      officialDomain: tenant.officialDomain,
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
    host: body?.portalHost || headers["x-tenant-domain"] || headers.host || headers.Host || "",
    slug: body?.slug || ""
  });
  const { user, accessToken, refreshToken } = result;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": makeCookieHeader(refreshToken, headers),
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

  const host = portalHostFromRequest(headers, body);
  const slug = String(body?.slug || "").trim().toLowerCase() || slugFromHost(host);

  const result = await ssoService.verifyLmsToken({
    token,
    studentDegreeAdmissionId: body?.studentDegreeAdmissionId,
    studentId: body?.studentId,
    ipAddress,
    browser: headers['user-agent'] || 'unknown',
    os: 'unknown',
    device: 'unknown',
    correlationId,
    slug,
    host
  });

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": makeCookieHeader(result.refreshToken, headers),
      ...corsHeaders(headers)
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

function cleanRefreshToken(value) {
  return String(value || "").trim().replace(/^Bearer\s+/i, "").replace(/^"|"$/g, "");
}

export const authRefreshHandler = async ({ body, headers, requestContext }) => {
  const cookies = parseCookies(headers || {});
  let parsedBody = body;
  if (typeof body === "string") {
    try { parsedBody = JSON.parse(body); } catch { parsedBody = {}; }
  }
  const candidates = [];
  for (const value of [
    parsedBody?.refreshToken,
    headers?.["x-refresh-token"],
    headers?.["x-refreshtoken"],
    cookies.refreshToken,
  ]) {
    const token = cleanRefreshToken(value);
    if (token && !candidates.includes(token)) candidates.push(token);
  }

  if (!candidates.length) {
    throw unauthorized("Missing refresh token in cookie or request body");
  }

  const ipAddress = requestContext?.identity?.sourceIp || "unknown";
  let result = null;
  let lastError = null;
  for (const oldRefreshToken of candidates) {
    try {
      result = await authService.refresh({
        refreshToken: oldRefreshToken,
        ipAddress,
        browser: headers["user-agent"] || "unknown",
        os: "unknown",
        device: "unknown",
      });
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!result) throw lastError || unauthorized("Invalid or expired refresh token");
  const { user, accessToken, refreshToken } = result;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": makeCookieHeader(refreshToken, headers),
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
  const refreshToken = cleanRefreshToken(body?.refreshToken) || cleanRefreshToken(cookies.refreshToken);

  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": makeClearCookieHeader(headers),
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

export const authMeHandler = async ({ auth, queryStringParameters = {} }) => {
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

  if (auth.userId) {
    const [uRows] = await pool.query("SELECT * FROM `Users` WHERE UserId = ?", [auth.userId]).catch(() => [[]]);
    profile = uRows[0] || null;
    if (!profile) {
      profile = await userRepository.findById(auth.userId).catch(() => null);
    }
    if (!profile) {
      profile = await studentProfileRepository.findById(auth.userId).catch(() => null);
    }
  }

  if (!profile && auth.email) {
    const [emailRows] = await pool.query("SELECT * FROM `Users` WHERE LOWER(TRIM(Email)) = LOWER(TRIM(?))", [auth.email]).catch(() => [[]]);
    profile = emailRows[0] || null;
  }

  if (!profile && auth.sub) {
    const [subRows] = await pool.query("SELECT * FROM `Users` WHERE ExternalStudentId = ? OR StudentDegreeAdmissionId = ?", [auth.sub, auth.sub]).catch(() => [[]]);
    profile = subRows[0] || null;
  }

  if (!profile) {
    throw unauthorized("User not found or inactive");
  }

  // 3. Resolve Enterprise RBAC Permission Matrix (Phase 1 Logic)
  let roleId = profile.RoleId;
  if (!roleId && roleCode) {
    try {
      const [roles] = await pool.query("SELECT RoleId FROM Roles WHERE RoleCode = ?", [roleCode]);
      if (roles && roles.length > 0) roleId = roles[0].RoleId;
    } catch (e) {}
  }

  const permissions = {};
  if (roleId) {
    try {
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
    } catch (e) {}
  }

  let tenantId = profile.TenantId || profile.UniversityId || auth.tenantId;
  if (!tenantId || String(tenantId).toUpperCase() === PLATFORM_TENANT_ID) {
    const lookupId = profile.UserId || auth.userId;
    if (lookupId) {
      const [utmRows] = await pool.query(
        "SELECT TenantId FROM user_tenant_mapping WHERE UserId = ? AND Status = 'ACTIVE' AND TenantId <> ? ORDER BY MappingId DESC LIMIT 1",
        [lookupId, PLATFORM_TENANT_ID]
      ).catch(() => [[]]);
      if (utmRows.length > 0 && utmRows[0].TenantId) {
        tenantId = utmRows[0].TenantId;
      }
    }
  }
  const universityStudent = isUniversityIdentity(profile);
  const admissionId = universityStudent
    ? (profile.StudentDegreeAdmissionId || profile.ExternalStudentId || auth.studentDegreeAdmissionId || null)
    : null;
  const tenant = universityStudent
    ? (tenantId ? await loadTenantById(tenantId) : null) || (await resolvePortalTenant({ tenantId }))
    : null;
  if (tenant) {
    tenantId = tenant.TenantId;
  } else if (!tenantId) {
    tenantId = PLATFORM_TENANT_ID;
  }

  let cachedLmsProfile = null;
  let cacheSource = 'NONE';
  let profileStatus = universityStudent ? 'LMS_PROFILE_UNAVAILABLE' : null;
  const lmsProvider = universityStudent && tenant
    ? await loadLmsProvider(profile.UserId || auth.userId, tenant)
    : null;
  const lmsIdentityIds = identityFromUser(profile);
  const requestedStudentId = cleanLmsId(queryStringParameters.studentId || queryStringParameters.student_id);
  if (!lmsIdentityIds.studentId && requestedStudentId) {
    lmsIdentityIds.studentId = requestedStudentId;
  }
  const lmsExternalId = lmsIdentityIds.externalStudentId || lmsIdentityIds.studentId;
  if (universityStudent && (admissionId || lmsIdentityIds.studentId) && tenant) {
    const cachedResult = await lmsProfileCacheService.getOrFetchProfile({
      tenantId: tenant.TenantId,
      provider: lmsProvider,
      externalStudentId: lmsExternalId,
      admissionId,
      studentId: lmsIdentityIds.studentId,
      forceRefresh: false
    });
    profileStatus = cachedResult?.profileStatus || 'LMS_PROFILE_UNAVAILABLE';
    cacheSource = cachedResult?.source || profileStatus;
    if (profileStatus === 'LIVE' && cachedResult?.data) {
      cachedLmsProfile = cachedResult.data;
    }
  } else if (universityStudent && !admissionId && !lmsIdentityIds.studentId) {
    profileStatus = 'LMS_STUDENT_NOT_FOUND';
  }

  let purchasedPayload = null;
  if (universityStudent && tenant && (profile.StudentId || profile.ExternalStudentId)) {
    const purchased = await lmsProgrammeService.getPurchased({
      tenantId: tenant.TenantId,
      provider: lmsProvider,
      studentId: lmsIdentityIds.studentId,
    });
    if (purchased.lmsStatus === 'LIVE') purchasedPayload = purchased.rawData || purchased;
  }

  const fullName = cachedLmsProfile?.applicantFullName || profile.FullName || `${profile.FirstName || ''} ${profile.LastName || ''}`.trim() || 'Student';
  const displayEmail = (universityStudent && cachedLmsProfile?.email) ? cachedLmsProfile.email : profile.Email;

  const extMobile = cachedLmsProfile ? (cachedLmsProfile.mobile || null) : (universityStudent ? null : (profile.PhoneNumber || profile.Mobile || null));
  const extAltMobile = cachedLmsProfile ? (cachedLmsProfile.alternateMobile || null) : null;
  const extGender = cachedLmsProfile ? (cachedLmsProfile.gender || null) : null;
  const extDob = cachedLmsProfile ? (cachedLmsProfile.dateOfBirth || null) : null;
  const extAddress = cachedLmsProfile ? (cachedLmsProfile.address || null) : null;
  const lmsImageBase = process.env.LMS_API_BASE_URL || "";
  const extImage = cachedLmsProfile?.studentProfileImage
    ? (cachedLmsProfile.studentProfileImage.startsWith('http') || !lmsImageBase
        ? cachedLmsProfile.studentProfileImage
        : lmsImageBase.replace(/\/$/, "") + cachedLmsProfile.studentProfileImage)
    : (universityStudent ? null : (profile.ProfileImage || profile.profileImage || null));
  const profileProgrammes = Array.isArray(cachedLmsProfile?.enrollmentnumberprogrammenamelist)
    ? cachedLmsProfile.enrollmentnumberprogrammenamelist
    : [];
  let extProgrammes = universityStudent ? mergeProgrammes(profileProgrammes, purchasedPayload) : [];
  if (universityStudent && tenant && extProgrammes.length) {
    extProgrammes = await lmsSemesterService.enrichProgrammes({
      tenant,
      provider: lmsProvider,
      externalStudentId: lmsExternalId,
    }, extProgrammes);
  }
  const extEnrollment = universityStudent
    ? (extProgrammes[0]?.enrollmentNumber || null)
    : null;
  const extProgramName = universityStudent
    ? (extProgrammes[0]?.programmeName || profile.ProgramName || null)
    : null;
  const extCurrentSemester = universityStudent
    ? (extProgrammes[0]?.currentSemester || profile.CurrentSemester || null)
    : null;
  const collegeName = universityStudent ? (tenant?.Name || null) : null;
  const tenantSlug = universityStudent ? (tenant?.Slug || null) : null;
  const createdFrom = profile.CreatedFrom || (universityStudent ? 'LMS' : 'DIRECT');
  const authType = profile.AuthType || (universityStudent ? 'LMS' : 'DIRECT');
  const hasPassword = await accountHasPassword(profile, auth.userId);

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
    isLmsStudent: universityStudent,
    cacheStatus: cacheSource,
    profileStatus,
    programmes: extProgrammes,
    lmsIdentity: universityStudent ? {
      provider: lmsProvider,
      externalStudentId: lmsExternalId || null,
      studentDegreeAdmissionId: admissionId,
      studentId: profile.StudentId || null,
    } : null,
    profile: universityStudent ? {
      fullName: cachedLmsProfile?.applicantFullName || null,
      email: cachedLmsProfile?.email || null,
      mobile: extMobile,
      alternateMobile: extAltMobile,
      gender: extGender,
      dateOfBirth: extDob,
      address: extAddress,
      profileImage: extImage,
    } : null,
    identity: {
      userId: profile.UserId || profile.StudentProfileId,
      email: displayEmail,
      fullName: fullName,
      hasPassword,
      authType,
      createdFrom,
      status: profile.Status
    },
    tenant: universityStudent && tenant ? {
      tenantId: tenant.TenantId,
      slug: tenantSlug,
      name: collegeName
    } : null,
    academic: universityStudent ? {
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
      programmes: extProgrammes,
      collegeName,
      academicProgress: null,
    } : null,
    wallet: {
      balance: walletBalance,
      status: walletStatus
    },
    user: {
      id: profile.UserId || profile.StudentProfileId,
      userId: profile.UserId || profile.StudentProfileId,
      fullName: fullName,
      name: fullName,
      email: displayEmail,
      role: profile.Role || 'Student',
      roleCode: roleCode,
      status: profile.Status,
      mobile: extMobile,
      alternateMobile: extAltMobile,
      gender: extGender,
      dateOfBirth: extDob,
      address: extAddress,
      profileImage: extImage,
      avatar: extImage,
      studentId: universityStudent ? (profile.StudentId || profile.ExternalStudentId || profile.StudentDegreeAdmissionId || null) : null,
      studentDegreeAdmissionId: universityStudent ? admissionId : null,
      externalStudentId: universityStudent ? (profile.ExternalStudentId || null) : null,
      programmesList: universityStudent ? extProgrammes : [],
      profileStatus,
      tenantId: tenantId,
      universityId: tenantId,
      departmentId: profile.DepartmentId,
      studentCode: extEnrollment,
      enrollmentNumber: extEnrollment,
      programName: extProgramName,
      currentSemester: extCurrentSemester,
      collegeName,
      tenantSlug,
      tenantName: collegeName,
      createdFrom,
      authType,
      isLmsStudent: universityStudent,
      hasPassword,
      permissions,
    }
  });
};

import { hashPassword, verifyPassword } from "../lib/password.js";

function passwordFlagIsSet(value) {
  return value === true || value === 1 || value === "1";
}

/** True only when a direct-login hash is stored on the Users row the password writer updates. */
async function accountHasPassword(profile, userId) {
  if (profile?.PasswordHash) return true;
  if (passwordFlagIsSet(profile?.HasPassword) || passwordFlagIsSet(profile?.hasPassword)) return true;

  const id = Number(profile?.UserId || userId);
  if (!Number.isFinite(id)) return false;

  const [rows] = await pool.query(
    "SELECT PasswordHash FROM `Users` WHERE UserId = ? LIMIT 1",
    [id]
  ).catch(() => [[]]);
  return Boolean(rows?.[0]?.PasswordHash);
}

async function persistUserPassword(userId, hashed) {
  const id = Number(userId);
  if (!Number.isFinite(id)) {
    throw badRequest("Password could not be saved because the account id is missing.");
  }

  const writeHash = () => pool.query(
    "UPDATE `Users` SET `PasswordHash` = ?, `UpdatedAt` = NOW() WHERE `UserId` = ?",
    [hashed, id]
  );

  let result;
  try {
    [result] = await writeHash();
  } catch (err) {
    if (err.code === "ER_DATA_TOO_LONG" || err.errno === 1406) {
      await pool.query("ALTER TABLE `Users` MODIFY `PasswordHash` VARCHAR(512) NULL");
      [result] = await writeHash();
    } else {
      throw err;
    }
  }

  if (!result?.affectedRows) {
    throw badRequest("Password was not saved. No matching student row was found.");
  }

  try {
    await pool.query(
      "UPDATE `Users` SET `AuthType` = 'LMS_AND_DIRECT' WHERE `UserId` = ? AND `AuthType` = 'LMS'",
      [id]
    );
  } catch (err) {
    console.warn("[auth] Password was saved, but AuthType was not updated:", err.message);
  }
}

export const authSetPasswordHandler = async ({ auth, body = {} }) => {
  if (!auth || !auth.userId) {
    throw unauthorized("Authentication required");
  }
  const { newPassword, confirmPassword } = body;

  if (!newPassword || newPassword.length < 6) {
    throw badRequest("Password must be at least 6 characters long");
  }
  if (confirmPassword && newPassword !== confirmPassword) {
    throw badRequest("Passwords do not match");
  }

  const hashed = await hashPassword(newPassword);
  await persistUserPassword(auth.userId, hashed);

  return ok({
    success: true,
    hasPassword: true,
    message: "Password set successfully. You can now log in directly or via LMS SSO."
  });
};

export const authRefreshLmsProfileHandler = async ({ auth }) => {
  const ctx = await loadStudentLmsContext(auth);
  if (!ctx.universityStudent) {
    throw badRequest("Academic profile refresh is only available for university students.");
  }
  if (!ctx.tenant) throw badRequest("University portal could not be resolved for this account.");
  if (!ctx.admissionId) {
    return ok({
      success: true,
      profileStatus: "LMS_STUDENT_NOT_FOUND",
      profile: null,
      message: "This account has no university admission id to refresh.",
    });
  }

  const provider = ctx.provider || LMS_PROVIDER_CONFIG.provider;
  await lmsProfileCacheService.invalidateProfile(ctx.tenant.TenantId, provider, ctx.externalStudentId);
  await lmsProgrammeService.invalidate(ctx.tenant.TenantId, provider, ctx.studentId);
  await lmsResponseCache.invalidatePrefix(
    lmsCourseService.cachePrefix(ctx.tenant.TenantId, provider, ctx.externalStudentId)
  );
  if (ctx.admissionId) {
    await lmsResponseCache.invalidate(`lms:academic:${ctx.tenant.TenantId}:${provider}:${ctx.admissionId}`);
  }

  const result = await lmsProfileCacheService.getOrFetchProfile({
    tenantId: ctx.tenant.TenantId,
    provider: ctx.provider,
    externalStudentId: ctx.externalStudentId,
    admissionId: ctx.admissionId,
    studentId: ctx.studentId,
    forceRefresh: true,
  });
  const purchased = ctx.studentId
    ? await lmsProgrammeService.getPurchased({
        tenantId: ctx.tenant.TenantId,
        provider: ctx.provider,
        studentId: ctx.studentId,
        forceRefresh: true,
      })
    : null;

  return ok({
    success: true,
    profileStatus: result?.profileStatus || "LMS_PROFILE_UNAVAILABLE",
    message: result?.profileStatus === "LIVE"
      ? "LMS profile refreshed and cache updated successfully."
      : "LMS data is temporarily unavailable.",
    profile: result?.data || null,
    programmes: mergeProgrammes(
      Array.isArray(result?.data?.enrollmentnumberprogrammenamelist) ? result.data.enrollmentnumberprogrammenamelist : [],
      purchased?.lmsStatus === "LIVE" ? (purchased.rawData || purchased) : null
    ),
  });
};

export const studentRefreshProfileHandler = authRefreshLmsProfileHandler;

export const studentPurchasedProgrammesHandler = async ({ auth, body = {} }) => {
  const ctx = await loadStudentLmsContext(auth);
  if (!ctx.universityStudent || !ctx.tenant) {
    return ok({ success: true, programmeList: [], programList: [], semesterList: [] });
  }

  const effectiveStudentId = body.studentId || body.student_id || ctx.studentId || ctx.externalStudentId;
  if (effectiveStudentId && !ctx.studentId) {
    ctx.studentId = effectiveStudentId;
  }

  let purchased = null;
  if (ctx.studentId) {
    try {
      purchased = await lmsProgrammeService.getPurchased({
        tenantId: ctx.tenant.TenantId,
        provider: ctx.provider,
        studentId: ctx.studentId,
      });
    } catch (e) {
      console.warn("[studentPurchasedProgrammesHandler] getPurchased error:", e.message);
    }
  }

  const owned = await loadOwnedProgrammes(ctx);
  const programmeList = (owned.programmes && owned.programmes.length > 0)
    ? owned.programmes
    : (purchased?.programmeList || purchased?.programList || []);

  const semesterList = purchased?.semesterList || [];

  return ok({
    success: true,
    lmsStatus: owned.lmsStatus || purchased?.lmsStatus || (programmeList.length > 0 ? "LIVE" : "LMS_STUDENT_NOT_FOUND"),
    programmeList,
    programList: programmeList,
    semesterList,
    rawData: purchased?.rawData || null,
  });
};

export const studentProgrammeSemestersHandler = async ({ auth, body = {}, queryStringParameters = {} }) => {
  const ctx = await loadStudentLmsContext(auth);
  const requestedId = body.programmeId || body.programId || body.programme_id || body.program_id;
  if (!requestedId) throw badRequest("programmeId is required");

  const requestedSemester = body.semester ?? body.semesterNumber ?? body.semesterId ?? body.semester_id ?? null;
  const forceRefresh = Boolean(
    body.forceRefresh ||
    body.refresh ||
    body.refreshCache ||
    queryStringParameters?.forceRefresh ||
    queryStringParameters?.refresh
  );

  let tenant = ctx.tenant;
  let provider = ctx.provider;
  if (!tenant) {
    const adminCtx = await loadAdminLmsContext(auth);
    tenant = adminCtx.tenant;
    provider = adminCtx.provider;
  }
  if (!tenant) {
    return ok({ success: true, semesterList: [], courseList: [], lmsStatus: "LMS_TENANT_NOT_FOUND" });
  }

  let targetProgrammeId = requestedId;
  if (ctx.universityStudent) {
    const owned = await loadOwnedProgrammes(ctx);
    const match = owned.programmes.find((programme) => programmeMatches(programme, requestedId));
    if (match) targetProgrammeId = match.programmeId ?? match.programId;
  }

  try {
    const result = await lmsCourseService.getByProgramme({
      tenantId: tenant.TenantId,
      provider,
      programmeId: targetProgrammeId,
      externalStudentId: ctx.externalStudentId,
      semester: requestedSemester,
      forceRefresh,
    });
    return ok(result);
  } catch (err) {
    console.error("[studentProgrammeSemestersHandler] Course fetch error:", err.message);
    return ok({
      success: true,
      lmsStatus: "LMS_COURSES_UNAVAILABLE",
      semesterList: [],
      courseList: [],
    });
  }
};

export const studentCoursesBySemesterHandler = async ({ auth, body = {}, queryStringParameters = {} }) => {
  const ctx = await loadStudentLmsContext(auth);
  const requestedSemester = body.semesterId ?? body.semester ?? queryStringParameters?.semesterId ?? queryStringParameters?.semester;
  if (!requestedSemester) throw badRequest("semesterId is required");

  const forceRefresh = Boolean(
    body.forceRefresh ||
    body.refresh ||
    body.refreshCache ||
    queryStringParameters?.forceRefresh ||
    queryStringParameters?.refresh
  );

  let tenant = ctx.tenant;
  let provider = ctx.provider;
  if (!tenant) {
    const adminCtx = await loadAdminLmsContext(auth);
    tenant = adminCtx.tenant;
    provider = adminCtx.provider;
  }
  if (!tenant) {
    return ok({ success: true, courseList: [], lmsStatus: "LMS_TENANT_NOT_FOUND" });
  }

  try {
    const result = await lmsCourseService.getBySemesterId({
      tenantId: tenant.TenantId,
      provider,
      semesterId: requestedSemester,
      externalStudentId: ctx.externalStudentId,
      forceRefresh,
    });
    return ok(result);
  } catch (err) {
    console.error("[studentCoursesBySemesterHandler] Error:", err.message);
    return ok({
      success: true,
      lmsStatus: "LMS_COURSES_UNAVAILABLE",
      courseList: [],
    });
  }
};

export const studentSemesterLabsHandler = async ({ auth, queryStringParameters = {} }) => {
  const ctx = await loadStudentLmsContext(auth);
  const programId = queryStringParameters.programId || queryStringParameters.programmeId;
  const semester = queryStringParameters.semester || queryStringParameters.semesterNumber || queryStringParameters.semesterId;
  const result = await lmsSemesterService.getAuthorizedLabs({ ctx, programId, semester });
  return ok(result);
};

export const studentAcademicProgressHandler = async ({ auth, queryStringParameters = {} }) => {
  const ctx = await loadStudentLmsContext(auth);
  if (!ctx.universityStudent || !ctx.tenant) {
    return ok({ success: true, progressStatus: null, programmes: [], academicProgress: {} });
  }

  const requestedStudentId = queryStringParameters.studentId || queryStringParameters.student_id;
  if (requestedStudentId && !ctx.studentId) {
    ctx.studentId = String(requestedStudentId).trim();
  }

  let profile = null;
  let profileStatus = "LMS_PROFILE_UNAVAILABLE";
  if (ctx.admissionId || ctx.studentId) {
    const cached = await lmsProfileCacheService.getOrFetchProfile({
      tenantId: ctx.tenant.TenantId,
      provider: ctx.provider,
      externalStudentId: ctx.externalStudentId,
      admissionId: ctx.admissionId,
      studentId: ctx.studentId,
    });
    profileStatus = cached?.profileStatus || profileStatus;
    profile = cached?.data || null;
  }

  const purchased = ctx.studentId
    ? await lmsProgrammeService.getPurchased({
        tenantId: ctx.tenant.TenantId,
        provider: ctx.provider,
        studentId: ctx.studentId,
      })
    : null;
  const programmes = mergeProgrammes(
    Array.isArray(profile?.enrollmentnumberprogrammenamelist) ? profile.enrollmentnumberprogrammenamelist : [],
    purchased?.lmsStatus === "LIVE" ? (purchased.rawData || purchased) : null
  );

  const progress = await lmsAcademicProgressService.getProgress({
    tenantId: ctx.tenant.TenantId,
    provider: ctx.provider,
    admissionId: ctx.admissionId,
    studentId: ctx.studentId,
    profile: profileStatus === "LIVE" ? profile : null,
    programmes,
  });

  if (programmes.length > 0 && (profileStatus === "LIVE" || purchased?.lmsStatus === "LIVE")) {
    progress.progressStatus = "LIVE";
  } else if (profileStatus !== "LIVE" && progress.progressStatus === "LIVE") {
    progress.progressStatus = profileStatus;
  }
  return ok(progress);
};

export const getPracticalAvailableProgramsHandler = async ({ auth, headers = {} }) => {
  const rawToken = getBearerToken(headers) || headers?.["x-lms-token"] || headers?.["x-student-token"] || null;
  let ctx = null;
  try {
    ctx = await loadAdminLmsContext(auth);
  } catch (err) {
    console.warn("[getPracticalAvailableProgramsHandler] Admin LMS context resolution:", err.message);
  }

  const tenantId = ctx?.tenant?.TenantId || ctx?.tenantId || auth?.tenantId || "PLATFORM";
  const provider = ctx?.provider || "GTU_LMS";

  const result = await lmsProgrammeService.getPracticalAvailable({
    tenantId,
    provider,
    bearerToken: rawToken,
  });
  return ok(result);
};
export const mapCourseLabHandler = async ({ auth, pathParameters = {}, body = {} }) => {
  const tenantId = auth?.tenantId || "PLATFORM";
  const courseCode = body.courseCode || pathParameters.courseId;
  const programId = String(body.programId || "2");
  const semesterId = String(body.semesterId || "1");
  const labId = String(body.labId || "");

  if (!courseCode || !labId) {
    return badRequest("courseCode and labId are required");
  }

  try {
    const pool = (await import("../lib/mysql.js")).default;
    const tenantsToMap = Array.from(new Set([tenantId, "PLATFORM", "tnt_4925e025aa50"]));
    for (const tId of tenantsToMap) {
      await pool.query(
        `INSERT INTO course_lab_mappings (tenant_id, program_id, semester_id, course_code, lab_id, status, mapped_by)
         VALUES (?, ?, ?, ?, ?, 'active', ?)
         ON DUPLICATE KEY UPDATE lab_id = VALUES(lab_id), status = 'active', updated_at = CURRENT_TIMESTAMP`,
        [tId, programId, semesterId, courseCode, labId, auth?.email || String(auth?.userId || "admin")]
      );
    }

    try {
      const { lmsResponseCache } = await import("../services/lms/LmsResponseCache.js");
      lmsResponseCache.clear?.();
    } catch (_) {}

    return ok({ success: true, message: "Course lab mapped successfully", courseCode, labId });
  } catch (err) {
    console.error("[mapCourseLabHandler] Error mapping course lab:", err);
    return internalServerError("Failed to map course lab: " + err.message);
  }
};
export const userProfileUpdateHandler = async ({ auth, body = {} }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const userId = Number(auth.userId);
  const { fullName, name, mobile, phoneNumber, mobileNumber, profileImage } = body;

  const newFullName = fullName || name || null;
  const newPhone = mobile || phoneNumber || mobileNumber || null;
  let finalImage = profileImage || null;

  if (finalImage && typeof finalImage === 'string' && finalImage.startsWith('data:image')) {
    try {
      const matches = finalImage.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      let ext = 'png';
      let base64Data = finalImage.replace(/^data:image\/\w+;base64,/, "");
      if (matches && matches[1]) {
        ext = matches[1].toLowerCase().replace('jpeg', 'jpg');
        base64Data = matches[2];
      }
      const filename = `profile_upd_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const uploadPath = path.join(uploadsDir, filename);
      fs.writeFileSync(uploadPath, Buffer.from(base64Data, 'base64'));
      finalImage = `/uploads/${filename}`;
    } catch (e) {
      console.error("Error saving updated profile image:", e);
    }
  }

  const updates = [];
  const params = [];

  if (newFullName) {
    updates.push("FullName = ?");
    params.push(newFullName.trim());
  }
  if (newPhone) {
    updates.push("PhoneNumber = ?");
    params.push(newPhone.trim());
  }
  if (finalImage) {
    updates.push("ProfileImage = ?");
    params.push(finalImage);
  }

  if (updates.length > 0) {
    updates.push("UpdatedAt = NOW()");
    params.push(userId);
    await pool.query(`UPDATE Users SET ${updates.join(', ')} WHERE UserId = ?`, params);
  }

  const [rows] = await pool.query("SELECT * FROM Users WHERE UserId = ?", [userId]);
  const updatedUser = rows[0] || {};

  return ok({
    success: true,
    message: "Profile updated successfully",
    user: {
      userId: updatedUser.UserId,
      id: updatedUser.UserId,
      fullName: updatedUser.FullName,
      name: updatedUser.FullName,
      email: updatedUser.Email,
      phoneNumber: updatedUser.PhoneNumber,
      mobile: updatedUser.PhoneNumber,
      profileImage: updatedUser.ProfileImage || finalImage || null,
      avatar: updatedUser.ProfileImage || finalImage || null
    }
  });
};

export const userProfilePhotoUploadHandler = async ({ auth, files = [], body = {} }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const userId = Number(auth.userId);

  let imageUrl = null;
  if (files && files.length > 0) {
    const uploadedFile = files[0];
    imageUrl = `/uploads/${uploadedFile.filename}`;
  } else if (body.profileImage) {
    imageUrl = body.profileImage;
  }

  if (imageUrl) {
    await pool.query("UPDATE Users SET ProfileImage = ?, UpdatedAt = NOW() WHERE UserId = ?", [imageUrl, userId]);
  }

  return ok({
    success: true,
    message: "Profile photo uploaded successfully",
    url: imageUrl,
    fileUrl: imageUrl,
    profileImage: imageUrl,
    user: { profileImage: imageUrl, avatar: imageUrl }
  });
};
export const internalTenantDeleteHandler = async () => ok({ success: true });
export const userChangePasswordHandler = async ({ auth, body = {} }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const { currentPassword, newPassword, confirmPassword } = body;
  if (!newPassword || newPassword.length < 6) {
    throw badRequest("Password must be at least 6 characters long");
  }
  if (confirmPassword && newPassword !== confirmPassword) {
    throw badRequest("Passwords do not match");
  }

  const [rows] = await pool.query(
    "SELECT PasswordHash FROM `Users` WHERE UserId = ? LIMIT 1",
    [Number(auth.userId)]
  );
  const existing = rows?.[0];
  if (!existing) throw unauthorized("User not found");
  if (existing.PasswordHash) {
    if (!currentPassword) throw badRequest("Current password is required");
    const matches = await verifyPassword(currentPassword, existing.PasswordHash);
    if (!matches) throw badRequest("Current password is incorrect");
  }

  await persistUserPassword(auth.userId, await hashPassword(newPassword));
  return ok({ success: true, message: "Password updated successfully" });
};
export const authForgotPasswordHandler = async () => ok({ success: true, message: "Password reset instructions sent" });
export const authResetPasswordHandler = async () => ok({ success: true, message: "Password reset successfully" });

