import pool from "../../lib/mysql.js";
import { cacheProvider } from "../../lib/cache.js";

class DashboardAnalyticsService {
  
  /**
   * Reads precomputed metrics for the quick overview widget.
   */
  async getOverviewWidget(timeRange = '7d', universityId = 0) {
    const cacheKey = `analytics:widget:overview:${timeRange}:${universityId}`;
    const cached = await cacheProvider.get(cacheKey);
    if (cached) return cached;

    // We query the Summary table rather than raw tables.
    // E.g. '7d' logic means last 7 days.
    const [rows] = await pool.query(`
      SELECT 
        SUM(TotalLogins) as TotalLogins,
        SUM(UniqueActiveUsers) as UniqueActiveUsers,
        SUM(FailedLogins) as FailedLogins,
        SUM(LabsStarted) as LabsStarted
      FROM Analytics_DailySummary
      WHERE SummaryDate >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      AND UniversityId = ?
    `, [universityId || 0]);

    const result = rows[0] || { TotalLogins: 0, UniqueActiveUsers: 0, FailedLogins: 0, LabsStarted: 0 };
    
    // Cache for 5 minutes
    await cacheProvider.set(cacheKey, result, 300);
    return result;
  }

  /**
   * Realtime active users (Current) widget.
   */
  async getRealtimeWidget(universityId = null) {
    // 30 second cache TTL to avoid DB flooding on dashboard load
    const cacheKey = `analytics:widget:realtime:${universityId}`;
    const cached = await cacheProvider.get(cacheKey);
    if (cached) return cached;

    let query = "SELECT COUNT(*) as active FROM StudentSessions WHERE Status = 'ACTIVE'";
    let params = [];
    if (universityId) {
      query += " AND UniversityId = ?";
      params.push(universityId);
    }

    const [rows] = await pool.query(query, params);
    const result = { onlineNow: rows[0].active };

    await cacheProvider.set(cacheKey, result, 30);
    return result;
  }
}

export const dashboardAnalyticsService = new DashboardAnalyticsService();
export default dashboardAnalyticsService;
