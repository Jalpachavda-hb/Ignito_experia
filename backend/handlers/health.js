import { ok, serverError } from "../lib/apigw.js";
import { verifyDbConnection } from "../lib/mysql.js";

export const healthHandler = async () =>
  ok({
    status: "Backend is running",
    timestamp: new Date().toISOString(),
    mode: process.env.SESSIONS_TABLE_NAME ? "dynamodb" : "memory",
  });

export const databaseHealthHandler = async () => {
  const isConnected = await verifyDbConnection();
  if (isConnected) {
    return ok({ success: true, database: "connected" });
  } else {
    return serverError({ success: false, database: "disconnected" });
  }
};
