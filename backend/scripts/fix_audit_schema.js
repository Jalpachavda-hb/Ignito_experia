import pool from '../lib/mysql.js';

async function fixAuditLogs() {
  const connection = await pool.getConnection();
  try {
    console.log("Altering AuditLogs to include UserId...");
    await connection.query(`ALTER TABLE AuditLogs ADD COLUMN IF NOT EXISTS UserId BIGINT NULL AFTER SessionId`);
    console.log("AuditLogs successfully fixed.");
  } catch (err) {
    console.error("Failed to alter AuditLogs table:", err);
  } finally {
    connection.release();
    process.exit(0);
  }
}

fixAuditLogs();
