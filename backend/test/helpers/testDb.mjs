/**
 * Isolated MySQL schema for integration tests.
 *
 * Safety:
 *  - Only schemas named vlab_<name>_test are ever created, written or dropped.
 *  - Table structure is copied from the dev schema with read-only SHOW CREATE TABLE; no row of
 *    ignito_experia or ignito_experia_owner is written.
 *  - Sessions run in strict SQL mode, like live MySQL 8 (local MariaDB is not strict).
 *  - The app's startup DDL (lib/mysql.js verifyDbConnection) is never called.
 *
 * Usage (before importing any app module):
 *   const db = await prepareTestSchema("vlab_access_test");
 *   // process.env.DB_NAME now points at it; import app modules afterwards.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../.env") });

export const SOURCE_SCHEMA = "ignito_experia";
export const STRICT_SQL_MODE = "STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION";

// Tables the code under test touches (exact names as the code spells them).
export const TABLES = [
  "Users",
  "user_tenant_mapping",
  "external_identities",
  "tenants",
  "course_lab_mappings",
  "student_lab_token_wallets",
  "student_lab_token_transactions",
  "token_orders",
  "token_order_items",
  "lab_sessions",
  "credit_wallets",
  "credit_transactions",
  "StudentSessions",
  "RefreshTokens",
  "SSOReplayStore",
  "lab_token_usage",
];

export function assertTestSchemaName(name) {
  if (!/^vlab_[a-z0-9_]+_test$/.test(String(name || ""))) {
    throw new Error(`Refusing to use schema "${name}": test schemas must be named vlab_<name>_test`);
  }
}

function connectionConfig(database) {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ...(database ? { database } : {}),
    multipleStatements: false,
  };
}

/** Drops and recreates the test schema with the structure of the dev schema. */
export async function prepareTestSchema(name) {
  assertTestSchemaName(name);
  const admin = await mysql.createConnection(connectionConfig());
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await admin.query(`USE \`${name}\``);
    await admin.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of TABLES) {
      const [rows] = await admin.query(`SHOW CREATE TABLE \`${SOURCE_SCHEMA}\`.\`${table}\``);
      const ddl = rows[0]["Create Table"];
      await admin.query(ddl);
    }
    await admin.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    await admin.end();
  }
  process.env.DB_NAME = name;
  return name;
}

/** Puts every pooled connection of the app pool into strict mode (live MySQL 8 behaviour). */
export function makePoolStrict(appPool) {
  const raw = appPool.pool || appPool;
  raw.on("connection", (conn) => {
    conn.query(`SET SESSION sql_mode = '${STRICT_SQL_MODE}'`);
  });
}

export async function dropTestSchema(name) {
  assertTestSchemaName(name);
  const admin = await mysql.createConnection(connectionConfig());
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
  } finally {
    await admin.end();
  }
}

/** Separate connection to the test schema for seeding / assertions. */
export async function testConnection(name) {
  assertTestSchemaName(name);
  const conn = await mysql.createConnection(connectionConfig(name));
  await conn.query(`SET SESSION sql_mode = '${STRICT_SQL_MODE}'`);
  return conn;
}
