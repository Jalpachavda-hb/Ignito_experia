import pool from "../config/db.js";

/**
 * Returns real owner dashboard metrics, direct student lab purchases,
 * and lab purchase breakdown (how many students purchased which lab).
 * STRICTLY filters to Direct Students only (excluding LMS students).
 */
export const dashboardStatsHandler = async (req, res) => {
  try {
    // 1. Direct Student Filter Clause
    const directStudentWhere = `
      LOWER(u.Role) = 'student'
      AND COALESCE(u.CreatedFrom, 'DIRECT') != 'LMS'
      AND COALESCE(u.AuthType, 'DIRECT') != 'LMS'
      AND COALESCE(u.AuthType, 'DIRECT') != 'LMS_AND_DIRECT'
      AND (u.ExternalStudentId IS NULL OR u.ExternalStudentId = '')
      AND (u.StudentDegreeAdmissionId IS NULL OR u.StudentDegreeAdmissionId = '')
      AND (u.TenantId IS NULL OR u.TenantId = '' OR u.TenantId = 'PLATFORM' OR u.TenantId = 'DIRECT')
    `;

    // 2. Direct Students Count & Wallet Totals
    const [studentStats] = await pool.query(`
      SELECT 
        COUNT(DISTINCT u.UserId) AS directStudentsCount,
        COALESCE(SUM(cw.Balance), 0) AS totalRemainingCredits,
        COALESCE(SUM(cw.TotalPurchasedCredits), 0) AS totalPurchasedCredits,
        COALESCE(SUM(cw.ConsumedCredits), 0) AS totalConsumedCredits
      FROM ignito_experia.users u
      LEFT JOIN ignito_experia.credit_wallets cw ON u.UserId = cw.UserId
      WHERE ${directStudentWhere}
    `);

    // 3. Total Direct Revenue and Purchase Count from Transactions
    const [revenueStats] = await pool.query(`
      SELECT 
        COUNT(ct.TransactionId) AS totalPurchasesCount,
        COALESCE(SUM(ct.Amount), 0) AS totalRevenue,
        COALESCE(SUM(ct.Credits), 0) AS totalTokensSold
      FROM ignito_experia.credit_transactions ct
      JOIN ignito_experia.users u ON ct.UserId = u.UserId
      WHERE ct.Type = 'PURCHASE'
        AND ${directStudentWhere}
    `);

    // 4. Active Concurrent Labs / Sessions
    let activeSessionsCount = 0;
    try {
      const [sessionStats] = await pool.query(`
        SELECT COUNT(*) AS activeCount 
        FROM ignito_experia.lab_sessions ls
        JOIN ignito_experia.users u ON ls.UserId = u.UserId
        WHERE ls.Status IN ('ACTIVE', 'RUNNING')
          AND ${directStudentWhere}
      `);
      activeSessionsCount = Number(sessionStats[0]?.activeCount || 0);
    } catch (e) {
      console.warn("[Dashboard Stats] Sessions lookup warn:", e.message);
    }

    // 5. Total Universities in Platform Catalog
    let totalUniversitiesCount = 0;
    try {
      const [uniStats] = await pool.query(`
        SELECT COUNT(*) AS totalUni FROM ignito_experia_owner.tenants
      `);
      totalUniversitiesCount = Number(uniStats[0]?.totalUni || 0);
    } catch (e) {
      console.warn("[Dashboard Stats] Universities lookup warn:", e.message);
    }

    // 6. Total Catalog Labs
    let totalLabsCount = 0;
    try {
      const [labStats] = await pool.query(`
        SELECT COUNT(*) AS totalLabs FROM ignito_experia_owner.labs WHERE COALESCE(IsDeleted, 0) = 0
      `);
      totalLabsCount = Number(labStats[0]?.totalLabs || 0);
    } catch (e) {
      console.warn("[Dashboard Stats] Labs lookup warn:", e.message);
    }

    // 7. "HOW MANY STUDENTS PURCHASED WHICH LAB" (Lab-Wise Aggregation)
    const [labPurchaseBreakdown] = await pool.query(`
      SELECT 
        ct.LabId,
        COALESCE(l.Title, 
          CASE 
            WHEN ct.LabId LIKE '%python%' THEN 'Python Programming Lab'
            WHEN ct.LabId LIKE '%data-science%' THEN 'Data Science-I'
            ELSE ct.LabId 
          END
        ) AS LabTitle,
        COALESCE(l.Category, 'Computer Science') AS Category,
        COALESCE(l.Logo, '') AS Logo,
        COUNT(DISTINCT ct.UserId) AS StudentCount,
        COUNT(ct.TransactionId) AS TotalPurchases,
        COALESCE(SUM(ct.Credits), 0) AS TotalTokens,
        COALESCE(SUM(ct.Amount), 0) AS TotalRevenue
      FROM ignito_experia.credit_transactions ct
      JOIN ignito_experia.users u ON ct.UserId = u.UserId
      LEFT JOIN ignito_experia_owner.labs l ON ct.LabId = l.LabCode
      WHERE ct.Type = 'PURCHASE'
        AND ${directStudentWhere}
      GROUP BY ct.LabId, LabTitle, l.Category, l.Logo
      ORDER BY TotalRevenue DESC, StudentCount DESC
    `);

    // 8. "WHICH STUDENT PURCHASED WHICH LAB" (Detailed Direct Student Purchase Records)
    const [studentLabPurchases] = await pool.query(`
      SELECT 
        ct.TransactionId,
        ct.UserId,
        u.FullName AS StudentName,
        u.Email AS StudentEmail,
        COALESCE(u.PhoneNumber, '') AS StudentPhone,
        ct.LabId,
        COALESCE(l.Title, 
          CASE 
            WHEN ct.LabId LIKE '%python%' THEN 'Python Programming Lab'
            WHEN ct.LabId LIKE '%data-science%' THEN 'Data Science-I'
            ELSE ct.LabId 
          END
        ) AS LabTitle,
        ct.Credits,
        ct.Amount,
        ct.Currency,
        ct.PaymentReference,
        ct.IdempotencyKey,
        ct.Status,
        ct.CreatedAt AS PurchasedAt
      FROM ignito_experia.credit_transactions ct
      JOIN ignito_experia.users u ON ct.UserId = u.UserId
      LEFT JOIN ignito_experia_owner.labs l ON ct.LabId = l.LabCode
      WHERE ct.Type = 'PURCHASE'
        AND ${directStudentWhere}
      ORDER BY ct.CreatedAt DESC
    `);

    // 9. Direct Students List with their individual wallets and purchases
    const [directStudents] = await pool.query(`
      SELECT 
        u.UserId,
        u.FullName,
        u.Email,
        COALESCE(u.PhoneNumber, '') AS PhoneNumber,
        u.Status,
        u.CreatedAt,
        COALESCE(cw.Balance, 0) AS CreditBalance,
        COALESCE(cw.TotalPurchasedCredits, 0) AS TotalPurchasedCredits,
        COALESCE(cw.ConsumedCredits, 0) AS ConsumedCredits
      FROM ignito_experia.users u
      LEFT JOIN ignito_experia.credit_wallets cw ON u.UserId = cw.UserId
      WHERE ${directStudentWhere}
      ORDER BY u.CreatedAt DESC
    `);

    // Attach purchased labs list to each direct student
    const studentPurchasesMap = new Map();
    for (const p of studentLabPurchases) {
      if (!studentPurchasesMap.has(p.UserId)) {
        studentPurchasesMap.set(p.UserId, []);
      }
      studentPurchasesMap.get(p.UserId).push({
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

    const enrichedStudents = directStudents.map((s) => ({
      ...s,
      purchasedLabs: studentPurchasesMap.get(s.UserId) || [],
      purchasedLabsCount: (studentPurchasesMap.get(s.UserId) || []).length,
    }));

    // 10. Monthly Revenue Breakdown from Direct Purchases
    const [monthlyRows] = await pool.query(`
      SELECT 
        DATE_FORMAT(ct.CreatedAt, '%b') AS monthName,
        DATE_FORMAT(ct.CreatedAt, '%Y-%m') AS yearMonth,
        COALESCE(SUM(ct.Amount), 0) AS revenue,
        COALESCE(SUM(ct.Credits), 0) AS credits
      FROM ignito_experia.credit_transactions ct
      JOIN ignito_experia.users u ON ct.UserId = u.UserId
      WHERE ct.Type = 'PURCHASE'
        AND ${directStudentWhere}
      GROUP BY yearMonth, monthName
      ORDER BY yearMonth ASC
    `);

    return res.json({
      success: true,
      kpis: {
        directStudentsCount: Number(studentStats[0]?.directStudentsCount || 0),
        totalRevenue: Number(revenueStats[0]?.totalRevenue || 0),
        totalTokensSold: Number(revenueStats[0]?.totalTokensSold || 0),
        totalPurchasesCount: Number(revenueStats[0]?.totalPurchasesCount || 0),
        activeConcurrentLabs: activeSessionsCount,
        totalUniversitiesCount,
        totalCatalogLabs: totalLabsCount,
      },
      labPurchaseBreakdown,
      studentLabPurchases,
      directStudents: enrichedStudents,
      monthlyRevenue: monthlyRows,
    });
  } catch (error) {
    console.error("[Owner Dashboard Stats Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
