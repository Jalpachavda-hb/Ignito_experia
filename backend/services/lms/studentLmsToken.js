import { AsyncLocalStorage } from "node:async_hooks";
import { getRedis } from "../../lib/redisClient.js";

const requestStore = new AsyncLocalStorage();
const tokensByUserId = new Map();

function tokenKey(userId) {
  return `lms:student-bearer:${String(userId).trim()}`;
}

function readTokenExpiry(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return 0;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload = JSON.parse(json);
    const exp = Number(payload.exp);
    return Number.isFinite(exp) ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function ttlSeconds(token) {
  const exp = readTokenExpiry(token);
  if (exp > Date.now() + 30000) return Math.floor((exp - Date.now()) / 1000);
  // LMS SSO often still accepts the token after its exp claim. Keep it for password login.
  return 12 * 60 * 60;
}

function rememberLocal(userId, token) {
  const id = userId == null ? "" : String(userId).trim();
  const value = String(token || "").replace(/^Bearer\s+/i, "").trim();
  if (!id || !value) return "";
  tokensByUserId.set(id, value);
  return value;
}

async function persistStudentLmsToken(userId, token) {
  const redis = await getRedis().catch(() => null);
  if (!redis) return;
  await redis.set(tokenKey(userId), token, { EX: ttlSeconds(token) });
}

/** Keep the LMS SSO token for this student so a later password login can still call LMS. */
export function rememberStudentLmsToken(userId, token) {
  const value = rememberLocal(userId, token);
  if (!value) return;
  persistStudentLmsToken(userId, value).catch((err) => {
    console.warn("[studentLmsToken] Could not store LMS token:", err.message);
  });
}

export async function loadRememberedStudentLmsToken(userId) {
  const id = userId == null ? "" : String(userId).trim();
  if (!id) return null;

  const local = tokensByUserId.get(id);
  if (local) return local;

  const redis = await getRedis().catch(() => null);
  if (!redis) return null;
  const stored = await redis.get(tokenKey(id)).catch(() => null);
  if (!stored) return null;
  tokensByUserId.set(id, stored);
  return stored;
}

export function runWithStudentLmsToken(context, fn) {
  const userId = context?.userId == null ? null : String(context.userId);
  const lmsToken = String(context?.lmsToken || "").replace(/^Bearer\s+/i, "").trim() || null;
  if (userId && lmsToken) rememberStudentLmsToken(userId, lmsToken);
  return requestStore.run({ userId, lmsToken }, fn);
}

/** LMS bearer token for the current student request, when one was supplied or saved at SSO. */
export function resolveStudentLmsToken() {
  const current = requestStore.getStore() || {};
  if (current.lmsToken) return current.lmsToken;
  if (current.userId) {
    const saved = tokensByUserId.get(String(current.userId));
    if (saved) return saved;
  }
  return null;
}
