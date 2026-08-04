import { getSession } from "../services/sessionRepository.js";

export class SessionManager {
  static async validateSession(sessionId, auth) {
    if (!sessionId) throw new Error("sessionId is required");

    const session = await getSession(sessionId);
    if (!session) throw new Error("Session not found");

    if (String(session.userId) !== String(auth.userId) && auth.role !== "Super Admin") {
      throw new Error("You do not own this session");
    }

    const isLocalMock = !session.taskArn || process.env.FORCE_MOCK_EXECUTION === "true";

    if (session.status !== "running" && !isLocalMock) {
      throw new Error("Container is not running");
    }

    return session;
  }
}
