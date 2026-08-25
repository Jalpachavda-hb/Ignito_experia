import pool from "../lib/mysql.js";
import runtimeStopService from "../services/RuntimeStopService.js";
import notificationService from "../services/NotificationService.js";

class SessionExpiryWorker {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  start(checkIntervalMs = 10000) {
    if (this.intervalId) return;
    console.log(`[SessionExpiryWorker] Starting session expiry daemon (interval: ${checkIntervalMs}ms)...`);
    this.intervalId = setInterval(() => this.processExpiredSessions(), checkIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[SessionExpiryWorker] Stopped.");
    }
  }

  async processExpiredSessions() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // 1. Fetch active sessions where TokenExpiryAt has passed
      const [expiredSessions] = await pool.query(
        `SELECT SessionId, TenantId, UserId, LabId, TokenExpiryAt
         FROM lab_sessions
         WHERE Status IN ('RUNNING', 'EXPIRING_SOON')
           AND TokenExpiryAt IS NOT NULL
           AND TokenExpiryAt <= NOW()`
      );

      if (expiredSessions && expiredSessions.length > 0) {
        console.log(`[SessionExpiryWorker] Found ${expiredSessions.length} expired session(s) past TokenExpiryAt.`);

        for (const session of expiredSessions) {
          const connection = await pool.getConnection();
          await connection.beginTransaction();

          try {
            // Lock session row to prevent race conditions
            const [locked] = await connection.query(
              `SELECT SessionId, Status FROM lab_sessions WHERE SessionId = ? FOR UPDATE`,
              [session.SessionId]
            );

            if (locked[0] && ['RUNNING', 'EXPIRING_SOON'].includes(locked[0].Status)) {
              await connection.query(
                `UPDATE lab_sessions
                 SET Status = 'STOPPING',
                     EndedAt = NOW(),
                     UpdatedAt = CURRENT_TIMESTAMP
                 WHERE SessionId = ?`,
                [session.SessionId]
              );

              await connection.commit();

              console.log(`[SessionExpiryWorker] Transitioned session ${session.SessionId} to STOPPING (Token Expiry).`);

              // Real-time Notification
              notificationService.emitTokenExhausted({
                tenantId: session.TenantId,
                studentId: session.UserId,
                labId: session.LabId,
                sessionId: session.SessionId
              });

              // Trigger ECS runtime stop
              runtimeStopService.processStop(session.SessionId).catch((err) => {
                console.error(`[SessionExpiryWorker] Error stopping containers for session ${session.SessionId}:`, err);
              });
            } else {
              await connection.rollback();
            }
          } catch (sessionErr) {
            await connection.rollback();
            console.error(`[SessionExpiryWorker] Error processing session ${session.SessionId}:`, sessionErr);
          } finally {
            connection.release();
          }
        }
      }
    } catch (err) {
      console.error("[SessionExpiryWorker] Unexpected worker error:", err.message);
    } finally {
      this.isRunning = false;
    }
  }
}

export const sessionExpiryWorker = new SessionExpiryWorker();
export function startSessionExpiryWorker(intervalMs = 10000) {
  sessionExpiryWorker.start(intervalMs);
}

export default sessionExpiryWorker;
