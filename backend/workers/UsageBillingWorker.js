import pool from "../lib/mysql.js";
import usageBillingService from "../services/UsageBillingService.js";

let billingWorkerIntervalHandle = null;

export async function runBillingCycle() {
  try {
    const [activeSessions] = await pool.query(
      `SELECT SessionId, UserId, LabId, Status, LastBilledAt, CreatedAt
       FROM lab_sessions
       WHERE Status IN ('RUNNING', 'EXPIRING_SOON')`
    );

    if (!activeSessions || activeSessions.length === 0) {
      return;
    }

    console.log(`[UsageBillingWorker] Running cycle for ${activeSessions.length} active session(s)...`);

    for (const session of activeSessions) {
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
