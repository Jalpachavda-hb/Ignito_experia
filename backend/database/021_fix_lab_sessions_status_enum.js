import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

export async function fixLabSessionsStatusEnum() {
  const { default: pool } = await import('../lib/mysql.js');

  try {
    await pool.query(`
      ALTER TABLE lab_sessions 
      MODIFY COLUMN Status ENUM('PENDING','STARTING','RUNNING','EXPIRING_SOON','STOPPING','COMPLETED','EXPIRED','FAILED','STOPPED') 
      NOT NULL DEFAULT 'STARTING'
    `);
    console.log('ALTER TABLE lab_sessions Status ENUM succeeded');
  } catch (err) {
    console.warn('ALTER TABLE lab_sessions Status ENUM note:', err.message);
  }

  try {
    const [res] = await pool.query(`
      UPDATE lab_sessions 
      SET Status = 'COMPLETED' 
      WHERE Status = '' OR Status = 'STOPPED' OR EndedAt IS NOT NULL
    `);
    console.log('Updated stopped/ended lab_sessions count:', res.affectedRows);
  } catch (err) {
    console.error('Error updating sessions:', err.message);
  }
}

if (process.argv[1]?.endsWith('021_fix_lab_sessions_status_enum.js')) {
  fixLabSessionsStatusEnum()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
