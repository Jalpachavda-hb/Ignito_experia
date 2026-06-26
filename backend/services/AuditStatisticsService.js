import pool from "../lib/mysql.js";

class AuditStatisticsService {
  async getDashboardStatistics() {
    // Execute multiple aggregates concurrently for dashboard speed
    const queries = [
      pool.query("SELECT COUNT(*) as total FROM AuditLogs"),
      pool.query("SELECT COUNT(*) as today FROM AuditLogs WHERE DATE(CreatedAt) = CURDATE()"),
      pool.query("SELECT Category, COUNT(*) as count FROM AuditLogs GROUP BY Category"),
      pool.query("SELECT Severity, COUNT(*) as count FROM AuditLogs GROUP BY Severity"),
      pool.query("SELECT Action, COUNT(*) as count FROM AuditLogs WHERE Action IN ('FAILED_LOGIN', 'LOGIN', 'LAB_STARTED') GROUP BY Action"),
      pool.query("SELECT Source, COUNT(*) as count FROM AuditLogs WHERE Source IN ('LMS', 'DIRECT') GROUP BY Source")
    ];

    const [
      [totalResult], [todayResult], [categoryResult], [severityResult], [actionResult], [sourceResult]
    ] = await Promise.all(queries);

    return {
      totalLogs: totalResult[0].total,
      todayLogs: todayResult[0].today,
      byCategory: categoryResult.reduce((acc, row) => ({ ...acc, [row.Category]: row.count }), {}),
      bySeverity: severityResult.reduce((acc, row) => ({ ...acc, [row.Severity]: row.count }), {}),
      byAction: actionResult.reduce((acc, row) => ({ ...acc, [row.Action]: row.count }), {}),
      bySource: sourceResult.reduce((acc, row) => ({ ...acc, [row.Source]: row.count }), {})
    };
  }
}

export const auditStatisticsService = new AuditStatisticsService();
export default auditStatisticsService;
