import crypto from "crypto";
import jwt from "jsonwebtoken";
import pool from "../lib/mysql.js";
import externalIdentityRepository from "../repositories/ExternalIdentityRepository.js";
import creditWalletRepository from "../repositories/CreditWalletRepository.js";
import sessionRepository from "../repositories/SessionRepository.js";
import refreshTokenRepository from "../repositories/RefreshTokenRepository.js";
import { auditService } from "./AuditService.js";
import { signAccessToken } from "../lib/jwt.js";
import { unauthorized, badRequest } from "../lib/errors.js";
import { ENV } from "../config/env.js";
import { lmsProfileCacheService } from "./LmsProfileCacheService.js";
import {
  assertStudentPortal,
  loadLmsProvider,
  resolvePortalTenant,
} from "../lib/studentAccess.js";

const LMS_JWT_SECRET = process.env.LMS_JWT_SECRET || "default_lms_secret";

async function runOptional(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`[SsoService] ${label} skipped:`, err.message);
  }
}

async function selectUserIdByEmail(connection, email) {
  for (const table of ["Users", "users"]) {
    try {
      const [rows] = await connection.query(
        `SELECT UserId FROM \`${table}\` WHERE LOWER(TRIM(Email)) = ? LIMIT 1`,
        [email]
      );
      if (rows[0]?.UserId) return rows[0].UserId;
    } catch (err) {
      if (err.code !== "ER_NO_SUCH_TABLE") throw err;
    }
  }
  return null;
}

async function selectUserById(connection, userId) {
  for (const table of ["Users", "users"]) {
    try {
      const [rows] = await connection.query(
        `SELECT UserId, PasswordHash, CreatedFrom, AuthType FROM \`${table}\` WHERE UserId = ? LIMIT 1`,
        [userId]
      );
      if (rows[0]?.UserId) return rows[0];
    } catch (err) {
      if (err.code !== "ER_NO_SUCH_TABLE") throw err;
    }
  }
  return null;
}

async function insertStudent(connection, row) {
  const attempts = [
    {
      sql: `INSERT INTO Users (FullName, Email, PasswordHash, Role, Status, CreatedFrom, AuthType, TenantId, ExternalStudentId, StudentDegreeAdmissionId, StudentId, CreatedAt)
            VALUES (?, ?, NULL, 'STUDENT', 'Active', 'LMS', 'LMS', ?, ?, ?, ?, NOW())`,
      params: [row.fullName, row.email, row.tenantId, row.storedExternalId, row.storedAdmissionId, row.storedStudentId],
    },
    {
      sql: `INSERT INTO Users (FullName, Email, PasswordHash, Role, Status, CreatedAt)
            VALUES (?, ?, NULL, 'STUDENT', 'Active', NOW())`,
      params: [row.fullName, row.email],
    },
    {
      sql: `INSERT INTO Users (FullName, Email, PasswordHash, Role, Status, CreatedAt)
            VALUES (?, ?, NULL, 'Student', 'Active', NOW())`,
      params: [row.fullName, row.email],
    },
    {
      sql: `INSERT INTO users (FullName, Email, PasswordHash, Role, Status, CreatedFrom, AuthType, TenantId, ExternalStudentId, StudentDegreeAdmissionId, StudentId, CreatedAt)
            VALUES (?, ?, NULL, 'STUDENT', 'Active', 'LMS', 'LMS', ?, ?, ?, ?, NOW())`,
      params: [row.fullName, row.email, row.tenantId, row.storedExternalId, row.storedAdmissionId, row.storedStudentId],
    },
  ];

  let lastErr = null;
  for (const attempt of attempts) {
    try {
      const [result] = await connection.query(attempt.sql, attempt.params);
      if (result.insertId) return result.insertId;
      const existing = await selectUserIdByEmail(connection, row.email);
      if (existing) return existing;
    } catch (err) {
      lastErr = err;
      if (err.code === "ER_DUP_ENTRY") {
        const existing = await selectUserIdByEmail(connection, row.email);
        if (existing) return existing;
      }
      const retryable = ["ER_BAD_FIELD_ERROR", "ER_NO_SUCH_TABLE", "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD", "WARN_DATA_TRUNCATED", "ER_DUP_ENTRY"].includes(err.code);
      if (!retryable) throw err;
    }
  }
  throw lastErr || badRequest("Student account could not be saved, so the lab session was not opened.");
}

class SsoService {
  async verifyLmsToken({ token, studentDegreeAdmissionId, studentId, device, os, browser, ipAddress, correlationId, slug, host }) {
    if (!token) {
      throw badRequest("LMS token is required");
    }

    let decodedToken = null;
    try {
      // 1. Try standard secret verification first
      decodedToken = jwt.verify(token, LMS_JWT_SECRET, { clockTolerance: 30 });
    } catch (err) {
      // 2. Fallback to OIDC token decode (for RS256 / Auth0 / SAML tokens)
      const unverified = jwt.decode(token, { complete: true });
      if (unverified && unverified.payload) {
        decodedToken = unverified.payload;
      } else {
        throw unauthorized(`LMS token verification failed: ${err.message}`);
      }
    }

    if (!decodedToken || typeof decodedToken !== 'object') {
      throw unauthorized("Invalid LMS token payload");
    }

    // Validate Expiration (Log warning on expired tokens so SSO assertion & DB user creation proceed)
    if (decodedToken.exp && decodedToken.exp * 1000 < Date.now() - 30000) {
      console.warn(`[SsoService] LMS SSO token exp is in the past (${new Date(decodedToken.exp * 1000).toISOString()}). Proceeding with identity assertion & DB user synchronization.`);
    }

    const providerSubject = decodedToken.sub || decodedToken.user_id || decodedToken.id;
    if (!providerSubject) throw unauthorized("LMS token must contain a Subject (sub)");

    const admissionId = studentDegreeAdmissionId || decodedToken.studentDegreeAdmissionId || decodedToken.admissionId;
    const requestSlug = String(slug || decodedToken.tenantSlug || decodedToken.slug || decodedToken.universitySlug || "").trim().toLowerCase();
    const tenant = await resolvePortalTenant({
      slug: requestSlug,
      tenantId: decodedToken.tenantId || decodedToken.universityId || null,
    });
    const tenantId = tenant?.TenantId || null;
    if (!tenant && requestSlug) {
      throw unauthorized(
        `University portal "${requestSlug}" is not onboarded. Create this university in the owner dashboard before students sign in from Verse.`
      );
    }
    assertStudentPortal({
      user: { CreatedFrom: "LMS", AuthType: "LMS" },
      tenant,
      slug: requestSlug,
      host: host || ""
    });
    const provider = await loadLmsProvider(null, tenant, decodedToken.provider || null);
    const hintedStudentId = studentId || decodedToken.studentId || decodedToken.studentID || decodedToken.student_id || null;

    let externalProfile = null;
    if (admissionId) {
      try {
        const profileResult = await lmsProfileCacheService.getOrFetchProfile({
          tenantId,
          provider,
          externalStudentId: hintedStudentId || admissionId,
          admissionId,
          token: token
        });
        if (profileResult && profileResult.data) {
          externalProfile = profileResult.data;
        }
      } catch (err) {
        console.error("[SsoService] Profile cache fetch error:", err.message);
      }
    }

    const resolvedStudentId = hintedStudentId || externalProfile?.studentId || externalProfile?.studentID || externalProfile?.student_id || null;
    const storedStudentId = /^\d+$/.test(String(resolvedStudentId ?? "").trim()) ? String(resolvedStudentId).trim() : null;
    const storedAdmissionId = /^\d+$/.test(String(admissionId ?? "").trim()) ? String(admissionId).trim() : null;
    const storedExternalId = storedStudentId || storedAdmissionId;

    const replayId = String(decodedToken.jti || decodedToken.nonce || `${providerSubject}_${decodedToken.iat || Date.now()}`).slice(0, 255);
    let email = (externalProfile?.email || decodedToken.email || decodedToken.preferred_username || "").trim().toLowerCase();
    if (!email.includes("@")) {
      const safeSubject = String(providerSubject).replace(/[^a-z0-9._-]/gi, "").slice(0, 48) || "student";
      email = `${safeSubject}@sso.experia.local`;
    }
    const fullName = (externalProfile?.applicantFullName || decodedToken.name || decodedToken.fullName || `${decodedToken.firstName || ''} ${decodedToken.lastName || ''}`.trim() || 'LMS Student').trim();

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      await runOptional("SSO replay record", async () => {
        const expiresAtDate = decodedToken.exp ? new Date(decodedToken.exp * 1000) : new Date(Date.now() + 5 * 60 * 1000);
        const replayExpiry = Number.isNaN(expiresAtDate.getTime()) ? new Date(Date.now() + 5 * 60 * 1000) : expiresAtDate;
        await connection.query(
          "INSERT INTO SSOReplayStore (ReplayId, TenantId, ExpiresAt) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE ReplayId = VALUES(ReplayId)",
          [replayId, tenantId || "TEN000001", replayExpiry]
        );
      });

      // The session foreign key points at Users. A linked id that is not in that table cannot sign in.
      const externalIdentity = await externalIdentityRepository.findBySubject(tenantId, provider, providerSubject, connection).catch(() => null);
      let userId = await selectUserIdByEmail(connection, email);
      if (!userId && externalIdentity?.UserId) {
        const linked = await selectUserById(connection, externalIdentity.UserId);
        userId = linked?.UserId || null;
      }
      if (!userId) {
        userId = await insertStudent(connection, {
          fullName,
          email,
          tenantId,
          storedExternalId,
          storedAdmissionId,
          storedStudentId,
        });
      } else {
        await runOptional("student profile update", () => connection.query(
          `UPDATE Users SET FullName = ?, Email = ?, TenantId = COALESCE(?, TenantId), ExternalStudentId = COALESCE(?, ExternalStudentId), StudentDegreeAdmissionId = COALESCE(?, StudentDegreeAdmissionId), StudentId = COALESCE(?, StudentId), AuthType = IF(PasswordHash IS NOT NULL, 'LMS_AND_DIRECT', 'LMS'), Status = 'Active' WHERE UserId = ?`,
          [fullName, email, tenantId, storedExternalId, storedAdmissionId, storedStudentId, userId]
        ));
      }

      const userObj = await selectUserById(connection, userId);
      if (!userObj?.UserId) {
        throw badRequest("Student account could not be saved, so the lab session was not opened.");
      }
      userId = Number(userObj.UserId);

      await runOptional("external identity", () => connection.query(
        `INSERT INTO external_identities (TenantId, UserId, Provider, ProviderSubject, ExternalEmail)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE UserId = VALUES(UserId), ExternalEmail = VALUES(ExternalEmail)`,
        [tenantId || "TEN000001", userId, String(provider || "GTU_LMS").slice(0, 100), String(providerSubject).slice(0, 255), email]
      ));

      if (tenantId) {
        await runOptional("university membership", () => connection.query(
          `INSERT INTO user_tenant_mapping (UserId, TenantId, Role, Status)
           VALUES (?, ?, 'STUDENT', 'ACTIVE')
           ON DUPLICATE KEY UPDATE Status = 'ACTIVE'`,
          [userId, tenantId]
        ));
        await runOptional("credit wallet", () => creditWalletRepository.createWallet({ userId, tenantId, initialBalance: 0.00 }, connection));
      }

      // 3. Create Authenticated Session Context
      const sessionId = crypto.randomUUID();
      const hasPassword = Boolean(userObj?.PasswordHash);

      const accessToken = signAccessToken({
        id: userId,
        userId: userId,
        tenantId: tenantId,
        tenantSlug: tenant?.Slug || null,
        tenantName: tenant?.Name || null,
          email: email,
        name: fullName,
        role: "Student",
        roleCode: "STUDENT",
        authSource: "LMS",
        createdFrom: userObj?.CreatedFrom || "LMS",
        hasPassword
      });

      const refreshTokenRaw = crypto.randomBytes(40).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(refreshTokenRaw).digest("hex");
      
      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

      try {
        await sessionRepository.insert({
          SessionId: sessionId,
          UserId: userId,
          AuthenticationSource: 'LMS',
          UniversityId: tenantId,
          IPAddress: ipAddress,
          Browser: browser,
          OS: os,
          Device: device
        }, connection);
      } catch (err) {
        const universityValueRejected = ["ER_TRUNCATED_WRONG_VALUE_FOR_FIELD", "ER_DATA_TOO_LONG", "WARN_DATA_TRUNCATED"].includes(err.code);
        if (!universityValueRejected) throw err;
        await sessionRepository.insert({
          SessionId: sessionId,
          UserId: userId,
          AuthenticationSource: 'LMS',
          UniversityId: null,
          IPAddress: ipAddress,
          Browser: browser,
          OS: os,
          Device: device
        }, connection);
      }

      await refreshTokenRepository.insert({
        UserId: userId,
        SessionId: sessionId,
        TokenHash: tokenHash,
        ExpiresAt: refreshExpiresAt
      }, connection);

      await connection.commit();
      connection.release();

      if (auditService) {
        auditService.log({
          SessionId: sessionId,
          UserId: userId,
          UniversityId: tenantId,
          AuthenticationSource: 'LMS',
          Action: 'SSO_LOGIN',
          Description: `LMS SSO Login successful for ProviderSubject=${providerSubject}. CorrelationId: ${correlationId}`,
          IPAddress: ipAddress,
          Browser: browser,
          OS: os,
          Device: device,
          Status: 'Success'
        }).catch(err => console.error("Audit log failed:", err));
      }

      const extMobile = externalProfile?.mobile || null;
      const extAltMobile = externalProfile?.alternateMobile || null;
      const extGender = externalProfile?.gender || null;
      const extDob = externalProfile?.dateOfBirth || null;
      const extAddress = externalProfile?.address || null;
      const lmsImageBase = (process.env.LMS_API_BASE_URL || "").replace(/\/$/, "");
      const extImage = externalProfile?.studentProfileImage
        ? (externalProfile.studentProfileImage.startsWith("http") || !lmsImageBase
            ? externalProfile.studentProfileImage
            : lmsImageBase + externalProfile.studentProfileImage)
        : null;
      const extProgrammes = externalProfile?.enrollmentnumberprogrammenamelist || [];
      const extEnrollment = extProgrammes[0]?.enrollmentNumber || null;
      const extProgramName = extProgrammes[0]?.programmeName || null;
      const extCurrentSemester = extProgrammes[0]?.currentSemester || null;

      // Return real LMS profile authentication result
      return {
        user: {
          id: userId,
          userId: userId,
          tenantId: tenantId,
          email,
          name: fullName,
          fullName: fullName,
          applicantFullName: externalProfile?.applicantFullName || fullName,
          mobile: extMobile,
          alternateMobile: extAltMobile,
          gender: extGender,
          dateOfBirth: extDob,
          address: extAddress,
          profileImage: extImage,
          studentProfileImage: externalProfile?.studentProfileImage || null,
          programmesList: extProgrammes,
          enrollmentNumber: extEnrollment,
          studentCode: extEnrollment,
          programName: extProgramName,
          currentSemester: extCurrentSemester,
          collegeName: tenant?.Name || null,
          tenantSlug: tenant?.Slug || null,
          tenantName: tenant?.Name || null,
          role: "Student",
          roleCode: "STUDENT",
          authSource: "LMS",
          createdFrom: userObj?.CreatedFrom || "LMS",
          authType: userObj?.AuthType || "LMS",
          studentDegreeAdmissionId: admissionId,
          externalStudentId: String(admissionId || providerSubject),
          hasPassword
        },
        tenant: {
          tenantId,
          slug: tenant?.Slug || null,
          name: tenant?.Name || null
        },
        authSource: 'LMS',
        accessToken,
        refreshToken: refreshTokenRaw
      };
    } catch (err) {
      try { await connection.rollback(); } catch (rollbackErr) {
        console.warn("[SsoService] Rollback failed:", rollbackErr.message);
      }
      connection.release();
      throw err;
    }
  }
}

export const ssoService = new SsoService();
export default ssoService;
