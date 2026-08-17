import pool from "../config/db.js";

export const usersListHandler = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      tenantId = "ALL",
      role = "ALL",
      status = "",
    } = req.query;

    const limit = Math.max(1, parseInt(pageSize, 10) || 10);
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

    let whereClause = "WHERE COALESCE(u.IsDeleted, 0) = 0";
    const queryParams = [];

    // 1. Tenant Filter Logic
    if (tenantId === "DIRECT") {
      whereClause += " AND (u.TenantId IS NULL OR u.TenantId = '' OR u.TenantId = 'NULL')";
    } else if (tenantId && tenantId !== "ALL") {
      whereClause += " AND u.TenantId = ?";
      queryParams.push(tenantId);
    }

    // 2. Role Filter Logic
    if (role && role.trim() && role !== "ALL") {
      whereClause += " AND (LOWER(COALESCE(r.Name, u.Role)) = LOWER(?) OR REPLACE(UPPER(COALESCE(r.Name, u.Role)), ' ', '_') = ? OR LOWER(u.Role) = LOWER(?))";
      const roleStr = role.trim();
      const roleNorm = roleStr.toUpperCase().replace(/\s+/g, "_");
      queryParams.push(roleStr, roleNorm, roleStr);
    }

    // 3. Search Query Filter
    if (search && search.trim()) {
      whereClause += " AND (u.FullName LIKE ? OR u.Email LIKE ? OR u.PhoneNumber LIKE ? OR u.ExternalStudentId LIKE ?)";
      const term = `%${search.trim()}%`;
      queryParams.push(term, term, term, term);
    }

    // 4. Status Filter
    if (status && status.trim()) {
      whereClause += " AND LOWER(u.Status) = LOWER(?)";
      queryParams.push(status.trim());
    }

    let rows = [];

    try {
      // Query Experia Core Database Users joined with Tenants and Credit Wallets
      const sql = `
        SELECT 
          u.UserId, 
          u.FullName, 
          u.Email, 
          COALESCE(u.PhoneNumber, u.Mobile, '') AS PhoneNumber,
          COALESCE(u.AuthType, 'LMS_AND_DIRECT') AS AuthType,
          COALESCE(u.CreatedFrom, 'LMS') AS CreatedFrom,
          COALESCE(u.ExternalStudentId, '') AS ExternalStudentId,
          u.TenantId,
          CASE 
            WHEN u.TenantId IS NULL OR u.TenantId = '' OR u.TenantId = 'NULL' THEN 'Direct Experia User'
            ELSE COALESCE(t.Name, 'Gujarat Technological University')
          END AS UniversityName,
          COALESCE(t.Slug, 'experia') AS TenantSlug,
          COALESCE(r.Name, u.Role, 'Student') AS Role, 
          COALESCE(u.Status, 'Active') AS Status, 
          COALESCE(u.ExternalStudentId, '') AS EnrollmentNumber,
          COALESCE(w.Balance, 0) AS CreditBalance,
          u.LastLoginAt, 
          u.CreatedAt,
          COUNT(*) OVER() AS TotalRecords
        FROM ignito_experia.Users u
        LEFT JOIN ignito_experia.Roles r ON u.RoleId = r.RoleId
        LEFT JOIN ignito_experia.tenants t ON u.TenantId = t.TenantId
        LEFT JOIN ignito_experia.StudentCreditWallets w ON u.UserId = w.UserId
        ${whereClause}
        ORDER BY u.UserId DESC
        LIMIT ? OFFSET ?
      `;
      const [resData] = await pool.query(sql, [...queryParams, limit, offset]);
      rows = resData || [];
    } catch (e1) {
      console.warn("[Owner Backend Users Fallback Query]:", e1.message);
      // Fallback query against ignito_experia.Users without secondary joins
      const sqlFallback = `
        SELECT 
          u.UserId, 
          u.FullName, 
          u.Email, 
          COALESCE(u.PhoneNumber, u.Mobile, '') AS PhoneNumber,
          COALESCE(u.AuthType, 'LMS_AND_DIRECT') AS AuthType,
          COALESCE(u.CreatedFrom, 'LMS') AS CreatedFrom,
          COALESCE(u.ExternalStudentId, '') AS ExternalStudentId,
          u.TenantId,
          CASE 
            WHEN u.TenantId IS NULL OR u.TenantId = '' OR u.TenantId = 'NULL' THEN 'Direct Experia User'
            ELSE COALESCE(t.Name, 'Gujarat Technological University')
          END AS UniversityName,
          COALESCE(t.Slug, 'experia') AS TenantSlug,
          COALESCE(u.Role, 'Student') AS Role, 
          COALESCE(u.Status, 'Active') AS Status, 
          COALESCE(u.ExternalStudentId, '') AS EnrollmentNumber,
          0 AS CreditBalance,
          u.LastLoginAt, 
          u.CreatedAt,
          COUNT(*) OVER() AS TotalRecords
        FROM ignito_experia.Users u
        LEFT JOIN ignito_experia.tenants t ON u.TenantId = t.TenantId
        ${whereClause}
        ORDER BY u.UserId DESC
        LIMIT ? OFFSET ?
      `;
      const [resFallback] = await pool.query(sqlFallback, [...queryParams, limit, offset]);
      rows = resFallback || [];
    }

    const data = rows || [];
    const total = data.length > 0 ? Number(data[0].TotalRecords || 0) : 0;

    return res.json({
      success: true,
      data,
      pagination: {
        total,
        page: parseInt(page, 10) || 1,
        pageSize: limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("[Owner Backend Users Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
