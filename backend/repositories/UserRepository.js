import pool from "../lib/mysql.js";

export function normalizeRoleForClient(role) {
  if (role === 'SuperAdmin') return 'Super Admin';
  if (role === 'TenantAdmin') return 'Tenant Admin';
  return role;
}

export function normalizeRoleForDb(role) {
  if (role === 'Super Admin') return 'SuperAdmin';
  if (role === 'Tenant Admin') return 'TenantAdmin';
  return role;
}

class UserRepository {
  async findByEmail(email) {
    const [rows] = await pool.query(
      "SELECT * FROM Users WHERE LOWER(Email) = ?",
      [email.toLowerCase()]
    );
    if (!rows.length) return null;
    const user = rows[0];
    user.Role = normalizeRoleForClient(user.Role);
    return user;
  }

  async findById(userId) {
    const [rows] = await pool.query(
      "SELECT * FROM Users WHERE UserId = ?",
      [userId]
    );
    if (!rows.length) return null;
    const user = rows[0];
    user.Role = normalizeRoleForClient(user.Role);
    return user;
  }

  async getAll() {
    const [rows] = await pool.query(
      "SELECT UserId, FullName, Email, Role, Status, ProgramId, SemesterId, LastLoginAt, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy FROM Users"
    );
    return rows.map(user => ({
      ...user,
      Role: normalizeRoleForClient(user.Role)
    }));
  }

  async insert(userData) {
    const { fullName, email, passwordHash, role, status = 'Active', programId = null, semesterId = null, createdBy = null } = userData;
    const dbRole = normalizeRoleForDb(role);
    const clientRole = normalizeRoleForClient(role);

    // Look up the corresponding RoleId from Roles table
    const [roles] = await pool.query("SELECT RoleId FROM Roles WHERE Name = ?", [clientRole]);
    const roleId = roles.length ? roles[0].RoleId : null;

    const [result] = await pool.query(
      `INSERT INTO Users (FullName, Email, PasswordHash, Role, RoleId, Status, ProgramId, SemesterId, CreatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fullName, email, passwordHash, dbRole, roleId, status, programId, semesterId, createdBy]
    );
    
    const newUserId = result.insertId;
    return this.findById(newUserId);
  }

  async updateStatus(userId, status, updatedBy = null) {
    await pool.query(
      "UPDATE Users SET Status = ?, UpdatedBy = ? WHERE UserId = ?",
      [status, updatedBy, userId]
    );
    return this.findById(userId);
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
}

export const userRepository = new UserRepository();
export default userRepository;
