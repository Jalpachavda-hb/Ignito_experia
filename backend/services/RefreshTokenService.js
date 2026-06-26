import crypto from "crypto";
import pool from "../lib/mysql.js";
import { sessionPolicy } from "../config/sessionPolicy.js";
import { sessionService } from "./SessionService.js";
import { unauthorized } from "../lib/errors.js";
import { auditService } from "./AuditService.js";

class RefreshTokenService {
  async createRefreshToken(profileId, sessionId, connection = pool) {
    const rawToken = crypto.randomBytes(40).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    
    const expiresAt = new Date(Date.now() + sessionPolicy.RefreshTokenTTL * 1000);

    await connection.query(
      `INSERT INTO RefreshTokens (StudentProfileId, SessionId, TokenHash, ExpiresAt) 
       VALUES (?, ?, ?, ?)`,
      [profileId, sessionId, tokenHash, expiresAt]
    );

    return rawToken;
  }

  async rotateToken(oldRawToken, ipAddress) {
    const oldTokenHash = crypto.createHash("sha256").update(oldRawToken).digest("hex");

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const [tokens] = await connection.query(
        "SELECT * FROM RefreshTokens WHERE TokenHash = ?",
        [oldTokenHash]
      );

      if (!tokens || tokens.length === 0) {
        throw unauthorized("Invalid refresh token");
      }

      const tokenData = tokens[0];

      // Reuse Detection
      if (tokenData.RevokedAt) {
        // Token was already used/revoked! This is a massive red flag (stolen token replay).
        // Revoke ALL sessions for this user.
        await sessionService.revokeAllUserSessions(tokenData.StudentProfileId, 'INVALID_TOKEN', connection);
        await auditService.log({ StudentProfileId: tokenData.StudentProfileId, Action: 'STOLEN_TOKEN_REUSE_DETECTED', Module: 'Auth', Severity: 'Critical' });
        
        throw unauthorized("Token reuse detected. All sessions terminated for security.");
      }

      if (new Date() > tokenData.ExpiresAt) {
        // Mark session expired
        await sessionService.revokeSession(tokenData.SessionId, 'EXPIRED', connection);
        throw unauthorized("Refresh token expired");
      }

      // Check if session is still valid
      const [sessions] = await connection.query(
        "SELECT Status FROM StudentSessions WHERE SessionId = ?",
        [tokenData.SessionId]
      );

      if (!sessions || sessions.length === 0 || sessions[0].Status !== 'ACTIVE') {
        throw unauthorized("Session is no longer active");
      }

      // 1. Invalidate old token (if rotation enabled)
      if (sessionPolicy.RefreshRotationEnabled) {
        await connection.query(
          "UPDATE RefreshTokens SET RevokedAt = NOW() WHERE Id = ?",
          [tokenData.Id]
        );
      }

      // 2. Generate new token
      const newRawToken = await this.createRefreshToken(tokenData.StudentProfileId, tokenData.SessionId, connection);

      // 3. Update session timeline
      await connection.query(
        "UPDATE StudentSessions SET LastRefresh = NOW(), LastActivity = NOW(), IPAddress = ? WHERE SessionId = ?",
        [ipAddress, tokenData.SessionId]
      );

      // 4. Log audit
      await auditService.log({ StudentProfileId: tokenData.StudentProfileId, Action: 'TOKEN_REFRESH', Module: 'Auth' });

      await connection.commit();
      connection.release();

      return {
        newRawToken,
        profileId: tokenData.StudentProfileId,
        sessionId: tokenData.SessionId
      };
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  }
}

export const refreshTokenService = new RefreshTokenService();
export default refreshTokenService;
