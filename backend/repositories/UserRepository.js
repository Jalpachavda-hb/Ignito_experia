import pool from "../lib/mysql.js";
import { ROLES } from "../constants/roles.js";

class UserRepository {
  async findByEmail(email) {
    const params = [email.toLowerCase()];
    const [rows] = await pool.query(
      "SELECT * FROM Users WHERE LOWER(Email) = ? AND COALESCE(IsDeleted, 0) = 0",
      params
    );
    if (!rows || !rows.length) return null;
    return rows[0];
  }

  async findById(userId, connection = pool) {
    const [rows] = await connection.query(
      `SELECT 
        u.UserId, 
        u.FullName, 
        u.FullName AS Name,
        u.Email, 
        u.PhoneNumber,
        u.Mobile,
        u.ProfileImage,
        u.Role, 
        u.Status, 
        u.TenantId,
        u.ExternalStudentId,
        u.StudentDegreeAdmissionId,
        u.StudentId,
        u.IsDeleted,
        u.DeletedAt,
        COALESCE(w.Balance, 0) AS CreditBalance,
        u.LastLoginAt, 
        u.CreatedAt,
        u.UpdatedAt
      FROM Users u
      LEFT JOIN StudentCreditWallets w ON u.UserId = w.UserId
      WHERE u.UserId = ? AND COALESCE(u.IsDeleted, 0) = 0`,
      [userId]
    );
    return rows[0] || null;
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
    const isTenantAdmin = ["TENANT_ADMIN", "TENANTADMIN", "SUPER_ADMIN", "SUPERADMIN", "ADMIN"].includes(normalizedActorRole);

    let effectiveTenantId = null;
    if (!isTenantAdmin) {
      if (!actorTenantId) {
        const err = new Error("TENANT_CONTEXT_MISSING");
        err.code = "TENANT_CONTEXT_MISSING";
        throw err;
      }
      effectiveTenantId = actorTenantId;
    } else {
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
      whereClause += " AND UPPER(u.Role) = ?";
      const roleNorm = role.trim().toUpperCase().replace(/\s+/g, '_');
      queryParams.push(roleNorm);
    }

    if (status && status.trim()) {
      whereClause += " AND LOWER(u.Status) = LOWER(?)";
      queryParams.push(status.trim());
    }

    let orderCol = "u.UserId";
    if (sortBy === "Name" || sortBy === "FullName") orderCol = "u.FullName";
    else if (sortBy === "Email") orderCol = "u.Email";
    else if (sortBy === "Role") orderCol = "u.Role";
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
        u.Role, 
        u.Status, 
        COALESCE(NULLIF(u.ExternalStudentId, ''), NULLIF(u.StudentDegreeAdmissionId, ''), '') AS EnrollmentNumber,
        COALESCE(w.Balance, 0) AS CreditBalance,
        u.LastLoginAt, 
        u.CreatedAt,
        COUNT(*) OVER() AS TotalRecords
      FROM Users u
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
    const {
      fullName,
      email,
      phoneNumber = null,
      passwordHash,
      role = 'STUDENT',
      status = 'Active',
      createdBy = null,
      profileImage = null
    } = userData;

    const rawRole = (role || "").toUpperCase().replace(/\s+/g, "_");
    const normalizedRole = ["TENANT_ADMIN", "TENANTADMIN", "SUPER_ADMIN", "SUPERADMIN", "ADMIN"].includes(rawRole)
      ? ROLES.TENANT_ADMIN
      : ROLES.STUDENT;

    const [result] = await connection.query(
      `INSERT INTO Users (FullName, Email, PhoneNumber, PasswordHash, Role, Status, CreatedBy, CreatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [fullName, email, phoneNumber, passwordHash, normalizedRole, status, createdBy]
    );

    const newUserId = result.insertId;

    if (profileImage && newUserId) {
      await connection.query(
        "UPDATE Users SET ProfileImage = ?, UpdatedAt = NOW() WHERE UserId = ?",
        [profileImage, newUserId]
      );
    }

    return this.findById(newUserId, connection);
  }

  async update(userId, userData) {
    const { fullName, phoneNumber, role, updatedBy } = userData;

    let normalizedRole = undefined;
    if (role) {
      const rawRole = role.toUpperCase().replace(/\s+/g, "_");
      normalizedRole = ["TENANT_ADMIN", "TENANTADMIN", "SUPER_ADMIN", "SUPERADMIN", "ADMIN"].includes(rawRole)
        ? ROLES.TENANT_ADMIN
        : ROLES.STUDENT;
    }

    const updates = [];
    const params = [];

    if (fullName !== undefined) {
      updates.push("FullName = ?");
      params.push(fullName);
    }

    if (phoneNumber !== undefined) {
      updates.push("PhoneNumber = ?");
      params.push(phoneNumber);
    }

    if (normalizedRole !== undefined) {
      updates.push("Role = ?");
      params.push(normalizedRole);
    }

    if (updatedBy !== undefined) {
      updates.push("UpdatedBy = ?");
      params.push(updatedBy);
    }

    if (updates.length > 0) {
      updates.push("UpdatedAt = NOW()");
      params.push(userId);
      await pool.query(`UPDATE Users SET ${updates.join(", ")} WHERE UserId = ?`, params);
    }

    return this.findById(userId);
  }

  async updateStatus(userId, status, updatedBy = null) {
    await pool.query(
      "UPDATE Users SET Status = ?, UpdatedBy = ?, UpdatedAt = NOW() WHERE UserId = ?",
      [status, updatedBy, userId]
    );
    return this.findById(userId);
  }

  async delete(userId, deletedBy = null) {
    await pool.query(
      "UPDATE Users SET IsDeleted = 1, DeletedAt = NOW(), DeletedBy = ? WHERE UserId = ?",
      [deletedBy, userId]
    );
  }

  async updateLastLogin(userId) {
    await pool.query(
      "UPDATE Users SET LastLoginAt = NOW() WHERE UserId = ?",
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
      `INSERT INTO StudentCreditWallets (UserId, Balance) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE Balance = Balance + VALUES(Balance), UpdatedAt = NOW()`,
      [userId, amount]
    );
    return this.findById(userId);
  }
}

export const userRepository = new UserRepository();
export default userRepository;
