import crypto from "crypto";
import { ENV, useDynamoDb } from "../config/env.js";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddbGet, ddbPut, ddbUpdate, ddbDelete, getDocClient } from "../lib/dynamodb.js";
import { enrichSession } from "../lib/labTools.js";

const memorySessions = new Map();

const ttlEpoch = (minutes) =>
  Math.floor((Date.now() + minutes * 60 * 1000 + 5 * 60 * 1000) / 1000);

export const createSessionId = () =>
  `sess_${crypto.randomBytes(4).toString("hex")}`;

export const createSessionToken = () => crypto.randomBytes(16).toString("hex");

export const getSession = async (sessionId) => {
  let item = null;
  if (useDynamoDb()) {
    item = await ddbGet(ENV.sessionsTable, { sessionId });
  } else {
    item = memorySessions.get(sessionId);
  }

  // Hydrate missing core fields from MySQL lab_sessions if needed
  if (!item || !item.labId || !item.userId || !item.taskArn) {
    try {
      const LabSessionRepository = (await import("../repositories/LabSessionRepository.js")).default;
      const labSessionRepo = new LabSessionRepository();
      const sqlRow = await labSessionRepo.getSessionById(sessionId);
      if (sqlRow) {
        if (!item) {
          item = {
            sessionId: sqlRow.SessionId,
            labId: sqlRow.LabId,
            userId: sqlRow.UserId,
            status: (sqlRow.Status || "STARTING").toLowerCase(),
            taskArn: sqlRow.TaskArn,
            subtype: sqlRow.Subtype,
            startTime: sqlRow.StartedAt ? new Date(sqlRow.StartedAt).toISOString() : undefined,
            createdAt: sqlRow.CreatedAt,
          };
        } else {
          if (!item.labId && sqlRow.LabId) item.labId = sqlRow.LabId;
          if (!item.userId && sqlRow.UserId) item.userId = sqlRow.UserId;
          if (!item.taskArn && sqlRow.TaskArn) item.taskArn = sqlRow.TaskArn;
        }
      }
    } catch (e) {
      console.warn("[sessionRepository getSession] Fallback hydration error:", e.message);
    }
  }

  return item ? await enrichSession({ ...item }) : null;
};

export const findActiveSessionForUser = async (userId, labId) => {
  if (useDynamoDb()) {
    const res = await getDocClient().send(
      new ScanCommand({
        TableName: ENV.sessionsTable,
        FilterExpression:
          "userId = :uid AND (#s = :starting OR #s = :running)",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":uid": userId,
          ":starting": "starting",
          ":running": "running",
        },
      }),
    );
    const items = (res.Items || []).filter(
      (s) => !labId || s.labId === labId,
    );
    return items[0] ? await enrichSession(items[0]) : null;
  }

  for (const session of memorySessions.values()) {
    if (
      session.userId === userId &&
      ["starting", "running"].includes(session.status) &&
      (!labId || session.labId === labId)
    ) {
      return await enrichSession(session);
    }
  }
  return null;
};

export const saveSession = async (session) => {
  const record = await enrichSession({ ...session });
  if (useDynamoDb()) {
    await ddbPut(ENV.sessionsTable, record);
  } else {
    memorySessions.set(record.sessionId, record);
  }
  return record;
};

export const updateSession = async (sessionId, updates) => {
  if (useDynamoDb()) {
    const updated = await ddbUpdate(ENV.sessionsTable, { sessionId }, updates);
    return await enrichSession(updated);
  }
  const existing = memorySessions.get(sessionId);
  if (!existing) return null;
  const merged = await enrichSession({ ...existing, ...updates });
  memorySessions.set(sessionId, merged);
  return merged;
};

export const deleteSession = async (sessionId) => {
  if (useDynamoDb()) {
    await ddbDelete(ENV.sessionsTable, { sessionId });
  } else {
    memorySessions.delete(sessionId);
  }
};

export const createSessionRecord = ({
  userId,
  labId,
  labType,
  runtimeType,
  durationMinutes,
  dotnetSubtype = null,
  starterAssetKey = null,
}) => {
  const sessionId = createSessionId();
  const sessionToken = createSessionToken();
  const starterFiles = [];
  return {
    sessionId,
    userId,
    labId,
    labType,
    runtimeType,
    dotnetSubtype,
    starterAssetKey,
    status: "starting",
    sessionToken,
    startTime: new Date().toISOString(),
    expiryTime: ttlEpoch(durationMinutes),
    durationMinutes,
    estimatedReadyInSeconds: 45,
    message: "Provisioning lab environment...",
    files: starterFiles,
  };
};

export const getAllActiveSessions = async () => {
  if (useDynamoDb()) {
    try {
      const res = await getDocClient().send(
        new ScanCommand({
          TableName: ENV.sessionsTable,
          FilterExpression: "#s = :starting OR #s = :running",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":starting": "starting",
            ":running": "running",
          },
        }),
      );
      return await Promise.all((res.Items || []).map((s) => enrichSession(s)));
    } catch (err) {
      console.error("[getAllActiveSessions] Scan Error:", err);
      return [];
    }
  }
  const active = [];
  for (const session of memorySessions.values()) {
    if (["starting", "running"].includes(session.status)) {
      active.push(await enrichSession(session));
    }
  }
  return active;
};
