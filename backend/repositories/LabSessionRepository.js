import pool from "../lib/mysql.js";

class LabSessionRepository {
  async findActiveSessionForUser(userId, tenantId, db = pool) {
    if (!userId) return null;
    const uStr = String(userId);
    const [rows] = await db.query(
      `SELECT SessionId, TenantId, UserId, LabId, AllocatedCredits, AllocatedDurationMinutes,
              FinalCreditsConsumed, StartedAt, ExpiresAt, EndedAt, Status, TenMinuteWarningSent,
              TaskArn, ContainerId, RuntimeUrl, Subtype, CreatedAt, UpdatedAt
       FROM lab_sessions
       WHERE (UserId = ? OR UserId = (SELECT UserId FROM Users WHERE Email = ? LIMIT 1))
         AND (TenantId = ? OR TenantId IS NULL OR TenantId = 'DEFAULT' OR TenantId = 'DIRECT' OR TenantId = 'PLATFORM')
         AND Status IN ('STARTING', 'RUNNING', 'EXPIRING_SOON')
       ORDER BY CreatedAt DESC LIMIT 1`,
      [uStr, uStr, tenantId || 'DEFAULT']
    );
    return rows[0] || null;
  }

  async getSessionById(sessionId, db = pool) {
    if (!sessionId) return null;
    const [rows] = await db.query(
      `SELECT SessionId, TenantId, UserId, LabId, AllocatedCredits, AllocatedDurationMinutes,
              FinalCreditsConsumed, StartedAt, ExpiresAt, EndedAt, Status, TenMinuteWarningSent,
              TaskArn, ContainerId, RuntimeUrl, Subtype, CreatedAt, UpdatedAt
       FROM lab_sessions
       WHERE SessionId = ?`,
      [sessionId]
    );
    return rows[0] || null;
  }

  async createSession({
    sessionId,
    tenantId,
    userId,
    labId,
    allocatedCredits,
    allocatedDurationMinutes,
    startedAt,
    expiresAt,
    subtype = null,
    status = 'STARTING'
  }, db = pool) {
    await db.query(
      `INSERT INTO lab_sessions
       (SessionId, TenantId, UserId, LabId, AllocatedCredits, AllocatedDurationMinutes, StartedAt, ExpiresAt, Subtype, Status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, tenantId, userId, labId, allocatedCredits, allocatedDurationMinutes, startedAt, expiresAt, subtype, status]
    );
    return await this.getSessionById(sessionId, db);
  }

  async updateSession(sessionId, updates, db = pool) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
    if (fields.length === 0) return await this.getSessionById(sessionId, db);
    fields.push("UpdatedAt = CURRENT_TIMESTAMP");
    params.push(sessionId);

    try {
      await db.query(
        `UPDATE lab_sessions SET ${fields.join(", ")} WHERE SessionId = ?`,
        params
      );
    } catch (err) {
      // Fallback: If DB enum does not yet have STOPPED, fallback to COMPLETED
      if (updates.Status === 'STOPPED') {
        try {
          const fallbackUpdates = { ...updates, Status: 'COMPLETED' };
          const fbFields = [];
          const fbParams = [];
          for (const [key, value] of Object.entries(fallbackUpdates)) {
            fbFields.push(`${key} = ?`);
            fbParams.push(value);
          }
          fbFields.push("UpdatedAt = CURRENT_TIMESTAMP");
          fbParams.push(sessionId);
          await db.query(
            `UPDATE lab_sessions SET ${fbFields.join(", ")} WHERE SessionId = ?`,
            fbParams
          );
        } catch (_) {
          throw err;
        }
      } else {
        throw err;
      }
    }
    return await this.getSessionById(sessionId, db);
  }

  async extendSession({ sessionId, additionalCredits, additionalMinutes, newExpiresAt }, db = pool) {
    await db.query(
      `UPDATE lab_sessions
       SET AllocatedCredits = AllocatedCredits + ?,
           AllocatedDurationMinutes = AllocatedDurationMinutes + ?,
           ExpiresAt = ?,
           TenMinuteWarningSent = 0,
           Status = 'RUNNING',
           UpdatedAt = CURRENT_TIMESTAMP
       WHERE SessionId = ?`,
      [additionalCredits, additionalMinutes, newExpiresAt, sessionId]
    );
    return await this.getSessionById(sessionId, db);
  }

  async getExpiredSessions(db = pool) {
    const [rows] = await db.query(
      `SELECT SessionId, TenantId, UserId, LabId, AllocatedCredits, AllocatedDurationMinutes,
              StartedAt, ExpiresAt, TaskArn, Status
       FROM lab_sessions
       WHERE Status IN ('STARTING', 'RUNNING', 'EXPIRING_SOON')
         AND ExpiresAt <= NOW()`
    );
    return rows;
  }
}

export const labSessionRepository = new LabSessionRepository();
export default labSessionRepository;
