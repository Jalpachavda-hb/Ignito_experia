import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function runMigration() {
  console.log("Connecting to MySQL...");
  console.log("Host:", process.env.DB_HOST);
  console.log("User:", process.env.DB_USER);
  console.log("DB:", process.env.DB_NAME);

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

    const sqlPath = path.join(__dirname, "..", "database", "017_fix_continuous_token_tables.sql");
    console.log("Reading 017 migration SQL from:", sqlPath);
    const sql = fs.readFileSync(sqlPath, "utf8");

    console.log("Executing 017 continuous token billing fix migration...");
    await connection.query(sql);
    console.log("SUCCESS: 017 continuous token billing fix migration executed successfully!");

    const [tables] = await connection.query("SHOW TABLES;");
    console.log("\nFinal active tables in database:");
    console.log(tables.map(t => Object.values(t)[0]));

  } catch (err) {
    console.error("ERROR executing migration:", err.message);
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();
