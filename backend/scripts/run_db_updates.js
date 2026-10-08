import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function runDbUpdates() {
  console.log("Connecting to MySQL database for updates...");
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "3306", 10),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "ignito_experia",
      multipleStatements: true,
    });

    const migrationFile = path.join(__dirname, "..", "database", "023_cascade_delete_student_data.sql");
    if (fs.existsSync(migrationFile)) {
      console.log(`Running migration: 023_cascade_delete_student_data.sql`);
      const sql = fs.readFileSync(migrationFile, "utf8");
      await connection.query(sql);
      console.log("✅ Successfully executed 023_cascade_delete_student_data.sql");
    }

    console.log("Database update process completed successfully.");
  } catch (err) {
    console.error("❌ Error running database updates:", err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runDbUpdates();
