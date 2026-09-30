import { AsyncLocalStorage } from "node:async_hooks";

const requestStore = new AsyncLocalStorage();
const tokensByUserId = new Map();

export function rememberStudentLmsToken(userId, token) {
  const id = userId == null ? "" : String(userId).trim();
  const value = String(token || "").replace(/^Bearer\s+/i, "").trim();
  if (!id || !value) return;
  tokensByUserId.set(id, value);
}

export function runWithStudentLmsToken(context, fn) {
  const userId = context?.userId == null ? null : String(context.userId);
  const lmsToken = String(context?.lmsToken || "").replace(/^Bearer\s+/i, "").trim() || null;
  if (userId && lmsToken) rememberStudentLmsToken(userId, lmsToken);
  return requestStore.run({ userId, lmsToken }, fn);
}

/** LMS bearer token for the current student request, when one was supplied. */
export function resolveStudentLmsToken() {
  const current = requestStore.getStore() || {};
  if (current.lmsToken) return current.lmsToken;
  if (current.userId) return tokensByUserId.get(String(current.userId)) || null;
  return null;
}
