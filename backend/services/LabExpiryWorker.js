import pool from "../lib/mysql.js";
import labSessionRepository from "../repositories/LabSessionRepository.js";
import { stopEcsTask, isEcsEnabled, describeTask } from "./ecsService.js";
import { deleteSession } from "./sessionRepository.js";

let workerIntervalHandle = null;

export async function checkAndExpireSessions() {
  try {
    const expiredSessions = await labSessionRepository.getExpiredSessions();
    if (expiredSessions && expiredSessions.length > 0) {
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

          await deleteSession(session.SessionId).catch(() => {});
          console.log(`[LabExpiryWorker] Session ${session.SessionId} marked as EXPIRED.`);
        } catch (sessErr) {
          console.error(`[LabExpiryWorker] Failed to process expiry for session ${session.SessionId}:`, sessErr.message);
        }
      }
    }

    // Also check for active sessions whose ECS container was stopped externally or terminated
    if (isEcsEnabled()) {
      const [runningSessions] = await pool.query(
        `SELECT SessionId, UserId, TaskArn FROM lab_sessions WHERE Status IN ('STARTING', 'RUNNING', 'EXPIRING_SOON') AND TaskArn IS NOT NULL`
      ).catch(() => [[]]);

      for (const session of runningSessions || []) {
        try {
          const task = await describeTask(session.TaskArn);
          if (!task || task.lastStatus === 'STOPPED') {
            console.log(`[LabExpiryWorker] Detected ECS task ${session.TaskArn} is STOPPED. Marking session ${session.SessionId} as STOPPED.`);
            const endedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
            await labSessionRepository.updateSession(session.SessionId, {
              Status: 'STOPPED',
              EndedAt: endedAt,
            });
            await deleteSession(session.SessionId).catch(() => {});
          }
        } catch (taskErr) {
          // ignore transient describe task errors
        }
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
