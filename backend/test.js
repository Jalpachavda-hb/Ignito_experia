import pool from './lib/mysql.js';
async function test() {
  const [rows] = await pool.query('SHOW TRIGGERS');
  console.log(rows);
  process.exit(0);
}
test();
