import mysql from "mysql2/promise";
import { ENV } from "../config/env.js"; // Wait, I should check if ENV exists or use process.env directly.

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "ignito_experia",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const getDbConnection = async () => {
  return await pool.getConnection();
};

export const verifyDbConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("[MySQL] Connected successfully to the database.");
    connection.release();

    try {
      const [columns] = await pool.query("SHOW COLUMNS FROM Labs;");
      const hasIsDeleted = columns.some(c => c.Field === 'IsDeleted');
      const activeField = hasIsDeleted ? 'IsDeleted' : 'IsActive';
      const activeVal = hasIsDeleted ? 0 : 1;

      console.log("[MySQL] Seeding mobile-app-lab if not exists...");
      await pool.query(`INSERT IGNORE INTO Labs (
          LabCode, Title, Subtitle, Semester, Logo, DurationMinutes, Credits,
          Complexity, Category, Description, Status, TaskDefinition, RuntimeType, RuntimePort,
          RuntimePath, ContainerApiEnabled, ContainerApiPort, ${activeField}
      ) VALUES (
          'mobile-app-lab',
          'Mobile Application Development Lab',
          'Android Development with Gradle',
          'Semester 4',
          'default_android_logo.png',
          60,
          30,
          'Intermediate',
          'Mobile Development',
          'Build and test Android applications using Gradle, SDK tools, and Java without needing a heavy GUI editor or emulator.',
          'active',
          'vlab-dev-android-task',
          'ide',
          8080,
          '/',
          1,
          8080,
          ${activeVal}
      );`);
      console.log("[MySQL] Seeding completed successfully.");
    } catch (dbErr) {
      console.error("[MySQL] Android Lab seeding failed:", dbErr.message);
    }

    return true;
  } catch (error) {
    console.error("[MySQL] Failed to connect to the database:", error.message);
    return false;
  }
};

export default pool;
