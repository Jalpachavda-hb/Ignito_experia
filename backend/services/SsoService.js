import crypto from "crypto";
import jwt from "jsonwebtoken";
import pool from "../lib/mysql.js";
import userRepository from "../repositories/UserRepository.js";
import studentProfileRepository from "../repositories/StudentProfileRepository.js";
import sessionRepository from "../repositories/SessionRepository.js";
import refreshTokenRepository from "../repositories/RefreshTokenRepository.js";
import { auditService } from "./AuditService.js";
import { signAccessToken } from "../lib/jwt.js";
import { unauthorized, badRequest } from "../lib/errors.js";

const LMS_JWT_SECRET = process.env.LMS_JWT_SECRET || "default_lms_secret";
const LMS_ISSUER = process.env.LMS_ISSUER || "university-lms";
const LMS_AUDIENCE = process.env.LMS_AUDIENCE || "ignito-experia";

class SsoService {
  async verifyLmsToken({ token, device, os, browser, ipAddress, correlationId }) {
    if (!token) {
      throw badRequest("LMS token is required");
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, LMS_JWT_SECRET, {
        issuer: LMS_ISSUER,
        audience: LMS_AUDIENCE,
        clockTolerance: 30, // clock skew 30s
      });
    } catch (err) {
      throw unauthorized(`LMS token verification failed: ${err.message}`);
    }

    if (!decodedToken.jti) throw unauthorized("LMS token must contain a JTI (Token ID)");
    if (!decodedToken.sub) throw unauthorized("LMS token must contain a Subject (sub)");
    if (!decodedToken.iat) throw unauthorized("LMS token must contain Issued At (iat)");

    const externalStudentId = decodedToken.sub;
    const email = decodedToken.email;
    const firstName = decodedToken.firstName || decodedToken.name?.split(' ')[0] || '';
    const lastName = decodedToken.lastName || decodedToken.name?.split(' ').slice(1).join(' ') || '';
    const universityId = decodedToken.universityId || decodedToken.university;
    
    // Additional data for sync
    const departmentId = decodedToken.departmentId || null;
    const programId = decodedToken.programId || null;
    const semesterId = decodedToken.semesterId || null;
    const section = decodedToken.section || null;
    const batch = decodedToken.batch || null;
    const status = decodedToken.status || 'Active';

    if (!externalStudentId || !email) {
      throw badRequest("LMS token must contain externalStudentId (sub) and email");
    }

    if (!universityId) {
      throw unauthorized("LMS token must contain a valid university claim");
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Replay Attack Protection Check
      const [existingJti] = await connection.query("SELECT jti FROM UsedLmsTokens WHERE jti = ?", [decodedToken.jti]);
      if (existingJti && existingJti.length > 0) {
        throw unauthorized("Token replay attack detected. This token has already been used.");
      }

      // Calculate expiresAt for UsedLmsTokens
      const tokenExpiresAt = decodedToken.exp ? new Date(decodedToken.exp * 1000) : new Date(Date.now() + 5 * 60 * 1000);
      await connection.query("INSERT INTO UsedLmsTokens (jti, expiresAt) VALUES (?, ?)", [decodedToken.jti, tokenExpiresAt]);

      // Find or Create User (Authentication Identity)
      let user = await userRepository.findByEmail(email);
      let userId;
      if (!user) {
         // Create the identity if it doesn't exist
         const newUser = await userRepository.insert({
           fullName: `${firstName} ${lastName}`.trim(),
           email: email,
           passwordHash: 'LMS_SSO_USER', // Or null if table allows
           role: 'Student',
           status: 'Active'
         }, connection);
         userId = newUser.UserId;
      } else {
         userId = user.UserId;
      }

      // Profile Sync
      let profile = await studentProfileRepository.findByExternalStudentId(externalStudentId);
      if (!profile) {
          // Fallback to searching by UserId to prevent duplicate profiles if email matched
          profile = await studentProfileRepository.findByUserId(userId);
      }

      let profileId;

      if (!profile) {
        profileId = await studentProfileRepository.insert({
          UserId: userId,
          ExternalStudentId: externalStudentId,
          Email: email,
          FirstName: firstName,
          LastName: lastName,
          UniversityId: universityId,
          DepartmentId: departmentId,
          ProgramId: programId,
          SemesterId: semesterId,
          Section: section,
          Batch: batch,
          AuthenticationSource: 'LMS',
          Status: status
        }, connection);
      } else {
        profileId = profile.StudentProfileId;
        const updates = {};
        if (profile.Email !== email) updates.Email = email;
        if (profile.FirstName !== firstName) updates.FirstName = firstName;
        if (profile.LastName !== lastName) updates.LastName = lastName;
        if (profile.DepartmentId !== departmentId) updates.DepartmentId = departmentId;
        if (profile.ProgramId !== programId) updates.ProgramId = programId;
        if (profile.SemesterId !== semesterId) updates.SemesterId = semesterId;
        if (profile.Section !== section) updates.Section = section;
        if (profile.Batch !== batch) updates.Batch = batch;
        if (profile.Status !== status) updates.Status = status;

        if (Object.keys(updates).length > 0) {
          await studentProfileRepository.update(profileId, updates, connection);
        }
      }

      await studentProfileRepository.updateLastLogin(profileId, connection);

      const sessionId = crypto.randomUUID();
      const accessToken = signAccessToken({
        id: userId,
        profileId,
        externalId: externalStudentId,
        email: email,
        name: `${firstName} ${lastName}`,
        role: "Student",
        source: "LMS"
      });

      const refreshTokenRaw = crypto.randomBytes(40).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(refreshTokenRaw).digest("hex");
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await sessionRepository.insert({
        SessionId: sessionId,
        StudentProfileId: profileId,
        AuthenticationSource: 'LMS',
        UniversityId: universityId,
        IPAddress: ipAddress,
        Browser: browser,
        OS: os,
        Device: device
      }, connection);

      await refreshTokenRepository.insert({
        StudentProfileId: profileId,
        SessionId: sessionId,
        TokenHash: tokenHash,
        ExpiresAt: expiresAt
      }, connection);

      // We assume basic permissions for LMS students. A real system resolves via RoleService.
      const permissions = {
        Dashboard: { read: true, create: false, update: false, delete: false },
        Labs: { read: true, create: false, update: false, delete: false }
      };

      await connection.commit();
      connection.release();

      // Audit asynchronously after commit
      if (auditService) {
        auditService.log({
          SessionId: sessionId,
          UserId: userId,
          StudentProfileId: profileId,
          UniversityId: universityId,
          AuthenticationSource: 'LMS',
          Action: 'LMS_LOGIN',
          Description: `LMS SSO Login successful. CorrelationId: ${correlationId}`,
          IPAddress: ipAddress,
          Browser: browser,
          OS: os,
          Device: device,
          Status: 'Success'
        }).catch(err => console.error("Audit log failed:", err));
      }

      return {
        user: {
          id: userId,
          profileId,
          externalId: externalStudentId,
          email,
          name: `${firstName} ${lastName}`.trim(),
          role: "Student",
          source: "LMS",
          departmentId,
          programId,
          semesterId,
          section,
          batch,
          status
        },
        accessToken,
        refreshToken: refreshTokenRaw,
        permissions
      };
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  }
}

export const ssoService = new SsoService();
export default ssoService;
