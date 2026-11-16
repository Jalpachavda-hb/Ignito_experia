// Split the broken dbms-lab into mysql-lab / postgres-lab / oracle-lab.
//
// dbms-lab pointed at ECS task definition vlab-dev-dbms-task in some
// environments, which the infrastructure never creates, so every start failed.
// The infrastructure creates vlab-dev-mysql-task, vlab-dev-postgres-task and
// vlab-dev-oracle-task.
//
// What it does (in ignito_experia_owner.labs, one transaction):
//   1. Renames legacy codes postgres -> postgres-lab and oracle -> oracle-lab
//      (if the new code doesn't exist yet). The backend aliases the old codes.
//   2. Upserts mysql-lab / postgres-lab / oracle-lab. Rows that already exist
//      keep their price, duration, logo and display order.
//   3. Marks dbms-lab inactive (row kept; the backend aliases it to mysql-lab).
//
// Column names differ between environments (Credits vs BaseTokenPrice, etc.),
// so only columns that exist are written. Idempotent.
//
// Usage: node database/025_split_dbms_lab.mjs [--dry-run]

import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DRY_RUN = process.argv.includes("--dry-run");
const TABLE = "`ignito_experia_owner`.`labs`";
const SQL_LOGO = "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/sql/sql.png";

const common = {
  Subtitle: "Database Management Systems",
  Semester: "Semester 2",
  Complexity: "Intermediate",
  Category: "Databases",
  RuntimeType: "ide",
  RuntimePort: 8080,
  RuntimePath: "/",
  ContainerApiEnabled: 1,
  ContainerApiPort: 8080,
  Status: "active",
  IsDeleted: 0,
};

// Only applied when the row is created.
const createOnly = {
  Logo: SQL_LOGO,
  DurationMinutes: 75,
  Credits: 35,
  BaseTokenPrice: 35,
};

const LABS = [
  {
    LabCode: "mysql-lab",
    Title: "DBMS & SQL Lab (MySQL)",
    Description: "Learn SQL queries, joins, views, procedures and triggers on MySQL.",
    TaskDefinition: "vlab-dev-mysql-task",
  },
  {
    LabCode: "postgres-lab",
    legacyCode: "postgres",
    Title: "DBMS & SQL Lab (PostgreSQL)",
    Description: "Learn SQL queries, joins, views, procedures and triggers on PostgreSQL.",
    TaskDefinition: "vlab-dev-postgres-task",
  },
  {
    LabCode: "oracle-lab",
    legacyCode: "oracle",
    Title: "DBMS & SQL Lab (Oracle)",
    Description:
      "Learn Oracle SQL and PL/SQL: queries, joins, views, procedures and triggers. " +
      "Note: the lab can take a few minutes to start while the Oracle database boots.",
    TaskDefinition: "vlab-dev-oracle-task",
  },
];

const REPORT_COLS = ["LabId", "LabCode", "Title", "TaskDefinition", "RuntimeType", "Credits", "BaseTokenPrice", "DurationMinutes", "DisplayOrder", "Status"];

async function snapshot(conn, columns) {
  const cols = REPORT_COLS.filter((c) => columns.has(c)).map((c) => `\`${c}\``).join(", ");
  const [rows] = await conn.query(
    `SELECT ${cols} FROM ${TABLE} WHERE LabCode IN ('dbms-lab','mysql-lab','postgres-lab','oracle-lab','postgres','oracle') ORDER BY LabCode`
  );
  return rows;
}

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
    const pick = (obj) => Object.fromEntries(Object.entries(obj).filter(([k]) => columns.has(k)));

    console.log(`Target: ${process.env.DB_HOST || "localhost"} ${TABLE}${DRY_RUN ? "  (DRY RUN)" : ""}`);
    console.log("Before:");
    console.table(await snapshot(conn, columns));

    await conn.beginTransaction();

    const [[dbms]] = await conn.query(`SELECT DisplayOrder FROM ${TABLE} WHERE LabCode = 'dbms-lab'`);
    let nextOrder = Number(dbms?.DisplayOrder ?? 0);

    for (const lab of LABS) {
      const { legacyCode, LabCode, ...fields } = lab;
      const [[existing]] = await conn.query(`SELECT LabId FROM ${TABLE} WHERE LabCode = ?`, [LabCode]);

      if (!existing && legacyCode) {
        const [res] = await conn.query(`UPDATE ${TABLE} SET LabCode = ? WHERE LabCode = ?`, [LabCode, legacyCode]);
        if (res.affectedRows) console.log(`Renamed ${legacyCode} -> ${LabCode}`);
      }

      const [[row]] = await conn.query(`SELECT LabId FROM ${TABLE} WHERE LabCode = ?`, [LabCode]);
      const updates = pick({ ...common, ...fields });

      if (row) {
        if (columns.has("UpdatedDate")) updates.UpdatedDate = new Date();
        await conn.query(`UPDATE ${TABLE} SET ? WHERE LabId = ?`, [updates, row.LabId]);
        console.log(`Updated ${LabCode} (LabId ${row.LabId})`);
      } else {
        const insert = pick({ LabCode, ...common, ...createOnly, ...fields, DisplayOrder: nextOrder });
        const [res] = await conn.query(`INSERT INTO ${TABLE} SET ?`, [insert]);
        console.log(`Inserted ${LabCode} (LabId ${res.insertId})`);
      }
      nextOrder += 1;
    }

    const [res] = await conn.query(
      `UPDATE ${TABLE} SET Status = 'inactive'${columns.has("UpdatedDate") ? ", UpdatedDate = NOW()" : ""} WHERE LabCode = 'dbms-lab'`
    );
    if (res.affectedRows) console.log("Marked dbms-lab inactive");

    console.log("After:");
    console.table(await snapshot(conn, columns));

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
