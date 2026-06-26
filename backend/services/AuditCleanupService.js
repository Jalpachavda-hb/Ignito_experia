import pool from "../lib/mysql.js";
import { auditPolicy } from "../config/auditPolicy.js";

class AuditCleanupService {
  async runRetentionCleanup() {
    if (!auditPolicy.RetentionDays) {
      console.log("[AuditCleanup] RetentionDays is unlimited. Skipping.");
      return;
    }

    const connection = await pool.getConnection();
    
    try {
      console.log("[AuditCleanup] Starting audit log retention sync...");

      const thresholdDate = new Date(Date.now() - auditPolicy.RetentionDays * 24 * 60 * 60 * 1000);

      // Phase 1: Archive (Move to AuditLogs_Archive)
      // MySQL INSERT ... SELECT is efficient for this.
      const archiveQuery = `
        INSERT IGNORE INTO AuditLogs_Archive
        SELECT * FROM AuditLogs WHERE CreatedAt < ? LIMIT ?
      `;
      const [archiveResult] = await connection.query(archiveQuery, [thresholdDate, auditPolicy.ArchiveBatchSize]);

      // Phase 2: Delete archived records from active table
      if (archiveResult.affectedRows > 0) {
         // Using subquery to delete exactly what was archived (or just same date constraint)
         const deleteQuery = `
           DELETE FROM AuditLogs WHERE CreatedAt < ? LIMIT ?
         `;
         const [deleteResult] = await connection.query(deleteQuery, [thresholdDate, auditPolicy.ArchiveBatchSize]);
         console.log(`[AuditCleanup] Archived ${archiveResult.affectedRows} records, Deleted ${deleteResult.affectedRows} records.`);
      } else {
         console.log("[AuditCleanup] No old audit logs to archive.");
      }

    } catch (err) {
      console.error("[AuditCleanup] Error during retention sync:", err);
    } finally {
      connection.release();
    }
  }
}

export const auditCleanupService = new AuditCleanupService();
export default auditCleanupService;
