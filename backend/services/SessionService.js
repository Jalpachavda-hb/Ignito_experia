import crypto from "crypto";
import pool from "../lib/mysql.js";
import { sessionPolicy } from "../config/sessionPolicy.js";
import { auditService } from "./AuditService.js";
import { notFound, badRequest } from "../lib/errors.js";

class SessionService {
  async registerDevice(profileId, deviceData, connection = pool) {
    // Basic fingerprinting
    const fingerprintString = `${profileId}-${deviceData.ipAddress}-${deviceData.browser}-${deviceData.os}-${deviceData.platform}`;
    const deviceFingerprint = crypto.createHash("sha256").update(fingerprintString).digest("hex");

    const [existing] = await connection.query(
      "SELECT DeviceId FROM RegisteredDevices WHERE DeviceFingerprint = ? AND UserId = ?",
      [deviceFingerprint, profileId]
    );

    let deviceId;
    if (existing && existing.length > 0) {
      deviceId = existing[0].DeviceId;
      await connection.query(
        "UPDATE RegisteredDevices SET LastLogin = NOW() WHERE DeviceId = ?",
        [deviceId]
      );
    } else {
      deviceId = crypto.randomUUID();
      await connection.query(
        `INSERT INTO RegisteredDevices 
         (DeviceId, UserId, DeviceFingerprint, DeviceName, Browser, BrowserVersion, OperatingSystem, OperatingSystemVersion, Platform, IPAddress, Timezone) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deviceId, profileId, deviceFingerprint, deviceData.deviceName || 'Unknown Device',
          deviceData.browser, deviceData.browserVersion, deviceData.os, deviceData.osVersion,
          deviceData.platform, deviceData.ipAddress, deviceData.timezone
        ]
      );
    }
    return deviceId;
  }

  async enforceConcurrentLoginLimit(profileId, newSessionId, connection = pool) {
    const limit = sessionPolicy.ConcurrentLoginLimit;
    
    // Find active sessions
    const [activeSessions] = await connection.query(
      "SELECT SessionId FROM StudentSessions WHERE UserId = ? AND Status = 'ACTIVE' ORDER BY LoginTime ASC",
      [profileId]
    );

    if (sessionPolicy.ForceSingleSession || activeSessions.length >= limit) {
      // Need to revoke oldest sessions until we are under the limit
      const excessCount = sessionPolicy.ForceSingleSession ? activeSessions.length : (activeSessions.length - limit + 1);
      const sessionsToRevoke = activeSessions.slice(0, excessCount);

      for (const session of sessionsToRevoke) {
        if (session.SessionId !== newSessionId) {
          await this.revokeSession(session.SessionId, 'MULTI_DEVICE_LOGIN', connection);
        }
      }
    }
  }

  async revokeSession(sessionId, reasonStatus = 'REVOKED', connection = pool) {
    const [sessionData] = await connection.query(
      "SELECT UserId FROM StudentSessions WHERE SessionId = ?",
      [sessionId]
    );

    if (!sessionData || sessionData.length === 0) return;
    const profileId = sessionData[0].UserId;

    // Update status
    await connection.query(
      "UPDATE StudentSessions SET Status = ?, LogoutTime = NOW() WHERE SessionId = ?",
      [reasonStatus, sessionId]
    );

    // Revoke tokens
    await connection.query(
      "UPDATE RefreshTokens SET RevokedAt = NOW() WHERE SessionId = ? AND RevokedAt IS NULL",
      [sessionId]
    );

    // Log Event
    await auditService.log({ UserId: profileId, Action: reasonStatus, Module: 'Sessions', Status: 'Success' });
  }

  async revokeAllUserSessions(profileId, reasonStatus = 'FORCE_LOGOUT', connection = pool) {
    const [activeSessions] = await connection.query(
      "SELECT SessionId FROM StudentSessions WHERE UserId = ? AND Status = 'ACTIVE'",
      [profileId]
    );

    for (const session of activeSessions) {
      await this.revokeSession(session.SessionId, reasonStatus, connection);
    }
  }

  async forceLogout(sessionId, adminUserId) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const [sessionData] = await connection.query(
        "SELECT UserId FROM StudentSessions WHERE SessionId = ?",
        [sessionId]
      );

      if (!sessionData || sessionData.length === 0) {
        throw notFound("Session not found");
      }

      await this.revokeSession(sessionId, 'FORCE_LOGOUT', connection);

      // Explicitly log the admin who forced the logout
      await auditService.log({ UserId: sessionData[0].UserId, Action: 'FORCE_LOGOUT_BY_ADMIN', UserId: adminUserId, Module: 'Sessions', Status: 'Success' });

      await connection.commit();
      connection.release();
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  }

  async getSessionStatistics() {
    const [totalActive] = await pool.query("SELECT COUNT(*) as count FROM StudentSessions WHERE Status = 'ACTIVE'");
    const [totalExpired] = await pool.query("SELECT COUNT(*) as count FROM StudentSessions WHERE Status IN ('EXPIRED', 'IDLE_TIMEOUT')");
    const [totalForceLogout] = await pool.query("SELECT COUNT(*) as count FROM StudentSessions WHERE Status = 'FORCE_LOGOUT'");
    const [bySource] = await pool.query("SELECT LoginSource, COUNT(*) as count FROM StudentSessions WHERE Status = 'ACTIVE' GROUP BY LoginSource");
    const [byUniversity] = await pool.query("SELECT UniversityId, COUNT(*) as count FROM StudentSessions WHERE Status = 'ACTIVE' GROUP BY UniversityId");

    // Average duration (using LogoutTime or NOW for active)
    const [avgDuration] = await pool.query(`
      SELECT AVG(TIMESTAMPDIFF(MINUTE, LoginTime, COALESCE(LogoutTime, NOW()))) as avgMinutes 
      FROM StudentSessions
    `);

    return {
      activeSessions: totalActive[0].count,
      expiredSessions: totalExpired[0].count,
      forceLogoutCount: totalForceLogout[0].count,
      averageSessionDurationMinutes: Math.round(avgDuration[0].avgMinutes || 0),
      bySource: bySource.reduce((acc, row) => ({ ...acc, [row.LoginSource]: row.count }), {}),
      byUniversity: byUniversity.reduce((acc, row) => ({ ...acc, [row.UniversityId]: row.count }), {})
    };
  }
}

export const sessionService = new SessionService();
export default sessionService;
