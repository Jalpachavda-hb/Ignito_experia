import { getAllActiveSessions, deleteSession } from "./sessionRepository.js";
import { isEcsEnabled, stopEcsTask } from "./ecsService.js";
import { clearSessionFiles } from "./fileRepository.js";

export const cleanupExpiredSessions = async () => {
  try {
    const activeSessions = await getAllActiveSessions();
    const now = Date.now();
    for (const session of activeSessions) {
      if (!session.startTime || !session.durationMinutes) continue;
      const startMs = new Date(session.startTime).getTime();
      const expiresMs = startMs + session.durationMinutes * 60 * 1000;
      if (now >= expiresMs) {
        console.log(`[Auto-Stop] Session ${session.sessionId} has expired. Stopping...`);
        try {
          if (session.taskArn && isEcsEnabled()) {
            await stopEcsTask(session.taskArn);
          }
        } catch (err) {
          console.error(`[Auto-Stop] Error stopping ECS task for session ${session.sessionId}:`, err);
        }
        try {
          clearSessionFiles(session.sessionId);
          await deleteSession(session.sessionId);
          console.log(`[Auto-Stop] Successfully cleaned up session ${session.sessionId}`);
        } catch (err) {
          console.error(`[Auto-Stop] Error cleaning up session files/record for ${session.sessionId}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("[Auto-Stop] Error in cleanupExpiredSessions interval:", err);
  }
};
