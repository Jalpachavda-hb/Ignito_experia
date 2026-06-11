import { ok } from "../lib/apigw.js";

export const healthHandler = async () =>
  ok({
    status: "Backend is running",
    timestamp: new Date().toISOString(),
    mode: process.env.SESSIONS_TABLE_NAME ? "dynamodb" : "memory",
  });
