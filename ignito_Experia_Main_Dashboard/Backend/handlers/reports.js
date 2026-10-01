import pool from "../config/db.js";

const directStudentWhere = `
  LOWER(u.Role) = 'student'
  AND COALESCE(u.CreatedFrom, 'DIRECT') != 'LMS'
  AND COALESCE(u.AuthType, 'DIRECT') != 'LMS'
  AND COALESCE(u.AuthType, 'DIRECT') != 'LMS_AND_DIRECT'
  AND (u.ExternalStudentId IS NULL OR u.ExternalStudentId = '')
  AND (u.TenantId IS NULL OR u.TenantId = '' OR u.TenantId = 'PLATFORM' OR u.TenantId = 'DIRECT')
`;

/**
 * Returns dynamic live stats for all 4 reports.
 */
export const reportsListHandler = async (req, res) => {
  try {
    // 1. Direct Student Count
    const [uCount] = await pool.query(`SELECT COUNT(*) as count FROM ignito_experia.users u WHERE ${directStudentWhere}`);

    // 2. Labs Count
    const [lCount] = await pool.query(`SELECT COUNT(*) as count FROM ignito_experia_owner.labs WHERE COALESCE(IsDeleted, 0) = 0`);

    // 3. Transactions Count & Revenue
    const [txCount] = await pool.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(ct.Amount), 0) as totalRevenue
      FROM ignito_experia.credit_transactions ct
      JOIN ignito_experia.users u ON ct.UserId = u.UserId
      WHERE ct.Type = 'PURCHASE' AND ${directStudentWhere}
    `);

    // 4. Sessions Count & Billed Tokens
    let sessionsCount = 0;
    let tokensConsumed = 0;
    try {
      const [sCount] = await pool.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(BilledTokens), 0) as totalTokens
        FROM ignito_experia.lab_sessions ls
        JOIN ignito_experia.users u ON ls.UserId = u.UserId
        WHERE ${directStudentWhere}
      `);
      sessionsCount = sCount[0]?.count || 0;
      tokensConsumed = sCount[0]?.totalTokens || 0;
    } catch (e) {
      // ignore
    }

    return res.json({
      success: true,
      stats: {
        platformUsage: {
          studentsCount: uCount[0]?.count || 0,
        },
        labPerformance: {
          labsCount: lCount[0]?.count || 0,
        },
        revenueStatement: {
          transactionsCount: txCount[0]?.count || 0,
          totalRevenue: Number(txCount[0]?.totalRevenue || 0),
        },
        creditConsumption: {
          sessionsCount,
          tokensConsumed,
        },
      },
    });
  } catch (error) {
    console.error("[Owner Reports List Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Exports real dynamic CSV data for any requested report type.
 */
export const exportReportHandler = async (req, res) => {
  try {
    const { reportType } = req.params;

    if (reportType === "platform-usage" || reportType === "rep-01") {
      const [rows] = await pool.query(`
        SELECT 
          u.UserId,
          u.FullName,
          u.Email,
          COALESCE(u.PhoneNumber, '') AS PhoneNumber,
          u.Status,
          COALESCE(cw.Balance, 0) AS BalanceCredits,
          COALESCE(cw.TotalPurchasedCredits, 0) AS TotalPurchasedCredits,
          COALESCE(cw.ConsumedCredits, 0) AS ConsumedCredits,
          u.CreatedAt
        FROM ignito_experia.users u
        LEFT JOIN ignito_experia.credit_wallets cw ON u.UserId = cw.UserId
        WHERE ${directStudentWhere}
        ORDER BY u.UserId DESC
      `);

      let csv = "Student ID,Full Name,Email,Phone,Status,Balance Credits,Total Purchased Credits,Consumed Credits,Registration Date\n";
      for (const r of rows) {
        csv += `"${r.UserId}","${r.FullName}","${r.Email}","${r.PhoneNumber}","${r.Status}","${r.BalanceCredits}","${r.TotalPurchasedCredits}","${r.ConsumedCredits}","${new Date(r.CreatedAt).toISOString()}"\n`;
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="direct_student_usage_${Date.now()}.csv"`);
      return res.status(200).send(csv);
    }

    if (reportType === "lab-performance" || reportType === "rep-02") {
      const [rows] = await pool.query(`
        SELECT 
          l.LabCode,
          l.Title,
          COALESCE(l.Category, 'General') AS Category,
          COALESCE(l.RuntimeType, 'ide') AS RuntimeType,
          COUNT(DISTINCT ct.UserId) AS DirectStudentCount,
          COUNT(ct.TransactionId) AS TotalPurchases,
          COALESCE(SUM(ct.Credits), 0) AS TotalTokensSold,
          COALESCE(SUM(ct.Amount), 0) AS TotalRevenue
        FROM ignito_experia_owner.labs l
        LEFT JOIN ignito_experia.credit_transactions ct ON l.LabCode = ct.LabId AND ct.Type = 'PURCHASE'
        WHERE COALESCE(l.IsDeleted, 0) = 0
        GROUP BY l.LabCode, l.Title, l.Category, l.RuntimeType
        ORDER BY TotalRevenue DESC, TotalPurchases DESC
      `);

      let csv = "Lab Code,Lab Title,Category,Runtime Type,Direct Students Count,Total Purchases,Total Tokens Sold,Total Revenue (INR)\n";
      for (const r of rows) {
        csv += `"${r.LabCode}","${r.Title}","${r.Category}","${r.RuntimeType}","${r.DirectStudentCount}","${r.TotalPurchases}","${r.TotalTokensSold}","${r.TotalRevenue}"\n`;
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="lab_performance_analysis_${Date.now()}.csv"`);
      return res.status(200).send(csv);
    }

    if (reportType === "revenue-statement" || reportType === "rep-03") {
      const [rows] = await pool.query(`
        SELECT 
          ct.TransactionId,
          ct.PaymentReference,
          u.FullName AS StudentName,
          u.Email AS StudentEmail,
          ct.LabId,
          COALESCE(l.Title, ct.LabId) AS LabTitle,
          ct.Credits,
          ct.Amount,
          ct.Currency,
          ct.Status,
          ct.CreatedAt
        FROM ignito_experia.credit_transactions ct
        JOIN ignito_experia.users u ON ct.UserId = u.UserId
        LEFT JOIN ignito_experia_owner.labs l ON ct.LabId = l.LabCode
        WHERE ct.Type = 'PURCHASE' AND ${directStudentWhere}
        ORDER BY ct.CreatedAt DESC
      `);

      let csv = "Transaction ID,Payment Reference,Student Name,Student Email,Lab ID,Lab Title,Tokens,Amount,Currency,Status,Purchase Date\n";
      for (const r of rows) {
        csv += `"${r.TransactionId}","${r.PaymentReference || ''}","${r.StudentName}","${r.StudentEmail}","${r.LabId}","${r.LabTitle}","${r.Credits}","${r.Amount}","${r.Currency}","${r.Status}","${new Date(r.CreatedAt).toISOString()}"\n`;
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="revenue_transaction_statement_${Date.now()}.csv"`);
      return res.status(200).send(csv);
    }

    if (reportType === "credit-consumption" || reportType === "rep-04") {
      const [rows] = await pool.query(`
        SELECT 
          ls.SessionId,
          ls.UserId,
          u.FullName AS StudentName,
          ls.LabId,
          ls.AllocatedCredits,
          COALESCE(ls.BilledTokens, 0) AS BilledTokens,
          COALESCE(ls.BilledSeconds, 0) AS BilledSeconds,
          ls.StartedAt,
          ls.EndedAt,
          ls.Status
        FROM ignito_experia.lab_sessions ls
        JOIN ignito_experia.users u ON ls.UserId = u.UserId
        WHERE ${directStudentWhere}
        ORDER BY ls.StartedAt DESC
      `);

      let csv = "Session ID,User ID,Student Name,Lab ID,Allocated Credits,Billed Tokens,Billed Seconds,Started At,Ended At,Status\n";
      for (const r of rows) {
        csv += `"${r.SessionId}","${r.UserId}","${r.StudentName}","${r.LabId}","${r.AllocatedCredits}","${r.BilledTokens}","${r.BilledSeconds}","${r.StartedAt ? new Date(r.StartedAt).toISOString() : ''}","${r.EndedAt ? new Date(r.EndedAt).toISOString() : ''}","${r.Status}"\n`;
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="credit_consumption_logs_${Date.now()}.csv"`);
      return res.status(200).send(csv);
    }

    return res.status(400).json({ success: false, message: "Invalid report type" });
  } catch (error) {
    console.error("[Owner Reports Export Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
