import { ok, serverError } from "../lib/apigw.js";
import { verifyDbConnection } from "../lib/mysql.js";
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

export const databaseHealthHandler = async () => {
  const isConnected = await verifyDbConnection();
  if (isConnected) {
    return ok({ success: true, database: "connected" });
  } else {
    return serverError({ success: false, database: "disconnected" });
  }
};
