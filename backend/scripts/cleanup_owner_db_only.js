import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function dropOwnerUsersTableOnly() {
  console.log("Connecting ONLY to ignito_experia_owner database...");

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "3306", 10),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: "ignito_experia_owner"
    });

    console.log("Dropping users table from ignito_experia_owner...");
    await connection.query("DROP TABLE IF EXISTS users;");
    console.log("SUCCESS: users table removed from ignito_experia_owner!");

    const [tables] = await connection.query("SHOW TABLES;");
    console.log("\nRemaining active tables in ignito_experia_owner database:");
    console.log(tables.map(t => Object.values(t)[0]));

  } catch (err) {
    console.error("ERROR cleaning up ignito_experia_owner database:", err.message);
  } finally {
    if (connection) await connection.end();
  }
}

dropOwnerUsersTableOnly();
