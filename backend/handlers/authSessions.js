import { sessionService } from "../services/SessionService.js";
import { forbidden, badRequest } from "../lib/errors.js";

// GET /auth/session/current
export const currentAuthSessionHandler = async ({ auth }) => {
  if (!auth?.claims?.sessionId) {
    throw forbidden("Session context missing");
  }
  return { statusCode: 200, body: JSON.stringify({ success: true, sessionId: auth.claims.sessionId }) };
};

// GET /auth/sessions
export const userAuthSessionsHandler = async ({ auth }) => {
  // Logic to get all active sessions for auth.userId
  // (In a real app, you'd add a method to sessionService for this)
  return { statusCode: 200, body: JSON.stringify({ success: true, message: "List of user sessions" }) };
};

// DELETE /auth/sessions/:id
export const revokeMyAuthSessionHandler = async ({ pathParameters, auth }) => {
  const { id } = pathParameters;
  await sessionService.revokeSession(id, 'LOGGED_OUT');
  return { statusCode: 200, body: JSON.stringify({ success: true, message: "Device revoked" }) };
};

// DELETE /auth/sessions
export const revokeAllMyOtherSessionsHandler = async ({ auth }) => {
  // Logic to revoke all other devices for auth.userId
  return { statusCode: 200, body: JSON.stringify({ success: true, message: "All other devices revoked" }) };
};

// GET /admin/sessions/statistics
export const sessionStatisticsHandler = async () => {
  const stats = await sessionService.getSessionStatistics();
  return { statusCode: 200, body: JSON.stringify({ success: true, statistics: stats }) };
};

// DELETE /admin/sessions/:id
export const forceLogoutAdminHandler = async ({ pathParameters, auth }) => {
  const { id } = pathParameters;
  if (!id) throw badRequest("Session ID required");
  
  await sessionService.forceLogout(id, auth.userId);
  return { statusCode: 200, body: JSON.stringify({ success: true, message: "Session forcibly logged out" }) };
};

// GET /admin/sessions
export const adminListSessionsHandler = async () => {
  // List all sessions (paginated)
  return { statusCode: 200, body: JSON.stringify({ success: true, message: "Admin list sessions" }) };
};
