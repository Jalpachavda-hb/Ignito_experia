import pool from '../lib/mysql.js';

async function run() {
  try {
    await pool.query('ALTER TABLE course_lab_mappings ADD COLUMN practical_credit INT NOT NULL DEFAULT 60');
    console.log('Added practical_credit column');
  } catch (e) {
    console.log('Column note:', e.message);
  }
  await pool.query("UPDATE course_lab_mappings SET practical_credit = 90 WHERE course_code = 'MC01094031' OR lab_id LIKE '%dbms%'");
  await pool.query("UPDATE course_lab_mappings SET practical_credit = 80 WHERE course_code = 'MC01094011' OR lab_id LIKE '%dotnet%'");
  const [rows] = await pool.query('SELECT course_code, lab_id, practical_credit FROM course_lab_mappings');
  console.log('UPDATED MAPPINGS:', rows);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
