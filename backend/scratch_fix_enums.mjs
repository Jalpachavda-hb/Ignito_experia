import { getDbConnection } from './lib/mysql.js';

async function main() {
  const conn = await getDbConnection();
  try {
    await conn.query("ALTER TABLE student_lab_token_transactions MODIFY COLUMN TransactionType ENUM('PURCHASE', 'USAGE', 'CONSUMPTION', 'REFUND', 'ADJUSTMENT', 'ALLOCATION') NOT NULL DEFAULT 'USAGE'");
    console.log('student_lab_token_transactions enum updated');
    await conn.query("ALTER TABLE credit_transactions MODIFY COLUMN Type ENUM('PURCHASE', 'USAGE', 'CONSUMPTION', 'DEDUCTION', 'LAB_USAGE', 'LAB_EXTENSION', 'REFUND', 'BONUS', 'ADJUSTMENT', 'ALLOCATION') NOT NULL DEFAULT 'PURCHASE'");
    console.log('credit_transactions enum updated');
  } catch (err) {
    console.error('Error updating enums:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

main();
