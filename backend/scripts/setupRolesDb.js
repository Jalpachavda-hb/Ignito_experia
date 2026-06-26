import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = parseInt(process.env.DB_PORT || "3306", 10);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "ignito_experia";

const SCHEMA_DIR = path.join(__dirname, "../database/schema");
const SEEDS_DIR = path.join(__dirname, "../database/seeds");
const PROCEDURES_DIR = path.join(__dirname, "../database/procedures/roles");

async function run() {
  console.log("Starting Roles & Permissions DB setup...");
  let connection;
  try {
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      multipleStatements: true,
    });
    console.log("Database connected successfully.");

    // 1. Run Schemas
    const schemas = [
      "004_roles_table.sql",
      "005_role_permissions_table.sql",
      "006_users_add_roleid.sql",
    ];

    for (const schema of schemas) {
      const filePath = path.join(SCHEMA_DIR, schema);
      console.log(`Executing Schema: ${schema}`);
      const content = await fs.readFile(filePath, "utf-8");
      await connection.query(content);
      console.log(`Finished Schema: ${schema}`);
    }

    // 2. Run Seeds
    const seedFile = "seed_roles.sql";
    const seedPath = path.join(SEEDS_DIR, seedFile);
    console.log(`Executing Seed: ${seedFile}`);
    const seedContent = await fs.readFile(seedPath, "utf-8");
    await connection.query(seedContent);
    console.log(`Finished Seed: ${seedFile}`);

    // 3. Run Procedures
    const procedures = [
      "sp_Role_GetAll.sql",
      "sp_Role_GetById.sql",
      "sp_Role_Insert.sql",
      "sp_Role_Update.sql",
      "sp_Role_Delete.sql",
    ];

    for (const proc of procedures) {
      const filePath = path.join(PROCEDURES_DIR, proc);
      console.log(`Executing Procedure: ${proc}`);
      const content = await fs.readFile(filePath, "utf-8");

      // Clean DELIMITER lines
      const cleanSql = content
        .replace(/DELIMITER \/\//g, "")
        .replace(/DELIMITER ;/g, "");

      // Execute drop
      const dropMatch = cleanSql.match(/DROP PROCEDURE IF EXISTS `[^`]+`;/);
      if (dropMatch) {
        await connection.query(dropMatch[0]);
      }

      // Execute create
      const createMatch = cleanSql.match(/CREATE PROCEDURE[\s\S]+?END[ \t]*\/\//);
      if (createMatch) {
        const createStmt = createMatch[0].replace(/\/\/\s*$/, "");
        await connection.query(createStmt);
      } else {
        // If not matching END // pattern exactly, fallback to executing remaining block
        const fallbackMatch = cleanSql.match(/CREATE PROCEDURE[\s\S]+/);
        if (fallbackMatch) {
          await connection.query(fallbackMatch[0]);
        }
      }
      console.log(`Finished Procedure: ${proc}`);
    }

    console.log("Roles & Permissions DB setup completed successfully!");
  } catch (error) {
    console.error("Roles & Permissions DB setup failed:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

run();
