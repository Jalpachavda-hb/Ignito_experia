import pool from "../lib/mysql.js";
import labSessionRepository from "../repositories/LabSessionRepository.js";
import { stopEcsTask, isEcsEnabled, describeTask } from "./ecsService.js";
import { deleteSession, getAllActiveSessions } from "./sessionRepository.js";
import usageBillingService from "./UsageBillingService.js";

// Idle stop (docs/lab-startup-optimization.md §3.3). 0 = disabled.
const IDLE_TIMEOUT_MINUTES = Number(process.env.LAB_IDLE_TIMEOUT_MINUTES || 0);

/**
 * Stops running labs whose page stopped sending heartbeats for IDLE_TIMEOUT_MINUTES.
 * Only sessions that have sent at least one heartbeat are considered, so pages that
 * don't send heartbeats (older frontend builds) are never stopped by this check.
 * Files are left in place (unlike a manual stop) so no work is lost.
 */
export async function stopIdleSessions() {
  if (!IDLE_TIMEOUT_MINUTES) return;
  const cutoff = Date.now() - IDLE_TIMEOUT_MINUTES * 60 * 1000;
  const sessions = await getAllActiveSessions();
  for (const session of sessions) {
    if (session.status !== "running" || !session.lastHeartbeatAt) continue;
    if (new Date(session.lastHeartbeatAt).getTime() > cutoff) continue;
    try {
      console.log(`[LabExpiryWorker] Stopping idle session ${session.sessionId} (no heartbeat for ${IDLE_TIMEOUT_MINUTES} min)`);
      await usageBillingService.finalizeSessionBilling(session.sessionId).catch((e) =>
        console.warn(`[LabExpiryWorker] Billing finalization error for idle session ${session.sessionId}:`, e.message));
      if (session.taskArn && isEcsEnabled()) {
        await stopEcsTask(session.taskArn).catch((e) =>
          console.error(`[LabExpiryWorker] Error stopping idle task:`, e.message));
      }
      await labSessionRepository.updateSession(session.sessionId, {
        Status: "STOPPED",
        EndedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      });
      await deleteSession(session.sessionId).catch(() => {});
    } catch (err) {
      console.error(`[LabExpiryWorker] Failed to stop idle session ${session.sessionId}:`, err.message);
    }
  }
}

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
          if (task && task.lastStatus === 'STOPPED') {
            console.log(`[LabExpiryWorker] Confirmed ECS task ${session.TaskArn} is STOPPED. Marking session ${session.SessionId} as STOPPED.`);
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
    await stopIdleSessions();
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
