import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../lib/mysql.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROCEDURES_DIR = path.join(__dirname, "../database/procedures/labs");

const SCHEMA_DIR = path.join(__dirname, "../database/schema");

async function executeSqlFile(filePath, isProcedure = true) {
  try {
    const sqlContent = await fs.readFile(filePath, "utf-8");

    if (!isProcedure) {
      console.log(`Executing Schema: ${path.basename(filePath)}`);
      // Just run the whole query (works for CREATE TABLE)
      await pool.query(sqlContent);
      console.log(`Successfully processed schema ${path.basename(filePath)}`);
      return;
    }

    // Replace `DELIMITER //` and `DELIMITER ;`
    let cleanSql = sqlContent
      .replace(/DELIMITER \/\//g, "")
      .replace(/DELIMITER ;/g, "");

    // Split by END // or ;
    const dropMatch = cleanSql.match(/DROP PROCEDURE IF EXISTS `[^`]+`;/);
    if (dropMatch) {
      console.log("Executing DROP...");
      await pool.query(dropMatch[0]);
    }

    // Now extract the CREATE statement block
    const createMatch = cleanSql.match(/CREATE PROCEDURE[\s\S]+?END[ \t]*\/\//);
    if (createMatch) {
      // Remove the trailing // from END //
      const createStmt = createMatch[0].replace(/\/\/\s*$/, "");
      console.log("Executing CREATE PROCEDURE...");
      await pool.query(createStmt);
    }

    console.log(`Successfully processed ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`Error processing ${path.basename(filePath)}:`, error);
  }
}

async function run() {
  console.log("Starting Database Setup...");
  try {
    // 1. Run Schema
    const schemaFile = path.join(SCHEMA_DIR, "003_labs_table.sql");
    try {
      await fs.access(schemaFile);
      console.log(`\n--- Reading Schema ---`);
      await executeSqlFile(schemaFile, false);
    } catch (e) {
      console.log("Schema file not found or already executed.");
    }

    // 2. Run Procedures
    const files = await fs.readdir(PROCEDURES_DIR);
    for (const file of files) {
      if (file.endsWith(".sql")) {
        console.log(`\n--- Reading ${file} ---`);
        await executeSqlFile(path.join(PROCEDURES_DIR, file));
      }
    }
  } catch (error) {
    console.error("Setup failed:", error);
  } finally {
    console.log("Done.");
    process.exit(0);
  }
}

run();
