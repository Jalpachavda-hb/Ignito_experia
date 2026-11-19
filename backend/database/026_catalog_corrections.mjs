// Lab catalog corrections (docs/lab-catalog.md §2): make lab metadata match what the
// environments actually contain.
//
//   data-science-lab  Advanced → Intermediate (one notebook, pandas/scikit-learn, small CPU)
//   big-data-lab      Advanced → Intermediate, no Spark (single-node HDFS + Java libraries)
//   mobile-app-lab    "React Native or Flutter" / "Android & iOS" → native Android (Java)
//
// Only updates rows that exist; idempotent.
// Usage: node database/026_catalog_corrections.mjs [--dry-run]

import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DRY_RUN = process.argv.includes("--dry-run");
const TABLE = "`ignito_experia_owner`.`labs`";

const CORRECTIONS = [
  {
    LabCode: "data-science-lab",
    Complexity: "Intermediate",
  },
  {
    LabCode: "big-data-lab",
    Complexity: "Intermediate",
    Description: "Hands-on experience with Hadoop: single-node HDFS and Java big-data libraries.",
  },
  {
    LabCode: "mobile-app-lab",
    Subtitle: "Native Android Development (Java)",
    Description: "Build native Android applications in Java with the Android SDK and Gradle.",
  },
];

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "ignito_experia",
  });
  try {
    const [colRows] = await conn.query(`SHOW COLUMNS FROM ${TABLE}`);
    const columns = new Set(colRows.map((c) => c.Field));
    const codes = CORRECTIONS.map((c) => c.LabCode);
    const show = async (label) => {
      const [rows] = await conn.query(
        `SELECT LabCode, Subtitle, Complexity, Description FROM ${TABLE} WHERE LabCode IN (?)`,
        [codes],
      );
      console.log(label);
      console.table(rows);
    };

    console.log(`Target: ${process.env.DB_HOST || "localhost"} ${TABLE}${DRY_RUN ? "  (DRY RUN)" : ""}`);
    await show("Before:");
    await conn.beginTransaction();
    for (const { LabCode, ...fields } of CORRECTIONS) {
      const updates = Object.fromEntries(Object.entries(fields).filter(([k]) => columns.has(k)));
      if (columns.has("UpdatedDate")) updates.UpdatedDate = new Date();
      const [res] = await conn.query(`UPDATE ${TABLE} SET ? WHERE LabCode = ?`, [updates, LabCode]);
      console.log(`${LabCode}: ${res.affectedRows ? "updated" : "not found, skipped"}`);
    }
    await show("After:");
    if (DRY_RUN) {
      await conn.rollback();
      console.log("Dry run: rolled back, nothing changed.");
    } else {
      await conn.commit();
      console.log("Committed.");
    }
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
