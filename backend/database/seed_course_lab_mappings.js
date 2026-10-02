import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

export async function seedCourseLabMappings() {
  const { default: pool } = await import('../lib/mysql.js');
  const rows = [
    ['tnt_4925e025aa50', '2', '1', 'MC01094011', 'dotnet-lab', 'active', 'system'],
    ['tnt_4925e025aa50', '2', '1', 'MC01094031', 'dbms-lab', 'active', 'system'],
    ['tnt_4925e025aa50', '2', '5', 'MC01094011', 'dotnet-lab', 'active', 'system'],
    ['tnt_4925e025aa50', '2', '5', 'MC01094031', 'dbms-lab', 'active', 'system'],
    ['PLATFORM', '2', '1', 'MC01094011', 'dotnet-lab', 'active', 'system'],
    ['PLATFORM', '2', '1', 'MC01094031', 'dbms-lab', 'active', 'system'],
    ['PLATFORM', '2', '5', 'MC01094011', 'dotnet-lab', 'active', 'system'],
    ['PLATFORM', '2', '5', 'MC01094031', 'dbms-lab', 'active', 'system'],
  ];

  for (const r of rows) {
    await pool.query(
      `INSERT INTO course_lab_mappings (tenant_id, program_id, semester_id, course_code, lab_id, status, mapped_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE lab_id = VALUES(lab_id), status = VALUES(status)`,
      r
    );
  }

  const [res] = await pool.query('SELECT * FROM course_lab_mappings');
  console.log('Seeded course_lab_mappings count:', res.length);
  return res;
}

if (process.argv[1]?.endsWith('seed_course_lab_mappings.js')) {
  seedCourseLabMappings()
    .then((res) => {
      console.log('Mappings:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
