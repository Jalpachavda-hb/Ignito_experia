import pool from '../lib/mysql.js';

async function fixSessions() {
  const connection = await pool.getConnection();
  try {
    console.log("Altering StudentSessions...");
    await connection.query(`ALTER TABLE StudentSessions ADD COLUMN IF NOT EXISTS UserId BIGINT NULL AFTER SessionId`);
    await connection.query(`ALTER TABLE StudentSessions MODIFY StudentProfileId BIGINT NULL`);
    
    console.log("Altering RefreshTokens...");
    await connection.query(`ALTER TABLE RefreshTokens ADD COLUMN IF NOT EXISTS UserId BIGINT NULL AFTER Id`);
    await connection.query(`ALTER TABLE RefreshTokens MODIFY StudentProfileId BIGINT NULL`);
    
    console.log("Session tables successfully fixed.");
  } catch (err) {
    console.error("Failed to alter session tables:", err);
  } finally {
    connection.release();
    process.exit(0);
  }
}

fixSessions();
