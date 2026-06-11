import crypto from "crypto";
import { ENV, useDynamoDb } from "../config/env.js";
import { ddbGet, ddbPut, ddbUpdate } from "../lib/dynamodb.js";

const memoryRuns = new Map();

export const createRunId = () => `run_${crypto.randomBytes(6).toString("hex")}`;

export const createRun = async ({ sessionId, labType }) => {
  const runId = createRunId();
  const record = {
    runId,
    sessionId,
    labType,
    status: "QUEUED",
    createdAt: Math.floor(Date.now() / 1000),
    expiryTime: Math.floor(Date.now() / 1000) + 2 * 3600,
  };

  if (useDynamoDb() && ENV.runsTable) {
    await ddbPut(ENV.runsTable, record);
  } else {
    memoryRuns.set(runId, record);
  }
  return record;
};

export const getRun = async (runId) => {
  if (useDynamoDb() && ENV.runsTable) {
    return ddbGet(ENV.runsTable, { runId });
  }
  return memoryRuns.get(runId) || null;
};

export const completeRun = async (runId, result) => {
  const updates = {
    status: result.success ? "COMPLETED" : "FAILED",
    success: result.success,
    output: result.output || "",
    error: result.error || result.runtimeError || "",
    syntaxError: result.syntaxError || "",
    runtimeError: result.runtimeError || "",
    completedAt: Math.floor(Date.now() / 1000),
  };

  if (useDynamoDb() && ENV.runsTable) {
    return ddbUpdate(ENV.runsTable, { runId }, updates);
  }
  const existing = memoryRuns.get(runId);
  if (!existing) return null;
  const merged = { ...existing, ...updates };
  memoryRuns.set(runId, merged);
  return merged;
};
