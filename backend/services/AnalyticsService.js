import pool from "../lib/mysql.js";
import { cacheProvider } from "../lib/cache.js";

class AnalyticsService {
  /**
   * Main dashboard aggregation
   */
  async getDashboardAnalytics() {
    const cacheKey = "analytics:dashboard:full";
    const cached = await cacheProvider.get(cacheKey);
    if (cached) return cached;

    // Use Promise.all to fetch all metrics concurrently
    const queries = [
      // 0. Total Direct Students vs LMS
      pool.query(`
        SELECT AuthenticationSource, COUNT(*) as Count 
        FROM Users 
        WHERE Role = 'Student' AND IsDeleted = 0
        GROUP BY AuthenticationSource
      `),
      
      // 1. Daily Active Users (Unique Students logged in today)
      pool.query(`
        SELECT COUNT(DISTINCT UserId) as DAU 
        FROM StudentSessions 
        WHERE DATE(LoginTime) = CURDATE() AND UserId IS NOT NULL
      `),
      
      // 2. Monthly Active Users
      pool.query(`
        SELECT COUNT(DISTINCT UserId) as MAU 
        FROM StudentSessions 
        WHERE LoginTime >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND UserId IS NOT NULL
      `),
      
      // 3. Failed Logins (From Audit)
      pool.query(`
        SELECT COUNT(*) as FailedLogins 
        FROM AuditLogs 
        WHERE Action = 'FAILED_LOGIN' AND CreatedAt >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      `),
      
      // 4. Session Durations (Avg over last 7 days where logged out)
      pool.query(`
        SELECT AVG(TIMESTAMPDIFF(MINUTE, LoginTime, LogoutTime)) as AvgSessionMinutes 
        FROM StudentSessions 
        WHERE LogoutTime IS NOT NULL AND LoginTime >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      `),
 
      // 5. University Usage Distribution
      pool.query(`
        SELECT UniversityId as University, COUNT(*) as Students 
        FROM Users
        WHERE Role = 'Student' AND IsDeleted = 0
        GROUP BY UniversityId
        ORDER BY Students DESC
        LIMIT 5
      `),

      // 6. Device/Browser distributions
      pool.query(`
        SELECT Browser, COUNT(*) as Count 
        FROM StudentSessions 
        GROUP BY Browser ORDER BY Count DESC LIMIT 5
      `),
      pool.query(`
        SELECT OperatingSystem, COUNT(*) as Count 
        FROM StudentSessions 
        GROUP BY OperatingSystem ORDER BY Count DESC LIMIT 5
      `)
    ];

    const [
      [sourceDist], [dau], [mau], [failed], [sessionDur], [univUsage], [browsers], [os]
    ] = await Promise.all(queries);

    const payload = {
      demographics: {
        totalDirect: sourceDist.find(s => s.AuthenticationSource === 'DIRECT')?.Count || 0,
        totalLms: sourceDist.find(s => s.AuthenticationSource === 'LMS')?.Count || 0
      },
      activity: {
        dau: dau[0]?.DAU || 0,
        mau: mau[0]?.MAU || 0,
        failedLogins7d: failed[0]?.FailedLogins || 0,
        avgSessionDurationMins: Math.round(sessionDur[0]?.AvgSessionMinutes || 0)
      },
      topUniversities: univUsage,
      platforms: {
        browsers,
        operatingSystems: os
      }
    };

    // Cache this expensive aggregation for 5 minutes
    await cacheProvider.set(cacheKey, payload, 300);
    return payload;
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
