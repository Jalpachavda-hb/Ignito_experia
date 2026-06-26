import pool from "../lib/mysql.js";

class RefreshTokenRepository {
  async insert(tokenData, connection = pool) {
    const {
      UserId = null,
      StudentProfileId = null,
      SessionId,
      TokenHash,
      ExpiresAt
    } = tokenData;

    const [result] = await connection.query(
      `INSERT INTO RefreshTokens (
        UserId, StudentProfileId, SessionId, TokenHash, ExpiresAt
      ) VALUES (?, ?, ?, ?, ?)`,
      [UserId, StudentProfileId, SessionId, TokenHash, ExpiresAt]
    );

    return result.insertId;
  }

  async findByTokenHash(tokenHash) {
    const [rows] = await pool.query(
      "SELECT * FROM RefreshTokens WHERE TokenHash = ? AND RevokedAt IS NULL AND ExpiresAt > NOW()",
      [tokenHash]
    );
    return rows[0] || null;
  }

  async revoke(tokenId, connection = pool) {
    await connection.query(
      "UPDATE RefreshTokens SET RevokedAt = NOW() WHERE Id = ?",
      [tokenId]
    );
  }

  async revokeAllForProfile(profileId, connection = pool) {
    await connection.query(
      "UPDATE RefreshTokens SET RevokedAt = NOW() WHERE StudentProfileId = ? AND RevokedAt IS NULL",
      [profileId]
    );
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
export default refreshTokenRepository;
