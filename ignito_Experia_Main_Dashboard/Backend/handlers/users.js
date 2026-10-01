import pool from "../config/db.js";

/**
 * Lists Direct Students (strictly excluding LMS students),
 * with their credit wallet details and which labs they purchased.
 */
export const usersListHandler = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      status = "",
      tenantId = "DIRECT",
    } = req.query;

    const limit = Math.max(1, parseInt(pageSize, 10) || 10);
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

    // Strict direct student condition: NOT LMS
    let whereClause = `
      WHERE LOWER(u.Role) = 'student'
        AND COALESCE(u.CreatedFrom, 'DIRECT') != 'LMS'
        AND COALESCE(u.AuthType, 'DIRECT') != 'LMS'
        AND COALESCE(u.AuthType, 'DIRECT') != 'LMS_AND_DIRECT'
        AND (u.ExternalStudentId IS NULL OR u.ExternalStudentId = '')
        AND (u.StudentDegreeAdmissionId IS NULL OR u.StudentDegreeAdmissionId = '')
        AND (u.TenantId IS NULL OR u.TenantId = '' OR u.TenantId = 'PLATFORM' OR u.TenantId = 'DIRECT')
    `;
    const queryParams = [];

    // Search Filter
    if (search && search.trim()) {
      whereClause += " AND (u.FullName LIKE ? OR u.Email LIKE ? OR u.PhoneNumber LIKE ?)";
      const term = `%${search.trim()}%`;
      queryParams.push(term, term, term);
    }

    // Status Filter
    if (status && status.trim() && status !== "ALL") {
      whereClause += " AND LOWER(u.Status) = LOWER(?)";
      queryParams.push(status.trim());
    }

    // Total records count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM ignito_experia.users u ${whereClause}`,
      queryParams
    );
    const total = Number(countRows[0]?.total || 0);

    // Fetch Direct Students
    const sql = `
      SELECT 
        u.UserId, 
        u.FullName, 
        u.Email, 
        COALESCE(u.PhoneNumber, '') AS PhoneNumber,
        COALESCE(u.AuthType, 'DIRECT') AS AuthType,
        COALESCE(u.CreatedFrom, 'DIRECT') AS CreatedFrom,
        COALESCE(u.TenantId, 'PLATFORM') AS TenantId,
        'Direct Experia User' AS UniversityName,
        'experia' AS TenantSlug,
        COALESCE(u.Role, 'STUDENT') AS Role, 
        COALESCE(u.Status, 'Active') AS Status, 
        COALESCE(cw.Balance, 0) AS CreditBalance,
        COALESCE(cw.TotalPurchasedCredits, 0) AS TotalPurchasedCredits,
        COALESCE(cw.ConsumedCredits, 0) AS ConsumedCredits,
        u.CreatedAt
      FROM ignito_experia.users u
      LEFT JOIN ignito_experia.credit_wallets cw ON u.UserId = cw.UserId
      ${whereClause}
      ORDER BY u.UserId DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(sql, [...queryParams, limit, offset]);
    const users = rows || [];

    // If users found, fetch their purchased labs and token wallets
    if (users.length > 0) {
      const userIds = users.map((u) => u.UserId);

      // 1. Fetch Purchases from credit_transactions
      const [purchaseRows] = await pool.query(
        `
        SELECT 
          ct.TransactionId,
          ct.UserId,
          ct.Credits,
          ct.Amount,
          ct.Currency,
          ct.PaymentReference,
          ct.LabId,
          COALESCE(l.Title, 
            CASE 
              WHEN ct.LabId LIKE '%python%' THEN 'Python Programming Lab'
              WHEN ct.LabId LIKE '%data-science%' THEN 'Data Science-I'
              ELSE ct.LabId 
            END
          ) AS LabTitle,
          ct.CreatedAt AS PurchasedAt,
          ct.Status
        FROM ignito_experia.credit_transactions ct
        LEFT JOIN ignito_experia_owner.labs l ON ct.LabId = l.LabCode
        WHERE ct.Type = 'PURCHASE'
          AND ct.UserId IN (?)
        ORDER BY ct.CreatedAt DESC
        `,
        [userIds]
      );

      // 2. Fetch specific Lab Token Balances from student_lab_token_wallets
      let labWallets = [];
      try {
        const [lwRows] = await pool.query(
          `SELECT StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, RemainingTokens 
           FROM ignito_experia.student_lab_token_wallets 
           WHERE StudentId IN (?)`,
          [userIds.map(String)]
        );
        labWallets = lwRows || [];
      } catch (err) {
        console.warn("[Users Handler] lab token wallets warning:", err.message);
      }

      // Group purchases by UserId
      const purchasesByUser = new Map();
      for (const p of purchaseRows) {
        if (!purchasesByUser.has(p.UserId)) {
          purchasesByUser.set(p.UserId, []);
        }
        purchasesByUser.get(p.UserId).push({
          transactionId: p.TransactionId,
          labId: p.LabId,
          labTitle: p.LabTitle,
          credits: Number(p.Credits),
          amount: Number(p.Amount),
          currency: p.Currency,
          paymentReference: p.PaymentReference,
          purchasedAt: p.PurchasedAt,
          status: p.Status,
        });
      }

      // Group lab token wallets by StudentId
      const walletsByUser = new Map();
      for (const w of labWallets) {
        const uid = Number(w.StudentId);
        if (!walletsByUser.has(uid)) {
          walletsByUser.set(uid, []);
        }
        walletsByUser.get(uid).push({
          labId: w.LabId,
          totalPurchasedTokens: Number(w.TotalPurchasedTokens),
          consumedTokens: Number(w.ConsumedTokens),
          remainingTokens: Number(w.RemainingTokens),
        });
      }

      // Attach to users
      for (const user of users) {
        user.purchasedLabs = purchasesByUser.get(user.UserId) || [];
        user.purchasedLabsCount = user.purchasedLabs.length;
        user.labWallets = walletsByUser.get(user.UserId) || [];
      }
    }

    return res.json({
      success: true,
      data: users,
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
