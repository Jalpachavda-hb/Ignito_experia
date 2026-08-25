import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function dropErrorLogs() {
  console.log("Connecting to Owner MySQL database:", process.env.DB_NAME || "ignito_experia_owner");

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "3306", 10),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "ignito_experia_owner"
    });

    console.log("Dropping error_logs table from ignito_experia_owner...");
    await connection.query("DROP TABLE IF EXISTS error_logs;");
    console.log("SUCCESS: error_logs table dropped cleanly!");

    const [tables] = await connection.query("SHOW TABLES;");
    console.log("\nAll remaining active tables in ignito_experia_owner (All data preserved):");
    console.log(tables.map(t => Object.values(t)[0]));

  } catch (err) {
    console.error("ERROR dropping error_logs table:", err.message);
  } finally {
    if (connection) await connection.end();
  }
}

dropErrorLogs();
