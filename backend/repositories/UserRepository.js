import pool from "../lib/mysql.js";

class UserRepository {
  async findByEmail(email) {
    const params = [email.toLowerCase()];
    let rows;
    try {
      [rows] = await pool.query(
        "SELECT * FROM users WHERE LOWER(Email) = ?",
        params,
      );
    } catch (err) {
      [rows] = await pool.query(
        "SELECT * FROM Users WHERE LOWER(Email) = ?",
        params,
      );
    }
    if (!rows || !rows.length) return null;
    return rows[0];
  }

  async findById(userId, connection = pool) {
    const [rows] = await connection.query("CALL sp_User_GetById(?)", [userId]);
    // rows[0] contains the result set from the stored procedure
    if (!rows[0] || !rows[0].length) return null;
    return rows[0][0];
  }

  async getAll(params = {}) {
    const {
      actorRole = null,
      actorTenantId = null,
      filterTenantId = null,
      page = 1,
      pageSize = 10,
      search = null,
      role = null,
      status = null,
      sortBy = 'CreatedAt',
      sortOrder = 'desc'
    } = params;

    const normalizedActorRole = (actorRole || "").toUpperCase().replace(/\s+/g, "_");
    const isSuperAdmin = normalizedActorRole === "SUPER_ADMIN" || normalizedActorRole === "SUPERADMIN" || normalizedActorRole === "SUPER_ADMINISTRATOR";

    let effectiveTenantId = null;

    if (!isSuperAdmin) {
      // TENANT_ADMIN / Non-SuperAdmin must fail closed if tenantId is missing
      if (!actorTenantId) {
        const err = new Error("TENANT_CONTEXT_MISSING");
        err.code = "TENANT_CONTEXT_MISSING";
        throw err;
      }
      effectiveTenantId = actorTenantId;
    } else {
      // SUPER_ADMIN can optionally filter by filterTenantId if not 'ALL'
      if (filterTenantId && filterTenantId !== 'ALL') {
        effectiveTenantId = filterTenantId;
      }
    }

    const limit = Math.max(1, parseInt(pageSize, 10) || 10);
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

    let whereClause = "WHERE COALESCE(u.IsDeleted, 0) = 0";
    const queryParams = [];

    if (effectiveTenantId) {
      whereClause += " AND u.TenantId = ?";
      queryParams.push(effectiveTenantId);
    }

    if (search && search.trim()) {
      whereClause += " AND (u.FullName LIKE ? OR u.Email LIKE ? OR u.PhoneNumber LIKE ? OR u.ExternalStudentId LIKE ?)";
      const term = `%${search.trim()}%`;
      queryParams.push(term, term, term, term);
    }

    if (role && role.trim()) {
      whereClause += " AND (LOWER(r.Name) = LOWER(?) OR REPLACE(UPPER(r.Name), ' ', '_') = ?)";
      const roleStr = role.trim();
      const roleNorm = roleStr.toUpperCase().replace(/\s+/g, '_');
      queryParams.push(roleStr, roleNorm);
    }

    if (status && status.trim()) {
      whereClause += " AND LOWER(u.Status) = LOWER(?)";
      queryParams.push(status.trim());
    }

    let orderCol = "u.UserId";
    if (sortBy === "Name" || sortBy === "FullName") orderCol = "u.FullName";
    else if (sortBy === "Email") orderCol = "u.Email";
    else if (sortBy === "Role") orderCol = "r.Name";
    else if (sortBy === "Status") orderCol = "u.Status";
    else if (sortBy === "CreatedAt") orderCol = "u.CreatedAt";

    const dir = (sortOrder || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    const sql = `
      SELECT 
        u.UserId, 
        u.FullName, 
        u.Email, 
        u.PhoneNumber,
        u.AuthType,
        u.CreatedFrom,
        u.ExternalStudentId,
        u.StudentDegreeAdmissionId,
        u.StudentId,
        u.TenantId,
        t.Name AS UniversityName,
        t.Slug AS TenantSlug,
        COALESCE(r.Name, 'Student') AS Role, 
        u.Status, 
        u.ExternalStudentId AS EnrollmentNumber,
        COALESCE(w.Balance, 0) AS CreditBalance,
        u.LastLoginAt, 
        u.CreatedAt,
        COUNT(*) OVER() AS TotalRecords
      FROM Users u
      LEFT JOIN Roles r ON u.RoleId = r.RoleId
      LEFT JOIN tenants t ON u.TenantId = t.TenantId
      LEFT JOIN StudentCreditWallets w ON u.UserId = w.UserId
      ${whereClause}
      ORDER BY ${orderCol} ${dir}
      LIMIT ? OFFSET ?
    `;

    queryParams.push(limit, offset);

    const [rows] = await pool.query(sql, queryParams);

    const data = rows || [];
    const total = data.length > 0 ? Number(data[0].TotalRecords || 0) : 0;

    return { data, total };
  }

  async insert(userData, connection = pool) {
    const { fullName, email, phoneNumber = null, passwordHash, roleId: inputRoleId, role: inputRole, status = 'Active', enrollmentNumber = null, programId = null, semesterId = null, createdBy = null } = userData;

    let roleId = inputRoleId;
    if (!roleId) {
      const targetRoleName = inputRole || 'Student';
      const [roleRows] = await connection.query("SELECT RoleId FROM Roles WHERE Name = ?", [targetRoleName]);
      roleId = roleRows[0]?.RoleId || null;
    }

    const [result] = await connection.query(
      "CALL sp_User_Insert(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @newUserId);",
      [fullName, email, phoneNumber, passwordHash, roleId, status, enrollmentNumber, programId, semesterId, createdBy]
    );
    
    // Fetch the OUT parameter
    const [outRows] = await connection.query("SELECT @newUserId AS newUserId;");
    const newUserId = outRows[0].newUserId;
    
    return this.findById(newUserId, connection);
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
