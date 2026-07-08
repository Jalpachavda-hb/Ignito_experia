import pool from "../lib/mysql.js";

class UserRepository {
  async findByEmail(email) {
    const params = [email.toLowerCase()];
    let rows;
    try {
      [rows] = await pool.query(
        "SELECT * FROM Users WHERE LOWER(Email) = ? AND COALESCE(IsDeleted, 0) = 0",
        params,
      );
    } catch (err) {
      if (err?.code !== "ER_BAD_FIELD_ERROR") throw err;
      [rows] = await pool.query(
        "SELECT * FROM Users WHERE LOWER(Email) = ?",
        params,
      );
    }
    if (!rows.length) return null;
    return rows[0];
  }

  async findById(userId) {
    const [rows] = await pool.query("CALL sp_User_GetById(?)", [userId]);
    // rows[0] contains the result set from the stored procedure
    if (!rows[0] || !rows[0].length) return null;
    return rows[0][0];
  }

  async getAll(params = {}) {
    const {
      page = 1,
      pageSize = 10,
      search = null,
      role = null,
      status = null,
      programId = null,
      semesterId = null,
      sortBy = 'CreatedAt',
      sortOrder = 'desc'
    } = params;

    const [rows] = await pool.query(
      "CALL sp_User_GetAll(?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [page, pageSize, search, role, status, programId, semesterId, sortBy, sortOrder]
    );

    const data = rows[0] || [];
    const total = data.length > 0 ? data[0].TotalRecords : 0;
    
    return { data, total };
  }

  async insert(userData) {
    const { fullName, email, phoneNumber = null, passwordHash, roleId, status = 'Active', enrollmentNumber = null, programId = null, semesterId = null, createdBy = null } = userData;

    const [result] = await pool.query(
      "CALL sp_User_Insert(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @newUserId);",
      [fullName, email, phoneNumber, passwordHash, roleId, status, enrollmentNumber, programId, semesterId, createdBy]
    );
    
    // Fetch the OUT parameter
    const [outRows] = await pool.query("SELECT @newUserId AS newUserId;");
    const newUserId = outRows[0].newUserId;
    
    return this.findById(newUserId);
  }

  async update(userId, userData) {
    const { fullName, phoneNumber, roleId, enrollmentNumber, programId, semesterId, updatedBy } = userData;
    await pool.query(
      "CALL sp_User_Update(?, ?, ?, ?, ?, ?, ?, ?)",
      [userId, fullName, phoneNumber, roleId, enrollmentNumber, programId, semesterId, updatedBy]
    );
    return this.findById(userId);
  }

  async updateStatus(userId, status, updatedBy = null) {
    await pool.query(
      "CALL sp_User_UpdateStatus(?, ?, ?)",
      [userId, status, updatedBy]
    );
    return this.findById(userId);
  }

  async delete(userId, deletedBy = null) {
    await pool.query(
      "CALL sp_User_Delete(?, ?)",
      [userId, deletedBy]
    );
  }

  async updateLastLogin(userId) {
    await pool.query(
      "UPDATE Users SET LastLoginAt = NOW() WHERE UserId = ?",
      [userId]
    );
  }

  async insertRefreshToken(userId, token, expiresAt) {
    await pool.query(
      "INSERT INTO UserRefreshTokens (UserId, RefreshToken, ExpiresAt) VALUES (?, ?, ?)",
      [userId, token, expiresAt]
    );
  }

  async findRefreshToken(token) {
    const [rows] = await pool.query(
      "SELECT * FROM UserRefreshTokens WHERE RefreshToken = ? AND IsRevoked = 0 AND ExpiresAt > NOW()",
      [token]
    );
    return rows[0] || null;
  }

  async revokeRefreshToken(token) {
    await pool.query(
      "UPDATE UserRefreshTokens SET IsRevoked = 1 WHERE RefreshToken = ?",
      [token]
    );
  }

  async revokeAllRefreshTokensForUser(userId) {
    await pool.query(
      "UPDATE UserRefreshTokens SET IsRevoked = 1 WHERE UserId = ?",
      [userId]
    );
  }

  async updatePassword(userId, passwordHash) {
    await pool.query(
      "UPDATE Users SET PasswordHash = ?, UpdatedAt = NOW() WHERE UserId = ?",
      [passwordHash, userId]
    );
  }
  async addCredits(userId, amount) {
    await pool.query(
      "CALL sp_User_AddCredits(?, ?)",
      [userId, amount]
    );
    return this.findById(userId);
  }
}

export const userRepository = new UserRepository();
export default userRepository;
