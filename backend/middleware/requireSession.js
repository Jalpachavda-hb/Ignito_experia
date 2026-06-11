import { SESSIONS } from "../services/sessionStore.js";
import { fail } from "../utils/apiResponse.js";

export const getSessionId = (req) =>
  req.headers["x-session-id"] || req.query.sessionId || req.body?.sessionId;

export const requireSession = (req, res, next) => {
  const sessionId = getSessionId(req);
  if (!sessionId) {
    return fail(res, "Session ID required (x-session-id header)", 400);
  }

  const session = SESSIONS[sessionId];
  if (!session) {
    return fail(res, "Session not found", 404);
  }

  req.sessionId = sessionId;
  req.session = session;
  next();
};
