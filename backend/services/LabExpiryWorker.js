import labSessionRepository from "../repositories/LabSessionRepository.js";
import { stopEcsTask, isEcsEnabled } from "./ecsService.js";

let workerIntervalHandle = null;

export async function checkAndExpireSessions() {
  try {
    const expiredSessions = await labSessionRepository.getExpiredSessions();
    if (!expiredSessions || expiredSessions.length === 0) {
      return;
    }

    console.log(`[LabExpiryWorker] Found ${expiredSessions.length} expired session(s). Processing...`);

    for (const session of expiredSessions) {
      try {
        console.log(`[LabExpiryWorker] Expiring session: ${session.SessionId} for User ${session.UserId}`);

        if (session.TaskArn && isEcsEnabled()) {
          try {
            await stopEcsTask(session.TaskArn);
          } catch (stopErr) {
            console.error(`[LabExpiryWorker] Error stopping ECS task ${session.TaskArn}:`, stopErr.message);
          }
        }

        const endedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await labSessionRepository.updateSession(session.SessionId, {
          Status: 'EXPIRED',
          EndedAt: endedAt,
          FinalCreditsConsumed: session.AllocatedCredits
        });

        console.log(`[LabExpiryWorker] Session ${session.SessionId} marked as EXPIRED.`);
      } catch (sessErr) {
        console.error(`[LabExpiryWorker] Failed to process expiry for session ${session.SessionId}:`, sessErr.message);
      }
    }
  } catch (err) {
    console.error("[LabExpiryWorker] Error during worker execution cycle:", err.message);
  }
}

export function startWorkerInterval(intervalMs = 60000) {
  if (workerIntervalHandle) {
    clearInterval(workerIntervalHandle);
  }
  console.log(`[LabExpiryWorker] Background expiry worker initialized. Interval: ${intervalMs}ms`);
  // Run first check immediately
  checkAndExpireSessions().catch(err => {
    console.error("[LabExpiryWorker] Initial check error:", err.message);
  });
  workerIntervalHandle = setInterval(() => {
    checkAndExpireSessions().catch(err => {
      console.error("[LabExpiryWorker] Worker cycle error:", err.message);
    });
  }, intervalMs);
}

export function stopWorkerInterval() {
  if (workerIntervalHandle) {
    clearInterval(workerIntervalHandle);
    workerIntervalHandle = null;
  }
}

export default {
  checkAndExpireSessions,
  startWorkerInterval,
  stopWorkerInterval
};
