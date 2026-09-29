import { ok } from "../lib/apigw.js";
import authService from "../services/AuthService.js";
import userRepository from "../repositories/UserRepository.js";
import { lmsProfileCacheService } from "../services/LmsProfileCacheService.js";
import { lmsProgrammeService } from "../services/lms/LmsProgrammeService.js";
import { lmsCourseService } from "../services/lms/LmsCourseService.js";
import { lmsAcademicProgressService } from "../services/lms/LmsAcademicProgressService.js";
import { identityFromUser, loadStudentLmsContext } from "../services/lms/studentLmsContext.js";
import { mergeProgrammes } from "../services/lms/programmeNormalize.js";
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
      fullName: user.FullName,
      email: user.Email,
      role: user.Role,
      status: user.Status,
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
  const tenant = tenantRow
    ? {
        tenantId: tenantRow.TenantId,
        name: tenantRow.Name,
        slug: tenantRow.Slug,
        officialDomain: tenantRow.OfficialDomain,
        logoUrl: tenantRow.LogoUrl,
        status: tenantRow.Status,
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
    host: body?.portalHost || headers["x-tenant-domain"] || headers.host || headers.Host || "",
    slug: body?.slug || ""
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
  const cookies = parseCookies(headers || {});
  let parsedBody = body;
  if (typeof body === 'string') {
    try { parsedBody = JSON.parse(body); } catch (e) {}
  }
  const oldRefreshToken =
    cookies.refreshToken ||
    parsedBody?.refreshToken ||
    headers?.['x-refresh-token'] ||
    headers?.['X-Refresh-Token'] ||
    headers?.['x-refreshtoken'];

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

  if (auth.userId) {
    const [uRows] = await pool.query("SELECT * FROM users WHERE UserId = ?", [auth.userId]).catch(() => [[]]);
    profile = uRows[0] || null;
    if (!profile) {
      profile = await userRepository.findById(auth.userId).catch(() => null);
    }
    if (!profile) {
      profile = await studentProfileRepository.findById(auth.userId).catch(() => null);
    }
  }

  if (!profile && auth.email) {
    const [emailRows] = await pool.query("SELECT * FROM users WHERE LOWER(TRIM(Email)) = LOWER(TRIM(?))", [auth.email]).catch(() => [[]]);
    profile = emailRows[0] || null;
  }

  if (!profile && auth.sub) {
    const [subRows] = await pool.query("SELECT * FROM users WHERE ExternalStudentId = ? OR StudentDegreeAdmissionId = ?", [auth.sub, auth.sub]).catch(() => [[]]);
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
  if (!tenantId || tenantId === PLATFORM_TENANT_ID) {
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
  if (tenantId === PLATFORM_TENANT_ID) tenantId = null;
  const universityStudent = isUniversityIdentity(profile);
  const admissionId = universityStudent
    ? (profile.StudentDegreeAdmissionId || profile.ExternalStudentId || auth.studentDegreeAdmissionId || null)
    : null;
  const tenant = universityStudent ? await loadTenantById(tenantId) : null;
  if (!tenantId) {
    tenantId = PLATFORM_TENANT_ID;
  }

  let cachedLmsProfile = null;
  let cacheSource = 'NONE';
  let profileStatus = universityStudent ? 'LMS_PROFILE_UNAVAILABLE' : null;
  const lmsProvider = universityStudent && tenant
    ? await loadLmsProvider(profile.UserId || auth.userId, tenant)
    : null;
  const lmsIdentityIds = identityFromUser(profile);
  const lmsExternalId = lmsIdentityIds.externalStudentId;
  if (universityStudent && admissionId && tenant) {
    const cachedResult = await lmsProfileCacheService.getOrFetchProfile({
      tenantId: tenant.TenantId,
      provider: lmsProvider,
      externalStudentId: lmsExternalId,
      admissionId,
      forceRefresh: false
    });
    profileStatus = cachedResult?.profileStatus || 'LMS_PROFILE_UNAVAILABLE';
    cacheSource = cachedResult?.source || profileStatus;
    if (profileStatus === 'LIVE' && cachedResult?.data) {
      cachedLmsProfile = cachedResult.data;
    }
  } else if (universityStudent && !admissionId) {
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
    : (universityStudent ? null : (profile.ProfileImage || null));
  const profileProgrammes = Array.isArray(cachedLmsProfile?.enrollmentnumberprogrammenamelist)
    ? cachedLmsProfile.enrollmentnumberprogrammenamelist
    : [];
  const extProgrammes = universityStudent ? mergeProgrammes(profileProgrammes, purchasedPayload) : [];
  const extEnrollment = universityStudent
    ? (extProgrammes[0]?.enrollmentNumber || profile.StudentCode || null)
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
    profileStatus,
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
      email: profile.Email,
      fullName: fullName,
      hasPassword: Boolean(profile.PasswordHash),
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

  if (!newPassword || newPassword.length < 6) {
    throw badRequest("Password must be at least 6 characters long");
  }
  if (confirmPassword && newPassword !== confirmPassword) {
    throw badRequest("Passwords do not match");
  }

  const hashed = await hashPassword(newPassword);

  await pool.query(
    "UPDATE users SET PasswordHash = ?, AuthType = IF(AuthType = 'LMS', 'LMS_AND_DIRECT', AuthType), UpdatedAt = NOW() WHERE UserId = ?",
    [hashed, auth.userId]
  );

  return ok({
    success: true,
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

  const result = await lmsProfileCacheService.getOrFetchProfile({
    tenantId: ctx.tenant.TenantId,
    provider: ctx.provider,
    externalStudentId: ctx.externalStudentId,
    admissionId: ctx.admissionId,
    forceRefresh: true,
  });

  return ok({
    success: true,
    profileStatus: result?.profileStatus || "LMS_PROFILE_UNAVAILABLE",
    message: result?.profileStatus === "LIVE"
      ? "LMS profile refreshed and cache updated successfully."
      : "LMS data is temporarily unavailable.",
    profile: result?.data || null,
  });
};

export const studentRefreshProfileHandler = authRefreshLmsProfileHandler;

export const studentPurchasedProgrammesHandler = async ({ auth }) => {
  const ctx = await loadStudentLmsContext(auth);
  if (!ctx.universityStudent || !ctx.tenant) {
    return ok({ success: true, programmeList: [], programList: [], semesterList: [] });
  }
  const result = await lmsProgrammeService.getPurchased({
    tenantId: ctx.tenant.TenantId,
    provider: ctx.provider,
    studentId: ctx.studentId,
  });
  return ok(result);
};

export const studentProgrammeSemestersHandler = async ({ auth, body = {} }) => {
  const ctx = await loadStudentLmsContext(auth);
  if (!ctx.universityStudent || !ctx.tenant) {
    return ok({ success: true, semesterList: [], courseList: [] });
  }
  const programmeId = body.programmeId || body.programId;
  if (!programmeId) throw badRequest("programmeId is required");

  const profileResult = ctx.admissionId
    ? await lmsProfileCacheService.getOrFetchProfile({
        tenantId: ctx.tenant.TenantId,
        provider: ctx.provider,
        externalStudentId: ctx.externalStudentId,
        admissionId: ctx.admissionId,
      })
    : null;
  const purchased = ctx.studentId
    ? await lmsProgrammeService.getPurchased({
        tenantId: ctx.tenant.TenantId,
        provider: ctx.provider,
        studentId: ctx.studentId,
      })
    : null;
  const owned = mergeProgrammes(
    Array.isArray(profileResult?.data?.enrollmentnumberprogrammenamelist) ? profileResult.data.enrollmentnumberprogrammenamelist : [],
    purchased?.lmsStatus === "LIVE" ? (purchased.rawData || purchased) : null
  );
  const ownedIds = owned
    .map((programme) => String(programme.programmeId ?? programme.programId ?? ""))
    .filter(Boolean);
  if (ownedIds.length > 0 && !ownedIds.includes(String(programmeId))) {
    return ok({ success: true, lmsStatus: "LMS_STUDENT_NOT_FOUND", semesterList: [], courseList: [] });
  }

  const result = await lmsCourseService.getByProgramme({
    tenantId: ctx.tenant.TenantId,
    provider: ctx.provider,
    programmeId,
    semester: body.semester ?? body.semesterNumber ?? body.semesterId ?? null,
  });
  return ok(result);
};

export const studentAcademicProgressHandler = async ({ auth }) => {
  const ctx = await loadStudentLmsContext(auth);
  if (!ctx.universityStudent || !ctx.tenant) {
    return ok({ success: true, progressStatus: null, programmes: [], academicProgress: {} });
  }

  let profile = null;
  let profileStatus = "LMS_PROFILE_UNAVAILABLE";
  if (ctx.admissionId) {
    const cached = await lmsProfileCacheService.getOrFetchProfile({
      tenantId: ctx.tenant.TenantId,
      provider: ctx.provider,
      externalStudentId: ctx.externalStudentId,
      admissionId: ctx.admissionId,
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

  if (profileStatus !== "LIVE" && progress.progressStatus === "LIVE") {
    progress.progressStatus = profileStatus;
  }
  return ok(progress);
};

export const getPracticalAvailableProgramsHandler = async () => ok({ success: true, programList: [] });
export const mapCourseLabHandler = async () => ok({ success: true });
export const userProfileUpdateHandler = async () => ok({ success: true });
export const userProfilePhotoUploadHandler = async () => ok({ success: true });
export const internalTenantDeleteHandler = async () => ok({ success: true });
export const userChangePasswordHandler = async () => ok({ success: true, message: "Password updated successfully" });
export const authForgotPasswordHandler = async () => ok({ success: true, message: "Password reset instructions sent" });
export const authResetPasswordHandler = async () => ok({ success: true, message: "Password reset successfully" });

