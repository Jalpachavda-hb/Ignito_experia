import { ok, serverError } from "../lib/apigw.js";
import pool from "../lib/mysql.js";

export const healthHandler = async () => {
  try {
    const [rows] = await pool.query('SELECT LabCode, TaskDefinition, RuntimeType, Status FROM labs');
    return ok({
      status: "Backend is running",
      timestamp: new Date().toISOString(),
      mode: process.env.SESSIONS_TABLE_NAME ? "dynamodb" : "memory",
      labs: rows
    });
  } catch (err) {
    return ok({
      status: "Backend is running",
      timestamp: new Date().toISOString(),
      mode: process.env.SESSIONS_TABLE_NAME ? "dynamodb" : "memory",
      error: err.message
    });
  }
};

/**
 * Read-only connectivity check. It used to call verifyDbConnection(), which runs the startup
 * schema DDL (including dropping Users columns) on every unauthenticated health request.
 */
export const databaseHealthHandler = async () => {
  try {
    await pool.query("SELECT 1");
    return ok({ success: true, database: "connected" });
  } catch {
    return serverError({ success: false, database: "disconnected" });
  }
};
