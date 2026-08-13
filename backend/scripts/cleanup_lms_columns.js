import "../config/env.js";
import pool from "../lib/mysql.js";

async function cleanupColumns() {
  console.log("=== Removing Unnecessary LMS Profile Columns from Experia MySQL Users Table ===");

  const columnsToDrop = [
    "Mobile",
    "AlternateMobile",
    "Gender",
    "DateOfBirth",
    "Address",
    "ProfileImage",
    "ProgrammesJson",
    "AcademicYear",
    "EnrollmentStatus",
    "ProgramId",
    "SemesterId",
    "StudentCode",
    "Batch",
    "Section",
    "DepartmentId",
    "AuthenticationSource"
  ];

  const connection = await pool.getConnection();

  try {
    // Get current columns of Users table
    const [cols] = await connection.query("SHOW COLUMNS FROM Users");
    const existingColNames = cols.map(c => c.Field);

    for (const col of columnsToDrop) {
      if (existingColNames.includes(col)) {
        try {
          console.log(`Dropping column '${col}' from Users...`);
          await connection.query(`ALTER TABLE Users DROP COLUMN \`${col}\``);
          console.log(`✅ Column '${col}' dropped successfully.`);
        } catch (err) {
          console.error(`Failed to drop column '${col}':`, err.message);
        }
      } else {
        console.log(`Column '${col}' already removed or does not exist.`);
      }
    }

    console.log("\n✅ MySQL Users table clean up complete! Experia Users table now contains only minimal identity fields.");
  } catch (err) {
    console.error("Cleanup failed:", err);
  } finally {
    connection.release();
    process.exit(0);
  }
}

cleanupColumns();
