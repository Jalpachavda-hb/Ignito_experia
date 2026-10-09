import pool from '../lib/mysql.js';

async function run() {
  const [users] = await pool.query('SELECT UserId, Email, FullName, AuthType FROM Users WHERE Email LIKE ?', ['%uu22%']);
  console.log('Users:', users);
  for (const u of users) {
    const uId = u.UserId;
    const [wallets] = await pool.query('SELECT * FROM student_lab_token_wallets WHERE StudentId = ?', [String(uId)]);
    console.log('Wallets for UserId', uId, ':', wallets);
    const [txs] = await pool.query('SELECT * FROM credit_transactions WHERE UserId = ?', [uId]);
    console.log('Transactions for UserId', uId, ':', txs);
    const [labTxs] = await pool.query('SELECT * FROM student_lab_token_transactions WHERE StudentId = ?', [String(uId)]);
    console.log('student_lab_token_transactions for UserId', uId, ':', labTxs);
  }
  const [mappings] = await pool.query('SELECT * FROM course_lab_mappings');
  console.log('course_lab_mappings:', mappings);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
