import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupDir = path.join(__dirname, "..", "database", "backups");
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.join(backupDir, `backup_before_clean_${timestamp}.json`);

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  multipleStatements: true,
};

// Exact tables to keep intact
const PRESERVED_TABLES = {
  ignito_experia: [],
  ignito_experia_owner: ["labs", "owner_users", "runtime_types"],
};

async function cleanDatabases() {
  const conn = await mysql.createConnection(DB_CONFIG);

  try {
    console.log("==================================================");
    console.log("STEP 1: CREATING FULL DATA BACKUP...");
    console.log("==================================================");

    const fullBackup = {};
    const databases = ["ignito_experia", "ignito_experia_owner"];

    for (const db of databases) {
      fullBackup[db] = {};
      await conn.query(`USE \`${db}\``);
      const [tables] = await conn.query("SHOW TABLES");

      for (const row of tables) {
        const tableName = Object.values(row)[0];
        const [rows] = await conn.query(`SELECT * FROM \`${tableName}\``);
        fullBackup[db][tableName] = rows;
      }
    }

    fs.writeFileSync(backupFile, JSON.stringify(fullBackup, null, 2), "utf-8");
    console.log(`[Backup Saved] Backup successfully created at:\n  -> ${backupFile}\n`);

    console.log("==================================================");
    console.log("STEP 2: CLEANING TABLES (KEEPING owner_users & labs)...");
    console.log("==================================================");

    await conn.query("SET FOREIGN_KEY_CHECKS = 0;");

    for (const db of databases) {
      console.log(`\n--- Cleaning Database: \`${db}\` ---`);
      await conn.query(`USE \`${db}\``);
      const [tables] = await conn.query("SHOW TABLES");

      const keepList = PRESERVED_TABLES[db] || [];

      for (const row of tables) {
        const tableName = Object.values(row)[0];
        const lowerName = tableName.toLowerCase();

        if (keepList.map((t) => t.toLowerCase()).includes(lowerName)) {
          const [cnt] = await conn.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
          console.log(`[PRESERVED] \`${db}\`.\`${tableName}\`: ${cnt[0].count} rows retained intact.`);
        } else {
          await conn.query(`TRUNCATE TABLE \`${tableName}\``);
          console.log(`[CLEANED]   \`${db}\`.\`${tableName}\`: all data removed.`);
        }
      }
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1;");

    console.log("\n==================================================");
    console.log("STEP 3: POST-CLEANUP VERIFICATION");
    console.log("==================================================");

    for (const db of databases) {
      console.log(`\nSummary for database: \`${db}\``);
      await conn.query(`USE \`${db}\``);
      const [tables] = await conn.query("SHOW TABLES");

      for (const row of tables) {
        const tableName = Object.values(row)[0];
        const [cnt] = await conn.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
        console.log(`  - ${tableName}: ${cnt[0].count} rows`);
      }
    }

    console.log("\n==================================================");
    console.log("CLEANUP COMPLETED SUCCESSFULLY!");
    console.log("==================================================");
  } catch (error) {
    console.error("Error during database clean:", error);
    throw error;
  } finally {
    await conn.end();
  }
}

cleanDatabases().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
