import pool from "../lib/mysql.js";
import labSessionRepository from "../repositories/LabSessionRepository.js";
import { stopEcsTask, isEcsEnabled } from "./ecsService.js";

class RuntimeStopService {
  async processStop(sessionId) {
    const session = await labSessionRepository.getSessionById(sessionId);
    if (!session) return false;

    if (session.Status === 'STOPPED') return true;

    console.log(`[RuntimeStopService] Processing container stop for session ${sessionId} (TaskArn: ${session.TaskArn || 'N/A'})`);

    try {
      if (session.TaskArn && isEcsEnabled()) {
        await stopEcsTask(session.TaskArn);
      }

      await labSessionRepository.updateSession(sessionId, {
        Status: 'STOPPED',
        EndedAt: new Date()
      });

      console.log(`[RuntimeStopService] Container stopped successfully for session ${sessionId}`);
      return true;
    } catch (err) {
      console.error(`[RuntimeStopService] Error stopping container for session ${sessionId}:`, err.message);
      await labSessionRepository.updateSession(sessionId, {
        Status: 'STOPPED',
        EndedAt: new Date()
      });
      return false;
    }
  }

  async getPendingStopSessions() {
    const [rows] = await pool.query(
      `SELECT SessionId, TenantId, UserId, LabId, TaskArn, Status, StopRetryCount, CreatedAt
       FROM lab_sessions
       WHERE Status = 'STOPPING' AND StopRetryCount < 10
       ORDER BY CreatedAt ASC`
    );
    return rows;
  }
}

export const runtimeStopService = new RuntimeStopService();
export default runtimeStopService;
