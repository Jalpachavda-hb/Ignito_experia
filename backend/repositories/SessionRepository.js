import pool from "../lib/mysql.js";

class SessionRepository {
  async insert(sessionData, connection = pool) {
    const {
      SessionId,
      UserId = null,
      StudentProfileId = null,
      AuthenticationSource = null,
      LoginSource = null,
      UniversityId = null,
      AccessTokenId = null,
      RefreshTokenId = null,
      IPAddress = null,
      DeviceId = null,
      Status = 'ACTIVE'
    } = sessionData;

    const source = LoginSource || AuthenticationSource;

    await connection.query(
      `INSERT INTO StudentSessions (
        SessionId, UserId, StudentProfileId, LoginSource, UniversityId,
        AccessTokenId, RefreshTokenId, IPAddress, DeviceId, Status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        SessionId, UserId, StudentProfileId, source, UniversityId,
        AccessTokenId, RefreshTokenId, IPAddress, DeviceId, Status
      ]
    );

    return SessionId;
  }

  async findById(sessionId) {
    const [rows] = await pool.query(
      "SELECT * FROM StudentSessions WHERE SessionId = ?",
      [sessionId]
    );
    return rows[0] || null;
  }

  async markLogout(sessionId, connection = pool) {
    await connection.query(
      "UPDATE StudentSessions SET LogoutTime = NOW(), Status = 'LoggedOut' WHERE SessionId = ?",
      [sessionId]
    );
  }

  async updateLastActivity(sessionId, connection = pool) {
    await connection.query(
      "UPDATE StudentSessions SET LastActivity = NOW() WHERE SessionId = ?",
      [sessionId]
    );
  }
}

export const sessionRepository = new SessionRepository();
export default sessionRepository;
