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
import { lmsProgrammeService } from "./lms/LmsProgrammeService.js";
import { mergeProgrammes } from "./lms/programmeNormalize.js";
import { rememberStudentLmsToken } from "./lms/studentLmsToken.js";
import {
  assertStudentPortal,
  loadLmsProvider,
  resolvePortalTenant,
} from "../lib/studentAccess.js";

import { verifyLmsSsoToken } from "../lib/lmsSsoVerifier.js";

function cleanId(value) {
  const text = value == null ? "" : String(value).trim();
  return text && text !== "null" && text !== "undefined" ? text : null;
}

async function runOptional(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`[SsoService] ${label} skipped:`, err.message);
  }
}

function quoteIdent(name) {
  if (!/^[A-Za-z0-9_]+$/.test(String(name || ""))) {
    throw badRequest("Student account table name is invalid.");
  }
  return `\`${name}\``;
}

/** StudentSessions.UserId must exist in the table this foreign key names, not a second users table. */
async function sessionUserTable(connection) {
  try {
    const [rows] = await connection.query(
      `SELECT REFERENCED_TABLE_NAME AS tableName
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'StudentSessions'
         AND CONSTRAINT_NAME = 'FK_StudentSessions_UserId'
         AND REFERENCED_TABLE_NAME IS NOT NULL
       LIMIT 1`
    );
    if (rows[0]?.tableName) return rows[0].tableName;
  } catch (err) {
    console.warn("[SsoService] Could not read StudentSessions foreign key:", err.message);
  }
  return "Users";
}

async function selectUserIdByEmail(connection, table, email) {
  const [rows] = await connection.query(
    `SELECT UserId FROM ${quoteIdent(table)} WHERE LOWER(TRIM(Email)) = ? LIMIT 1`,
    [email]
  );
  return rows[0]?.UserId || null;
}

async function selectUserById(connection, table, userId) {
  const [rows] = await connection.query(
    `SELECT UserId, PasswordHash, CreatedFrom, AuthType FROM ${quoteIdent(table)} WHERE UserId = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function insertStudent(connection, table, row) {
  const quoted = quoteIdent(table);
  const attempts = [
    {
      sql: `INSERT INTO ${quoted} (FullName, Email, PasswordHash, Role, Status, CreatedFrom, AuthType, TenantId, ExternalStudentId, StudentDegreeAdmissionId, StudentId, CreatedAt)
            VALUES (?, ?, NULL, 'STUDENT', 'Active', 'LMS', 'LMS', ?, ?, ?, ?, NOW())`,
      params: [row.fullName, row.email, row.tenantId, row.storedExternalId, row.storedAdmissionId, row.storedStudentId],
    },
    {
      sql: `INSERT INTO ${quoted} (FullName, Email, PasswordHash, Role, Status, CreatedAt)
            VALUES (?, ?, NULL, 'STUDENT', 'Active', NOW())`,
      params: [row.fullName, row.email],
    },
    {
      sql: `INSERT INTO ${quoted} (FullName, Email, PasswordHash, Role, Status, CreatedAt)
            VALUES (?, ?, NULL, 'Student', 'Active', NOW())`,
      params: [row.fullName, row.email],
    },
  ];

  let lastErr = null;
  for (const attempt of attempts) {
    try {
      const [result] = await connection.query(attempt.sql, attempt.params);
      if (result.insertId) return result.insertId;
      const existing = await selectUserIdByEmail(connection, table, row.email);
      if (existing) return existing;
    } catch (err) {
      lastErr = err;
      if (err.code === "ER_DUP_ENTRY") {
        const existing = await selectUserIdByEmail(connection, table, row.email);
        if (existing) return existing;
      }
      const retryable = ["ER_BAD_FIELD_ERROR", "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD", "WARN_DATA_TRUNCATED", "ER_DUP_ENTRY"].includes(err.code);
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

    // Signature, issuer and expiry are verified here (HS* with LMS_JWT_SECRET, RS*/ES* via the issuer's JWKS).
    // An unsigned, forged or expired token is rejected; there is no decode-only fallback.
    const decodedToken = await verifyLmsSsoToken(token);
    if (!decodedToken || typeof decodedToken !== 'object') {
      throw unauthorized("Invalid LMS token payload");
    }

    const providerSubject = decodedToken.sub || decodedToken.user_id || decodedToken.id;
    if (!providerSubject) throw unauthorized("LMS token must contain a Subject (sub)");

    // Identity binding: ids inside the signed token always win. Ids from the request body are only
    // hints, and must not contradict the token (otherwise one student could sign in as another).
    const tokenAdmissionId = cleanId(decodedToken.studentDegreeAdmissionId || decodedToken.admissionId);
    const tokenStudentId = cleanId(
      decodedToken.studentId || decodedToken.studentID || decodedToken.StudentId || decodedToken.student_id || decodedToken.lmsStudentId
    );
    const bodyAdmissionId = cleanId(studentDegreeAdmissionId);
    const bodyStudentId = cleanId(studentId);
    if ((tokenAdmissionId && bodyAdmissionId && tokenAdmissionId !== bodyAdmissionId) ||
        (tokenStudentId && bodyStudentId && tokenStudentId !== bodyStudentId)) {
      throw unauthorized("The student id in the request does not match the LMS sign-in token.");
    }
    const tokenEmail = String(decodedToken.email || "").trim().toLowerCase();
    const idsFromBodyOnly = !tokenAdmissionId && !tokenStudentId && Boolean(bodyAdmissionId || bodyStudentId);
    const admissionId = tokenAdmissionId || bodyAdmissionId;
    const requestSlug = String(slug || decodedToken.tenantSlug || decodedToken.slug || decodedToken.universitySlug || "").trim().toLowerCase();
    const tenant = await resolvePortalTenant({
      slug: requestSlug,
      tenantId: decodedToken.tenantId || decodedToken.universityId || null,
      host,
    });
    if (!tenant?.TenantId) {
      throw unauthorized("University portal could not be identified from database for this account.");
    }
    const tenantId = tenant.TenantId;
    assertStudentPortal({
      user: { CreatedFrom: "LMS", AuthType: "LMS" },
      tenant,
      slug: requestSlug || tenant.Slug,
      host: host || ""
    });
    const provider = await loadLmsProvider(null, tenant, decodedToken.provider || null);
    const hintedStudentId = tokenStudentId || bodyStudentId || null;

    let externalProfile = null;
    if (admissionId) {
      try {
        const profileResult = await lmsProfileCacheService.getOrFetchProfile({
          tenantId,
          provider,
          externalStudentId: hintedStudentId || admissionId,
          admissionId,
          studentId: hintedStudentId,
          token: token
        });
        if (profileResult && profileResult.data) {
          externalProfile = profileResult.data;
        }
      } catch (err) {
        console.error("[SsoService] Profile cache fetch error:", err.message);
      }
    }

    if (idsFromBodyOnly) {
      const profileEmail = String(externalProfile?.email || "").trim().toLowerCase();
      if (tokenEmail && profileEmail && tokenEmail !== profileEmail) {
        throw unauthorized("The student id in the request does not belong to this LMS account.");
      }
      if (!tokenEmail) {
        // The token carries no student id and no email, so the body ids cannot be bound to it.
        console.warn(`[SsoService] SSO identity for subject ${String(providerSubject).slice(0, 64)} relies on request ids that the token cannot confirm (tenant=${tenantId}).`);
      }
    }

    const resolvedStudentId = hintedStudentId
      || externalProfile?.studentId
      || externalProfile?.studentID
      || externalProfile?.StudentId
      || externalProfile?.student_id
      || null;
    const storedStudentId = resolvedStudentId != null && String(resolvedStudentId).trim() ? String(resolvedStudentId).trim() : null;
    const storedAdmissionId = admissionId != null && String(admissionId).trim() ? String(admissionId).trim() : null;
    const storedExternalId = storedStudentId || storedAdmissionId || String(providerSubject);

    const replayId = String(decodedToken.jti || decodedToken.nonce || `${providerSubject}_${decodedToken.iat || Date.now()}`).slice(0, 255);
    // The signed token's email is the account key when present; the LMS profile email is the fallback.
    let email = (tokenEmail || externalProfile?.email || decodedToken.preferred_username || "").trim().toLowerCase();
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
          [replayId, tenantId, replayExpiry]
        );
      });

      // StudentSessions.UserId can only reference the table named by FK_StudentSessions_UserId.
      const userTable = await sessionUserTable(connection);
      const externalIdentity = await externalIdentityRepository.findBySubject(tenantId, provider, providerSubject, connection).catch(() => null);
      // The verified (tenant, provider, subject) link is the strongest key, so it is checked first;
      // email matching only links a first SSO login to an existing account.
      let userId = null;
      if (externalIdentity?.UserId) {
        const linked = await selectUserById(connection, userTable, externalIdentity.UserId);
        userId = linked?.UserId || null;
      }
      if (!userId) userId = await selectUserIdByEmail(connection, userTable, email);
      if (!userId) {
        userId = await insertStudent(connection, userTable, {
          fullName,
          email,
          tenantId,
          storedExternalId,
          storedAdmissionId,
          storedStudentId,
        });
      } else {
        await runOptional("student profile update", () => connection.query(
          `UPDATE ${quoteIdent(userTable)} SET FullName = ?, Email = ?, TenantId = COALESCE(?, TenantId), ExternalStudentId = COALESCE(?, ExternalStudentId), StudentDegreeAdmissionId = COALESCE(?, StudentDegreeAdmissionId), StudentId = COALESCE(?, StudentId), AuthType = IF(PasswordHash IS NOT NULL, 'LMS_AND_DIRECT', 'LMS'), Status = 'Active' WHERE UserId = ?`,
          [fullName, email, tenantId, storedExternalId, storedAdmissionId, storedStudentId, userId]
        ));
      }

      const userObj = await selectUserById(connection, userTable, userId);
      if (!userObj?.UserId) {
        throw badRequest("Student account could not be saved, so the lab session was not opened.");
      }
      userId = Number(userObj.UserId);
      rememberStudentLmsToken(userId, token);
      // Commit the student before the session. The foreign key only accepts a saved Users row.
      await connection.commit();
      await connection.beginTransaction();

      // Auto-provision initial university lab wallets for LMS student
      try {
        const [mappings] = await connection.query(
          `SELECT DISTINCT lab_id, course_code, practical_credit FROM course_lab_mappings WHERE tenant_id = ? OR tenant_id = 'PLATFORM'`,
          [tenantId || 'PLATFORM']
        );
        // Same rows and values as before, written in one statement instead of one per mapping.
        const walletRows = new Map();
        for (const m of mappings) {
          const rawLabId = String(m.lab_id).toLowerCase().trim();
          const cleanLabId = rawLabId.replace(/^lab-/, '').replace(/-lab$/, '');
          const codeStr = String(m.course_code || '').toUpperCase();
          const defaultCred = (cleanLabId.includes('dbms') || codeStr.includes('4031')) ? 90 : ((cleanLabId.includes('dotnet') || codeStr.includes('4011')) ? 80 : 60);
          const practicalCredit = Number(m.practical_credit || defaultCred);
          // Several mappings can name the same lab; the per-row upsert kept the largest grant.
          const prev = walletRows.get(cleanLabId);
          if (prev == null || practicalCredit > prev) walletRows.set(cleanLabId, practicalCredit);
        }
        if (walletRows.size) {
          const values = [];
          const params = [];
          for (const [labId, credit] of walletRows) {
            values.push("(?, ?, ?, ?, 0, ?, 1)");
            params.push(tenantId || 'DEFAULT', String(userId), labId, credit, credit);
          }
          await connection.query(
            `INSERT INTO student_lab_token_wallets (TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, RemainingTokens, Version)
             VALUES ${values.join(", ")}
             ON DUPLICATE KEY UPDATE
               TotalPurchasedTokens = IF(TotalPurchasedTokens < VALUES(TotalPurchasedTokens), VALUES(TotalPurchasedTokens), TotalPurchasedTokens),
               RemainingTokens = CASE WHEN CAST(TotalPurchasedTokens AS SIGNED) >= CAST(ConsumedTokens AS SIGNED) THEN CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED) ELSE 0 END`,
            params
          );
        }
      } catch (e) {
        console.warn("[SsoService] Auto-provisioning lab wallets skipped:", e.message);
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

      await runOptional("external identity", () => connection.query(
        `INSERT INTO external_identities (TenantId, UserId, Provider, ProviderSubject, ExternalEmail)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE UserId = VALUES(UserId), ExternalEmail = VALUES(ExternalEmail)`,
        [tenantId, userId, String(provider || "LMS").slice(0, 100), String(providerSubject).slice(0, 255), email]
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
      let purchasedProgrammes = [];
      if (storedStudentId) {
        try {
          const purchased = await lmsProgrammeService.getPurchased({
            tenantId,
            provider,
            studentId: storedStudentId,
            bearerToken: token,
          });
          if (purchased?.lmsStatus === "LIVE") {
            purchasedProgrammes = purchased.programmeList || purchased.programList || [];
          }
        } catch (err) {
          console.warn("[SsoService] purchased programmes skipped:", err.message);
        }
      }
      const extProgrammes = mergeProgrammes(
        Array.isArray(externalProfile?.enrollmentnumberprogrammenamelist) ? externalProfile.enrollmentnumberprogrammenamelist : [],
        purchasedProgrammes.length ? { programmeList: purchasedProgrammes } : null
      );
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
          studentId: storedStudentId,
          studentDegreeAdmissionId: storedAdmissionId || admissionId,
          externalStudentId: String(storedExternalId || admissionId || providerSubject),
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
