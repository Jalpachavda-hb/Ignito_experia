import pool from "../lib/mysql.js";
import usageBillingService from "../services/UsageBillingService.js";
import { applyRuntimeReadiness } from "../services/sessionReadiness.js";
import { getSession } from "../services/sessionRepository.js";
import { stopEcsTask } from "../services/ecsService.js";

let billingWorkerIntervalHandle = null;

export async function runBillingCycle() {
  try {
    const [activeSessions] = await pool.query(
      `SELECT SessionId, UserId, LabId, Status, LastBilledAt, CreatedAt, StartedAt, TaskArn, AllocatedCredits, AllocatedDurationMinutes
       FROM lab_sessions
       WHERE UPPER(Status) IN ('RUNNING', 'EXPIRING_SOON', 'STARTING')`
    );

    if (!activeSessions || activeSessions.length === 0) {
      return;
    }

    console.log(`[UsageBillingWorker] Running cycle for ${activeSessions.length} active session(s)...`);

    for (const session of activeSessions) {
      // STARTING: promote only when the runtime bootstrap is READY (billing begins then); a
      // FAILED bootstrap is closed without charge. Covers students who stopped polling.
      if (String(session.Status).toUpperCase() === 'STARTING') {
        try {
          const memorySession = await getSession(session.SessionId);
          const result = await applyRuntimeReadiness(session, memorySession, { stopTask: stopEcsTask });
          if (result.changed) {
            console.log(`[UsageBillingWorker] Session ${session.SessionId} runtime ${result.outcome}.`);
          }
        } catch (readyErr) {
          console.error(`[UsageBillingWorker] Readiness check failed for ${session.SessionId}:`, readyErr.message);
        }
        continue;
      }
      try {
        const result = await usageBillingService.billSession(session.SessionId);
        if (result && result.chargedTokens > 0) {
          console.log(`[UsageBillingWorker] Session ${session.SessionId} (Lab: ${session.LabId}, User: ${session.UserId}): charged ${result.chargedTokens} token(s). Remaining balance: ${result.balanceAfter}`);
        }
      } catch (sessErr) {
        console.error(`[UsageBillingWorker] Error billing session ${session.SessionId}:`, sessErr.message);
      }
    }
  } catch (err) {
    console.error("[UsageBillingWorker] Error in worker cycle:", err.message);
  }
}

export function startUsageBillingWorker(intervalMs = 30000) {
  if (billingWorkerIntervalHandle) {
    clearInterval(billingWorkerIntervalHandle);
  }
  console.log(`[UsageBillingWorker] Initialized background usage billing worker (interval: ${intervalMs}ms)`);
  runBillingCycle().catch(e => console.error(e));
  billingWorkerIntervalHandle = setInterval(() => {
    runBillingCycle().catch(e => console.error(e));
  }, intervalMs);
}

export function stopUsageBillingWorker() {
  if (billingWorkerIntervalHandle) {
    clearInterval(billingWorkerIntervalHandle);
    billingWorkerIntervalHandle = null;
  }
}

export default {
  runBillingCycle,
  startUsageBillingWorker,
  stopUsageBillingWorker
};
