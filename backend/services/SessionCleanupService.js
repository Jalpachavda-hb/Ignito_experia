import pool from "../lib/mysql.js";
import { sessionPolicy } from "../config/sessionPolicy.js";

class SessionCleanupService {
  /**
   * Executes the background cleanup job.
   * Can be triggered via cron or internal interval.
   */
  async runCleanupJob() {
    const connection = await pool.getConnection();
    
    try {
      console.log("[SessionCleanup] Starting background cleanup job...");
      
      const now = new Date();
      
      // 1. Expire Idle Sessions (LastActivity older than IdleTimeout)
      const idleThreshold = new Date(now.getTime() - sessionPolicy.IdleTimeout * 1000);
      const [idleResult] = await connection.query(
        `UPDATE StudentSessions 
         SET Status = 'IDLE_TIMEOUT', LogoutTime = NOW() 
         WHERE Status = 'ACTIVE' AND LastActivity < ?`,
        [idleThreshold]
      );

      // 2. Expire Absolute Timeout (LoginTime older than AbsoluteSessionTimeout)
      const absoluteThreshold = new Date(now.getTime() - sessionPolicy.AbsoluteSessionTimeout * 1000);
      const [absoluteResult] = await connection.query(
        `UPDATE StudentSessions 
         SET Status = 'EXPIRED', LogoutTime = NOW() 
         WHERE Status = 'ACTIVE' AND LoginTime < ?`,
        [absoluteThreshold]
      );

      // 3. Delete Old Refresh Tokens (Revoked or Expired > 30 days ago to keep DB lean)
      const tokenThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const [tokenResult] = await connection.query(
        `DELETE FROM RefreshTokens 
         WHERE ExpiresAt < ? OR RevokedAt < ?`,
        [tokenThreshold, tokenThreshold]
      );

      console.log(`[SessionCleanup] Completed. Idle expired: ${idleResult.affectedRows}, Absolute expired: ${absoluteResult.affectedRows}, Old Tokens deleted: ${tokenResult.affectedRows}`);
      
    } catch (err) {
      console.error("[SessionCleanup] Error during background cleanup:", err);
    } finally {
      connection.release();
    }
  }
}

export const sessionCleanupService = new SessionCleanupService();
export default sessionCleanupService;
