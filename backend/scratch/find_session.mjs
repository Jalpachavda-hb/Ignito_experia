import dotenv from 'dotenv';
dotenv.config();
import pool from '../lib/mysql.js';

async function main() {
  const [tables] = await pool.query('SHOW TABLES');
  for (const t of tables) {
    const table = Object.values(t)[0];
    try {
      const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE CONCAT_WS(' ', \`${table}\`.*) LIKE '%sess_c0db8bc4%' LIMIT 1`);
      if (rows.length) {
        console.log('Found in table:', table, rows[0]);
      }
    } catch(e) {}
  }
  process.exit(0);
}
main().catch(console.error);
