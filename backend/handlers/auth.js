import fs from "fs";
import path from "path";
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
    const [roles] = await pool.query("SELECT RoleId FROM Roles WHERE LOWER(Name) = LOWER(?)", [roleCode]);
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
  
  console.log(`[STUDENT_ME] Request received for UserId=${auth.userId}`);
  console.log(`[STUDENT_ME] UserId=${auth.userId}`);
  console.log(`[STUDENT_ME] TenantId=${tenantId}`);
  console.log(`[STUDENT_ME] Provider=GTU_LMS`);
  console.log(`[STUDENT_ME] ExternalStudentId=${admissionId || 'NONE'}`);

  let cachedLmsProfile = null;
  let cacheSource = 'NONE';
  let profileStatus = 'OK';
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
    } else if (cachedResult?.profileStatus === 'LMS_PROFILE_UNAVAILABLE') {
      profileStatus = 'LMS_PROFILE_UNAVAILABLE';
    }
  }

  const fullName = cachedLmsProfile?.applicantFullName || profile.FullName || `${profile.FirstName || ''} ${profile.LastName || ''}`.trim() || 'Student';

  const extMobile = cachedLmsProfile?.mobile || profile.Mobile || null;
  const extAltMobile = cachedLmsProfile?.alternateMobile || profile.AlternateMobile || null;
  const extGender = cachedLmsProfile?.gender || profile.Gender || null;
  const extDob = cachedLmsProfile?.dateOfBirth || profile.DateOfBirth || null;
  const extAddress = cachedLmsProfile?.address || profile.Address || null;
  const extImage = cachedLmsProfile?.studentProfileImage ? (cachedLmsProfile.studentProfileImage.startsWith('http') ? cachedLmsProfile.studentProfileImage : "https://verse.ignitolearn.com" + cachedLmsProfile.studentProfileImage) : (profile.ProfileImage || null);
  const extProgrammes = cachedLmsProfile?.enrollmentnumberprogrammenamelist || [];
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

  let tenantName = 'Acme University';
  let tenantAdminPhone = null;
  if (tenantId || roleCode === 'TENANT_ADMIN') {
    const [tRows] = await pool.query(
      "SELECT Name, AdminPhone, Status FROM tenants WHERE TenantId = ? OR LOWER(AdminEmail) = LOWER(?)",
      [tenantId || '', profile.Email || '']
    );
    if (tRows.length > 0) {
      if ((tRows[0].Status || '').toUpperCase() !== 'ACTIVE') {
        throw unauthorized("This university portal is currently inactive or disabled.");
      }
      if (tRows[0].Name) tenantName = tRows[0].Name;
      if (tRows[0].AdminPhone) tenantAdminPhone = tRows[0].AdminPhone;
    } else if (roleCode === 'TENANT_ADMIN') {
      throw unauthorized("University tenant not found or has been deleted.");
    } else {
      const [activeTenants] = await pool.query(
        "SELECT Name FROM tenants WHERE Status = 'ACTIVE' ORDER BY DbId ASC LIMIT 1"
      );
      if (activeTenants.length > 0 && activeTenants[0].Name) {
        tenantName = activeTenants[0].Name;
      }
    }
  }

  const userMobile = profile.Mobile || profile.PhoneNumber || tenantAdminPhone || extMobile || '';
  const userProfileImage = profile.ProfileImage || extImage || null;

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
      slug: 'gtu',
      name: tenantName
    },
    academic: {
      program: extProgramName,
      programName: extProgramName,
      semester: extCurrentSemester,
      currentSemester: extCurrentSemester,
      enrollmentNumber: extEnrollment,
      mobile: userMobile,
      alternateMobile: extAltMobile,
      gender: extGender,
      dateOfBirth: extDob,
      address: extAddress,
      profileImage: userProfileImage,
      programmesList: extProgrammes,
      collegeName: tenantName
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
      role: profile.Role || 'TENANT_ADMIN',
      roleCode: roleCode,
      status: profile.Status,
      mobile: userMobile,
      phoneNumber: userMobile,
      profileImage: userProfileImage,
      organization: tenantName,
      tenantName: tenantName,
      alternateMobile: extAltMobile,
      gender: extGender,
      dateOfBirth: extDob,
      address: extAddress,
      studentDegreeAdmissionId: admissionId,
      studentId: profile.StudentId || cachedLmsProfile?.studentId || cachedLmsProfile?.studentID || null,
      programmesList: extProgrammes,
      tenantId: tenantId,
      universityId: tenantId,
      departmentId: profile.DepartmentId,
      studentCode: extEnrollment,
      enrollmentNumber: extEnrollment,
      programName: extProgramName,
      currentSemester: extCurrentSemester,
      collegeName: tenantName,
      createdFrom: profile.CreatedFrom || 'LMS',
      authType: profile.AuthType || 'LMS',
      hasPassword: Boolean(profile.PasswordHash),
      permissions,
    }
  });
};

export const userProfileUpdateHandler = async ({ auth, body = {} }) => {
  if (!auth || !auth.userId) {
    throw unauthorized("Authentication required");
  }

  const { fullName, mobile, phoneNumber, organization, profileImage } = body;
  const targetPhone = mobile || phoneNumber || null;

  // 1. Update Users table
  await pool.query(
    `UPDATE Users SET 
       FullName = COALESCE(?, FullName),
       PhoneNumber = COALESCE(?, PhoneNumber),
       Mobile = COALESCE(?, Mobile),
       ProfileImage = COALESCE(?, ProfileImage),
       UpdatedAt = NOW()
     WHERE UserId = ?`,
    [fullName || null, targetPhone, targetPhone, profileImage || null, auth.userId]
  );

  // 2. If user is TENANT_ADMIN or has tenantId, sync to tenants table
  const tenantId = auth.tenantId;
  if (tenantId) {
    await pool.query(
      `UPDATE tenants SET 
         AdminFullName = COALESCE(?, AdminFullName),
         AdminPhone = COALESCE(?, AdminPhone),
         Name = COALESCE(?, Name),
         UpdatedDate = NOW()
       WHERE TenantId = ?`,
      [fullName || null, targetPhone, organization || null, tenantId]
    );
  }

  // 3. Return updated user info
  const [userRows] = await pool.query(
    "SELECT UserId, FullName, Email, Role, PhoneNumber, Mobile, ProfileImage FROM Users WHERE UserId = ?",
    [auth.userId]
  );
  const user = userRows[0] || {};

  return ok({
    success: true,
    message: "Profile updated successfully",
    user: {
      userId: user.UserId,
      id: user.UserId,
      fullName: user.FullName,
      name: user.FullName,
      email: user.Email,
      role: user.Role,
      mobile: user.Mobile || user.PhoneNumber || targetPhone,
      phoneNumber: user.PhoneNumber || user.Mobile || targetPhone,
      profileImage: user.ProfileImage || profileImage || null,
      organization: organization || 'Acme University',
    }
  });
};

export const userProfilePhotoUploadHandler = async ({ auth, files = [], body = {} }) => {
  if (!auth || !auth.userId) {
    throw unauthorized("Authentication required");
  }

  let imageUrl = null;

  if (files && files.length > 0) {
    const file = files[0];
    imageUrl = `/uploads/${file.filename}`;
  } else if (body.image || body.base64) {
    const base64Data = (body.image || body.base64).replace(/^data:image\/\w+;base64,/, "");
    const filename = `profile_${auth.userId}_${Date.now()}.png`;
    const uploadPath = path.join(process.cwd(), "uploads", filename);
    fs.writeFileSync(uploadPath, Buffer.from(base64Data, 'base64'));
    imageUrl = `/uploads/${filename}`;
  } else if (body.url || body.fileUrl) {
    imageUrl = body.url || body.fileUrl;
  }

  if (!imageUrl) {
    throw badRequest("No image file or image data uploaded");
  }

  // Update ProfileImage in Users table
  await pool.query(
    "UPDATE Users SET ProfileImage = ?, UpdatedAt = NOW() WHERE UserId = ?",
    [imageUrl, auth.userId]
  );

  return ok({
    success: true,
    message: "Profile photo uploaded successfully",
    url: imageUrl,
    fileUrl: imageUrl,
    profileImage: imageUrl
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

  const hashedPassword = await hashPassword(newPassword);

  // 1. Update Users table
  await pool.query(
    `UPDATE Users SET PasswordHash = ?, AuthType = 'LMS_AND_DIRECT', Status = 'Active' WHERE UserId = ?`,
    [hashedPassword, auth.userId]
  );

  // 2. Also sync AdminPasswordHash in tenants table for Tenant Admin direct login
  const [userRows] = await pool.query("SELECT Email, TenantId FROM Users WHERE UserId = ?", [auth.userId]);
  if (userRows.length > 0) {
    const uEmail = userRows[0].Email;
    const uTenantId = userRows[0].TenantId || auth.tenantId;
    if (uEmail) {
      await pool.query(
        "UPDATE tenants SET AdminPasswordHash = ?, Status = 'ACTIVE' WHERE LOWER(AdminEmail) = LOWER(?) OR TenantId = ?",
        [hashedPassword, uEmail, uTenantId]
      );
    }
  }

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

export const studentPurchasedProgrammesHandler = async ({ auth, body = {} }) => {
  if (!auth || !auth.userId) {
    throw unauthorized("Authentication required");
  }

  const profile = await userRepository.findById(auth.userId);
  const targetStudentId = body.studentId || profile?.StudentId || profile?.StudentDegreeAdmissionId || auth.userId;

  const apiUrl = "https://verse.ignitolearn.com/api/ExperiaAPI/GetStudentPurchasedProgrammeSemesterList";
  console.log(`[LMS_API] Calling GetStudentPurchasedProgrammeSemesterList for studentId=${targetStudentId}...`);

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ studentId: Number(targetStudentId) })
    });

    if (res.ok) {
      const rawData = await res.json();
      return ok({
        success: true,
        isSuccess: rawData?.isSuccess !== false,
        message: rawData?.message || "Success",
        programmeList: rawData?.programmeList || [],
        semesterList: rawData?.semesterList || [],
        rawData
      });
    } else {
      const errText = await res.text().catch(() => '');
      console.error(`[LMS_API] GetStudentPurchasedProgrammeSemesterList Status=${res.status}: ${errText}`);
      return ok({
        success: false,
        message: `LMS API HTTP ${res.status}`,
        programmeList: [],
        semesterList: []
      });
    }
  } catch (err) {
    console.error("[LMS_API] GetStudentPurchasedProgrammeSemesterList Error:", err.message);
    return ok({
      success: false,
      message: err.message,
      programmeList: [],
      semesterList: []
    });
  }
};

export const courseLabMappingsMap = new Map();

// Default seed mappings for initial testing
courseLabMappingsMap.set("2-1-MCA-101", {
  labId: "lab-c-01",
  title: "C Programming Workspace Lab",
  credits: 30,
  durationMinutes: 90
});
courseLabMappingsMap.set("2-1-MCA-102", {
  labId: "lab-dbms-01",
  title: "Relational Database & SQL Lab",
  credits: 40,
  durationMinutes: 120
});
courseLabMappingsMap.set("1-1-MBA-101", {
  labId: "lab-java-01",
  title: "Java Enterprise Development Lab",
  credits: 35,
  durationMinutes: 90
});

export const mapCourseLabHandler = async ({ auth, pathParameters = {}, body = {} }) => {
  if (!auth || !auth.userId) {
    throw unauthorized("Authentication required");
  }

  const courseId = pathParameters?.courseId || body.courseId;
  const programId = body.programId || body.programmeId || "2";
  const semesterId = body.semesterId || body.semesterNumber || "1";
  const courseCode = body.courseCode || courseId;
  const labId = body.labId;
  const labTitle = body.labTitle || body.title || "Mapped Virtual Lab";

  if (!courseCode || !labId) {
    throw badRequest("courseCode and labId are required");
  }

  const compositeKey = `${programId}-${semesterId}-${courseCode}`;
  const labObj = {
    labId,
    title: labTitle,
    credits: body.credits || 30,
    durationMinutes: body.durationMinutes || 90,
    programId,
    semesterId,
    courseCode,
    updatedAt: new Date().toISOString()
  };

  // Save in memory map
  courseLabMappingsMap.set(compositeKey, labObj);
  courseLabMappingsMap.set(courseCode, labObj);

  // Attempt DB persistence in course_lab_mappings table
  try {
    const { getPool } = await import("../lib/postgres.js");
    const pool = getPool();
    const tenantId = auth.tenantId || 'tenant_001';

    await pool.query(
      `INSERT INTO course_lab_mappings (tenant_id, program_id, semester_id, course_code, lab_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (tenant_id, program_id, semester_id, course_code)
       DO UPDATE SET lab_id = EXCLUDED.lab_id, updated_at = NOW();`,
      [tenantId, String(programId), String(semesterId), String(courseCode), String(labId)]
    );
  } catch (err) {
    console.warn("[MapLab] DB persistence skipped, saved in memory:", err.message);
  }

  return ok({
    success: true,
    message: `Mapped lab ${labTitle} to course ${courseCode}`,
    mapping: labObj
  });
};

export const studentProgrammeSemestersHandler = async ({ auth, body = {} }) => {
  if (!auth || !auth.userId) {
    throw unauthorized("Authentication required");
  }

  const programmeId = body.programmeId || body.programId;
  if (!programmeId) {
    throw badRequest("programmeId is required");
  }

  const apiUrl = "https://verse.ignitolearn.com/api/ExperiaAPI/GetSemesterCourseListByProgrammeId";
  console.log(`[LMS_API] Calling GetSemesterCourseListByProgrammeId for programmeId=${programmeId}...`);

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ programmeId: String(programmeId) })
    });

    if (res.ok) {
      const rawData = await res.json();
      const rawSems = rawData?.semesterList || rawData?.semesterCourseList || rawData?.semesters || (Array.isArray(rawData) ? rawData : []);
      const rawCourses = rawData?.courseList || rawData?.courselist || [];

      // Query DB for persisted mappings
      const dbMappings = new Map();
      try {
        const { getPool } = await import("../lib/postgres.js");
        const pool = getPool();
        const tenantId = auth.tenantId || 'tenant_001';

        const dbRes = await pool.query(
          `SELECT m.program_id, m.semester_id, m.course_code, m.lab_id, l.title as lab_title, l.credits, l.duration_minutes
           FROM course_lab_mappings m
           LEFT JOIN tenant_labs l ON m.lab_id = l.id
           WHERE m.tenant_id = $1 AND m.program_id = $2`,
          [tenantId, String(programmeId)]
        );

        if (dbRes.rows && dbRes.rows.length > 0) {
          for (const row of dbRes.rows) {
            const key = `${row.program_id}-${row.semester_id}-${row.course_code}`;
            const labObj = {
              labId: row.lab_id,
              title: row.lab_title || row.lab_id,
              credits: row.credits || 30,
              durationMinutes: row.duration_minutes || 90,
              status: 'active'
            };
            dbMappings.set(key, labObj);
            dbMappings.set(row.course_code, labObj);
          }
        }
      } catch (e) {
        console.warn("[LMS_API] DB mapping query skipped:", e.message);
      }

      // Helper function to resolve mapped lab object for a course
      const resolveMappedLab = (c, semId) => {
        const code = String(c.courseCode || c.code || c.subjectCode || '');
        const sId = String(semId || c.semesterId || c.semesterNumber || '1');
        const compKey = `${programmeId}-${sId}-${code}`;

        const mapped = dbMappings.get(compKey) || dbMappings.get(code) ||
                       courseLabMappingsMap.get(compKey) || courseLabMappingsMap.get(code);

        return mapped ? {
          labId: mapped.labId,
          title: mapped.title,
          credits: mapped.credits || 30,
          durationMinutes: mapped.durationMinutes || 90,
          status: 'active'
        } : null;
      };

      // Join mapped lab to each course in semesterList
      const semesterList = (rawSems || []).map((sem) => {
        const semId = String(sem.semesterNumber || sem.semesterId || '1');
        const courses = (sem.courseList || sem.courselist || []).map((c) => ({
          ...c,
          mappedLab: resolveMappedLab(c, semId)
        }));

        return {
          ...sem,
          courseList: courses,
          courselist: courses
        };
      });

      const courseList = (rawCourses || []).map((c) => ({
        ...c,
        mappedLab: resolveMappedLab(c, c.semesterId || c.semesterNumber)
      }));

      return ok({
        success: true,
        isSuccess: rawData?.isSuccess !== false,
        message: rawData?.message || "Success",
        semesterList,
        courseList,
        rawData
      });
    } else {
      const errText = await res.text().catch(() => '');
      console.error(`[LMS_API] GetSemesterCourseListByProgrammeId Status=${res.status}: ${errText}`);
      return ok({
        success: false,
        message: `LMS API HTTP ${res.status}`,
        semesterList: []
      });
    }
  } catch (err) {
    console.error("[LMS_API] GetSemesterCourseListByProgrammeId Error:", err.message);
    return ok({
      success: false,
      message: err.message,
      semesterList: []
    });
  }
};

export const getPracticalAvailableProgramsHandler = async ({ auth }) => {
  if (!auth || !auth.userId) {
    throw unauthorized("Authentication required");
  }

  const apiUrl = "https://verse.ignitolearn.com/api/ExperiaAPI/GetPracticalAvailablePrograms";
  console.log(`[LMS_API] Calling GetPracticalAvailablePrograms...`);

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    if (res.ok) {
      const rawData = await res.json();
      return ok({
        success: true,
        isSuccess: rawData?.isSuccess !== false,
        message: rawData?.message || "Success",
        programList: rawData?.programList || rawData?.programmeList || rawData?.programs || (Array.isArray(rawData) ? rawData : []),
        rawData
      });
    } else {
      const errText = await res.text().catch(() => '');
      console.error(`[LMS_API] GetPracticalAvailablePrograms Status=${res.status}: ${errText}`);
      return ok({
        success: false,
        message: `LMS API HTTP ${res.status}`,
        programList: []
      });
    }
  } catch (err) {
    console.error("[LMS_API] GetPracticalAvailablePrograms Error:", err.message);
    return ok({
      success: false,
      message: err.message,
      programList: []
    });
  }
};

export const internalTenantDeleteHandler = async ({ pathParameters = {} }) => {
  const tenantId = pathParameters.tenantId;
  if (!tenantId) {
    throw badRequest("Tenant ID is required");
  }

  // 1. Retrieve Tenant details before deletion
  const [tenants] = await pool.query(
    "SELECT DbId, TenantId, Name, Slug, AdminEmail FROM tenants WHERE TenantId = ? OR DbId = ?",
    [tenantId, tenantId]
  );

  if (tenants.length === 0) {
    throw badRequest("University tenant not found");
  }

  const targetTenant = tenants[0];
  const actualTenantId = targetTenant.TenantId;
  const adminEmail = targetTenant.AdminEmail ? targetTenant.AdminEmail.trim().toLowerCase() : null;

  // 2. Identify associated user IDs for full data cleanup
  const userIds = new Set();

  if (adminEmail) {
    const [adminUsers] = await pool.query("SELECT UserId FROM Users WHERE LOWER(TRIM(Email)) = ?", [adminEmail]);
    adminUsers.forEach(u => userIds.add(u.UserId));
  }

  const [mappedUsers] = await pool.query("SELECT UserId FROM user_tenant_mapping WHERE TenantId = ?", [actualTenantId]);
  mappedUsers.forEach(u => userIds.add(u.UserId));

  const userIdsArray = Array.from(userIds);

  // 3. Delete tenant mapping, credit wallets, external identities, and SSO replay data
  await pool.query("DELETE FROM user_tenant_mapping WHERE TenantId = ?", [actualTenantId]);
  try { await pool.query("DELETE FROM credit_wallets WHERE TenantId = ?", [actualTenantId]); } catch (e) {}
  try { await pool.query("DELETE FROM external_identities WHERE TenantId = ?", [actualTenantId]); } catch (e) {}
  try { await pool.query("DELETE FROM SSOReplayStore WHERE TenantId = ?", [actualTenantId]); } catch (e) {}

  // 4. Delete active sessions, tokens, and Tenant Admin user credentials
  if (userIdsArray.length > 0) {
    const placeholders = userIdsArray.map(() => '?').join(',');

    try { await pool.query(`DELETE FROM UserRefreshTokens WHERE UserId IN (${placeholders})`, userIdsArray); } catch (e) {}
    try { await pool.query(`DELETE FROM RefreshTokens WHERE UserId IN (${placeholders})`, userIdsArray); } catch (e) {}
    try { await pool.query(`DELETE FROM StudentSessions WHERE UserId IN (${placeholders})`, userIdsArray); } catch (e) {}
    try { await pool.query(`DELETE FROM StudentCreditWallets WHERE UserId IN (${placeholders})`, userIdsArray); } catch (e) {}

    // Delete Tenant Admin user accounts from Users table
    if (adminEmail) {
      await pool.query(
        `DELETE FROM Users WHERE UserId IN (${placeholders}) OR LOWER(TRIM(Email)) = ?`,
        [...userIdsArray, adminEmail]
      );
    } else {
      await pool.query(
        `DELETE FROM Users WHERE UserId IN (${placeholders})`,
        userIdsArray
      );
    }
  } else if (adminEmail) {
    await pool.query("DELETE FROM Users WHERE LOWER(TRIM(Email)) = ?", [adminEmail]);
  }

  // 5. Unlink labs assigned to this tenant
  try {
    await pool.query("UPDATE Labs SET TenantId = NULL WHERE TenantId = ?", [actualTenantId]);
  } catch (e) {}

  // 6. Delete Tenant Entity from tenants table (Releasing reserved Slug & TenantId)
  await pool.query("DELETE FROM tenants WHERE TenantId = ?", [actualTenantId]);

  return ok({
    success: true,
    message: `University tenant '${targetTenant.Name}' and administrator account deleted successfully. Subdomain '${targetTenant.Slug}' is released.`,
    tenantId: actualTenantId,
    slug: targetTenant.Slug
  });
};

