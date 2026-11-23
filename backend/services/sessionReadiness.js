/**
 * Billing starts only when the runtime is verified READY.
 *
 * A lab_sessions row stays STARTING (never billed) until the workspace bootstrap reports
 * bootstrapState = READY. Then it is promoted to RUNNING with LastBilledAt = now, in one
 * conditional UPDATE so two callers (status poll + billing worker) cannot promote it twice.
 * A FAILED bootstrap marks the row FAILED: no tokens are charged, and the task is stopped
 * so it does not keep running unbilled.
 */
import pool from "../lib/mysql.js";

export const READINESS = Object.freeze({ RUNNING: "RUNNING", FAILED: "FAILED", PENDING: "PENDING" });

export function readinessOf(memorySession) {
  const state = String(memorySession?.bootstrapState || "").toUpperCase();
  if (state === "READY") return READINESS.RUNNING;
  if (state === "FAILED") return READINESS.FAILED;
  return READINESS.PENDING;
}

/**
 * @param {object} dbSession lab_sessions row (needs SessionId, AllocatedCredits/AllocatedDurationMinutes)
 * @param {object|null} memorySession runtime session record (DynamoDB / memory)
 * @param {{ db?: any, now?: Date, stopTask?: (arn: string) => Promise<any> }} [opts]
 * @returns {Promise<{ outcome: "RUNNING"|"FAILED"|"PENDING", changed: boolean, startedAt?: Date, tokenExpiryAt?: Date }>}
 */
export async function applyRuntimeReadiness(dbSession, memorySession, { db = pool, now = new Date(), stopTask = null } = {}) {
  const outcome = readinessOf(memorySession);
  if (!dbSession?.SessionId || outcome === READINESS.PENDING) return { outcome, changed: false };

  if (outcome === READINESS.RUNNING) {
    const sessionTokens = Number(dbSession.AllocatedCredits || dbSession.AllocatedDurationMinutes || 60);
    const tokenExpiryAt = new Date(now.getTime() + sessionTokens * 60 * 1000);
    const [res] = await db.query(
      `UPDATE lab_sessions
       SET Status = 'RUNNING', StartedAt = ?, TokenExpiryAt = ?, ExpiresAt = ?, LastBilledAt = ?, UnbilledSeconds = 0, UpdatedAt = CURRENT_TIMESTAMP
       WHERE SessionId = ? AND Status = 'STARTING'`,
      [now, tokenExpiryAt, tokenExpiryAt, now, dbSession.SessionId]
    );
    return { outcome, changed: Boolean(res?.affectedRows), startedAt: now, tokenExpiryAt };
  }

  // FAILED
  const [res] = await db.query(
    `UPDATE lab_sessions
     SET Status = 'FAILED', EndedAt = ?, UpdatedAt = CURRENT_TIMESTAMP
     WHERE SessionId = ? AND Status = 'STARTING'`,
    [now, dbSession.SessionId]
  );
  const changed = Boolean(res?.affectedRows);
  if (changed && stopTask && dbSession.TaskArn) {
    await Promise.resolve(stopTask(dbSession.TaskArn)).catch((err) =>
      console.warn(`[sessionReadiness] Could not stop failed task for ${dbSession.SessionId}: ${err.message}`)
    );
  }
  return { outcome, changed };
}
