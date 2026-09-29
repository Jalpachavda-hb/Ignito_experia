import pool from "../lib/mysql.js";
import { cacheProvider } from "../lib/cache.js";

class StudentStatisticsService {
  async getSummary() {
    const cacheKey = "students:statistics:summary";
    const cached = await cacheProvider.get(cacheKey);
    if (cached) return cached;

    // Simple aggregations
    const [totalRows] = await pool.query("SELECT COUNT(*) as count FROM Users WHERE Role = 'Student' AND COALESCE(Status, 'Active') <> 'Inactive'");
    const [sourceRows] = await pool.query("SELECT CreatedFrom, COUNT(*) as count FROM Users WHERE Role = 'Student' AND COALESCE(Status, 'Active') <> 'Inactive' GROUP BY CreatedFrom");
    const [statusRows] = await pool.query("SELECT Status, COUNT(*) as count FROM Users WHERE Role = 'Student' AND COALESCE(Status, 'Active') <> 'Inactive' GROUP BY Status");

    const result = {
      total: totalRows[0].count,
      bySource: sourceRows.reduce((acc, row) => ({ ...acc, [row.CreatedFrom]: row.count }), {}),
      byStatus: statusRows.reduce((acc, row) => ({ ...acc, [row.Status]: row.count }), {})
    };

    await cacheProvider.set(cacheKey, result, 300); // 5 min cache
    return result;
  }
}

export const studentStatisticsService = new StudentStatisticsService();
export default studentStatisticsService;
