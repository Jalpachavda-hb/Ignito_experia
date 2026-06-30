import pool from "../../lib/mysql.js";

/**
 * Background Service to precompute heavy aggregations.
 * In a real production system, this runs nightly at midnight.
 */
class AnalyticsCronService {
  async runDailyAggregation(targetDateStr = null) {
    const targetDate = targetDateStr || new Date().toISOString().split('T')[0];
    
    console.log(`[AnalyticsCron] Starting daily aggregation for ${targetDate}`);
    
    // We execute heavy INSERT ... SELECT ON DUPLICATE KEY UPDATE queries.
    // For brevity, we aggregate Global stats (UniversityId = 0).
    const connection = await pool.getConnection();

    try {
      // Aggregate Logins & Users
      await connection.query(`
        INSERT INTO Analytics_DailySummary 
          (SummaryDate, UniversityId, TotalLogins, UniqueActiveUsers)
        SELECT 
          ?, 
          0,
          COUNT(*),
          COUNT(DISTINCT UserId)
        FROM StudentSessions
        WHERE DATE(LoginTime) = ?
        ON DUPLICATE KEY UPDATE 
          TotalLogins = VALUES(TotalLogins),
          UniqueActiveUsers = VALUES(UniqueActiveUsers)
      `, [targetDate, targetDate]);

      // Aggregate Audit (Failed Logins, Labs)
      await connection.query(`
        INSERT INTO Analytics_DailySummary 
          (SummaryDate, UniversityId, FailedLogins, LabsStarted)
        SELECT 
          ?, 
          0,
          SUM(CASE WHEN Action = 'FAILED_LOGIN' THEN 1 ELSE 0 END),
          SUM(CASE WHEN Action = 'LAB_STARTED' THEN 1 ELSE 0 END)
        FROM AuditLogs
        WHERE DATE(CreatedAt) = ?
        ON DUPLICATE KEY UPDATE 
          FailedLogins = VALUES(FailedLogins),
          LabsStarted = VALUES(LabsStarted)
      `, [targetDate, targetDate]);

      console.log(`[AnalyticsCron] Completed daily aggregation for ${targetDate}`);
    } catch (err) {
      console.error("[AnalyticsCron] Aggregation failed:", err);
    } finally {
      connection.release();
    }
  }
}

export const analyticsCronService = new AnalyticsCronService();
export default analyticsCronService;
