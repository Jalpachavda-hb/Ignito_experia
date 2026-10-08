import pool from "../lib/mysql.js";
import { ROLES } from "../constants/roles.js";

class UserRepository {
  async findByEmail(email, connection = pool) {
    const params = [email.toLowerCase()];
    const [rows] = await connection.query(
      "SELECT * FROM Users WHERE LOWER(Email) = ? AND COALESCE(Status, 'Active') <> 'Inactive'",
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
        u.ProfileImage,
        u.Role, 
        u.Status, 
        u.TenantId,
        u.ExternalStudentId,
        u.StudentDegreeAdmissionId,
        u.StudentId,
        u.CreatedFrom,
        u.AuthType,
        (u.PasswordHash IS NOT NULL) AS HasPassword,
        COALESCE(w.Balance, 0) AS CreditBalance,
        u.CreatedAt,
        u.UpdatedAt
      FROM Users u
      LEFT JOIN StudentCreditWallets w ON u.UserId = w.UserId
      WHERE u.UserId = ? AND COALESCE(u.Status, 'Active') <> 'Inactive'`,
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
    const isSuperAdmin = ["SUPER_ADMIN", "SUPERADMIN", "SUPER_ADMINISTRATOR", "ADMIN"].includes(normalizedActorRole);
    const isTenantAdmin = ["TENANT_ADMIN", "TENANTADMIN"].includes(normalizedActorRole);

    let effectiveTenantId = null;
    if (filterTenantId && filterTenantId !== 'ALL') {
      effectiveTenantId = filterTenantId;
    } else if (isTenantAdmin) {
      effectiveTenantId = actorTenantId;
    } else if (!isSuperAdmin) {
      effectiveTenantId = actorTenantId;
    }

    const limit = Math.max(1, parseInt(pageSize, 10) || 10);
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

    let whereClause = "WHERE COALESCE(u.Status, 'Active') <> 'Inactive'";
    const queryParams = [];

    if (effectiveTenantId) {
      whereClause += " AND (u.TenantId = ? OR EXISTS (SELECT 1 FROM user_tenant_mapping utm WHERE utm.UserId = u.UserId AND utm.TenantId = ?))";
      queryParams.push(effectiveTenantId, effectiveTenantId);
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
        COALESCE(u.TenantId, (SELECT utm.TenantId FROM user_tenant_mapping utm WHERE utm.UserId = u.UserId AND utm.Status = 'ACTIVE' ORDER BY utm.MappingId DESC LIMIT 1)) AS TenantId,
        t.Name AS UniversityName,
        t.Slug AS TenantSlug,
        u.Role, 
        u.Status, 
        COALESCE(NULLIF(u.ExternalStudentId, ''), NULLIF(u.StudentDegreeAdmissionId, ''), '') AS EnrollmentNumber,
        COALESCE(w.Balance, 0) AS CreditBalance,
        u.CreatedAt,
        COUNT(*) OVER() AS TotalRecords
      FROM Users u
      LEFT JOIN tenants t ON (u.TenantId = t.TenantId OR t.TenantId = (SELECT utm.TenantId FROM user_tenant_mapping utm WHERE utm.UserId = u.UserId AND utm.Status = 'ACTIVE' ORDER BY utm.MappingId DESC LIMIT 1))
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
      createdFrom = 'DIRECT',
      authType = 'DIRECT',
      createdBy = null,
      profileImage = null,
      tenantId = null
    } = userData;

    const rawRole = (role || "").toUpperCase().replace(/\s+/g, "_");
    const normalizedRole = ["TENANT_ADMIN", "TENANTADMIN", "SUPER_ADMIN", "SUPERADMIN", "ADMIN"].includes(rawRole)
      ? ROLES.TENANT_ADMIN
      : ROLES.STUDENT;

    const [result] = await connection.query(
      `INSERT INTO Users (FullName, Email, PhoneNumber, PasswordHash, Role, Status, CreatedFrom, AuthType, TenantId, ProfileImage, CreatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [fullName, email, phoneNumber, passwordHash, normalizedRole, status, createdFrom, authType, tenantId, profileImage]
    );

    const newUserId = result.insertId;

    if (tenantId && newUserId) {
      await connection.query(
        `INSERT INTO user_tenant_mapping (UserId, TenantId, Role, Status)
         VALUES (?, ?, ?, 'ACTIVE')
         ON DUPLICATE KEY UPDATE Role = VALUES(Role), Status = 'ACTIVE'`,
        [newUserId, tenantId, normalizedRole]
      );
    }

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

    if (updates.length > 0) {
      updates.push("UpdatedAt = NOW()");
      params.push(userId);
      await pool.query(`UPDATE Users SET ${updates.join(", ")} WHERE UserId = ?`, params);
    }

    return this.findById(userId);
  }

  async updateStatus(userId, status, updatedBy = null) {
    await pool.query(
      "UPDATE Users SET Status = ?, UpdatedAt = NOW() WHERE UserId = ?",
      [status, userId]
    );
    return this.findById(userId);
  }

  async delete(userId, deletedBy = null) {
    // 1. Fetch user metadata before deletion so we have all identifiers
    const [uRows] = await pool.query(
      "SELECT UserId, Email, ExternalStudentId FROM Users WHERE UserId = ?",
      [userId]
    );
    if (!uRows || uRows.length === 0) {
      return { success: false, message: "User not found" };
    }
    const user = uRows[0];
    const uIdStr = String(user.UserId);
    const extId = user.ExternalStudentId || null;
    const email = user.Email ? user.Email.toLowerCase().trim() : null;

    // 2. Stop any active sessions & containers for this student
    try {
      const { runtimeStopService } = await import("../services/RuntimeStopService.js");
      const [activeSessions] = await pool.query(
        "SELECT SessionId FROM lab_sessions WHERE UserId = ? AND Status IN ('RUNNING', 'STARTING', 'EXPIRING_SOON', 'PENDING')",
        [userId]
      );
      for (const sess of activeSessions) {
        await runtimeStopService.stopSessionContainers(sess.SessionId).catch(() => {});
      }
    } catch (stopErr) {
      console.warn(`[userRepository.delete] Warning stopping container sessions for user ${userId}:`, stopErr.message);
    }

    // 3. Perform exhaustive cascading deletion in a transaction
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Clear token usages
      await conn.query(
        `DELETE FROM lab_token_usage 
         WHERE StudentId = ? 
            OR (? IS NOT NULL AND StudentId = ?) 
            OR (? IS NOT NULL AND LOWER(StudentId) = ?)
            OR WalletId IN (
              SELECT Id FROM student_lab_token_wallets 
              WHERE StudentId = ? 
                 OR (? IS NOT NULL AND StudentId = ?) 
                 OR (? IS NOT NULL AND LOWER(StudentId) = ?)
            )`,
        [uIdStr, extId, extId, email, email, uIdStr, extId, extId, email, email]
      );

      // Clear student lab token transactions
      await conn.query(
        `DELETE FROM student_lab_token_transactions 
         WHERE StudentId = ? 
            OR (? IS NOT NULL AND StudentId = ?) 
            OR (? IS NOT NULL AND LOWER(StudentId) = ?)
            OR WalletId IN (
              SELECT Id FROM student_lab_token_wallets 
              WHERE StudentId = ? 
                 OR (? IS NOT NULL AND StudentId = ?) 
                 OR (? IS NOT NULL AND LOWER(StudentId) = ?)
            )`,
        [uIdStr, extId, extId, email, email, uIdStr, extId, extId, email, email]
      );

      // Clear student lab token wallets
      await conn.query(
        `DELETE FROM student_lab_token_wallets 
         WHERE StudentId = ? 
            OR (? IS NOT NULL AND StudentId = ?) 
            OR (? IS NOT NULL AND LOWER(StudentId) = ?)`,
        [uIdStr, extId, extId, email, email]
      );

      // Clear token orders & items
      await conn.query(
        `DELETE FROM token_order_items 
         WHERE OrderId IN (
           SELECT Id FROM token_orders 
           WHERE StudentId = ? 
              OR (? IS NOT NULL AND StudentId = ?) 
              OR (? IS NOT NULL AND LOWER(StudentId) = ?)
         )`,
        [uIdStr, extId, extId, email, email]
      );

      await conn.query(
        `DELETE FROM token_orders 
         WHERE StudentId = ? 
            OR (? IS NOT NULL AND StudentId = ?) 
            OR (? IS NOT NULL AND LOWER(StudentId) = ?)`,
        [uIdStr, extId, extId, email, email]
      );

      // Clear credit transactions & wallets
      await conn.query("DELETE FROM credit_transactions WHERE UserId = ?", [userId]);
      await conn.query("DELETE FROM credit_wallets WHERE UserId = ?", [userId]);
      await conn.query("DELETE FROM studentcreditwallets WHERE UserId = ?", [userId]);

      // Clear lab sessions
      await conn.query("DELETE FROM lab_sessions WHERE UserId = ?", [userId]);

      // Clear user lab workspaces
      await conn.query("DELETE FROM user_lab_workspaces WHERE userId = ?", [uIdStr]);

      // Clear tenant mappings
      await conn.query("DELETE FROM user_tenant_mapping WHERE UserId = ?", [userId]);

      // Clear refresh tokens, devices & sessions
      await conn.query("DELETE FROM refreshtokens WHERE UserId = ? OR StudentProfileId = ?", [userId, userId]);
      await conn.query("DELETE FROM userrefreshtokens WHERE UserId = ?", [userId]);
      await conn.query("DELETE FROM studentsessions WHERE UserId = ? OR StudentProfileId = ?", [userId, userId]);
      await conn.query("DELETE FROM registereddevices WHERE StudentProfileId = ?", [userId]);

      // Clear external identities
      await conn.query(
        `DELETE FROM external_identities 
         WHERE UserId = ? 
            OR (? IS NOT NULL AND ExternalStudentId = ?)`,
        [userId, extId, extId]
      );

      // Clear student audits
      await conn.query("DELETE FROM studentaudits WHERE UserId = ? OR ChangedByUserId = ?", [userId, userId]);

      // Clear audit logs
      await conn.query("DELETE FROM auditlogs WHERE UserId = ? OR StudentProfileId = ?", [userId, userId]);
      await conn.query("DELETE FROM auditlogs_archive WHERE StudentProfileId = ?", [userId]);

      // Finally permanently delete user from Users table
      await conn.query("DELETE FROM Users WHERE UserId = ?", [userId]);

      await conn.commit();
      console.log(`[userRepository.delete] Permanently deleted user ${userId} and all related records across all tables.`);
      return { success: true, message: "User and all associated data permanently deleted" };
    } catch (err) {
      await conn.rollback();
      console.error(`[userRepository.delete] Error deleting user ${userId}:`, err);
      throw err;
    } finally {
      conn.release();
    }
  }

  async updateLastLogin(userId) {
    await pool.query(
      "UPDATE Users SET UpdatedAt = NOW() WHERE UserId = ?",
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
