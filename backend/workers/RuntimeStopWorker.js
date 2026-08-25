import runtimeStopService from "../services/RuntimeStopService.js";

let stopWorkerIntervalHandle = null;

export async function runStopCycle() {
  try {
    const pendingSessions = await runtimeStopService.getPendingStopSessions();
    if (!pendingSessions || pendingSessions.length === 0) {
      return;
    }

    console.log(`[RuntimeStopWorker] Found ${pendingSessions.length} session(s) pending container termination...`);

    for (const session of pendingSessions) {
      try {
        await runtimeStopService.processStop(session.SessionId);
      } catch (err) {
        console.error(`[RuntimeStopWorker] Error stopping session ${session.SessionId}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[RuntimeStopWorker] Error in stop cycle:", err.message);
  }
}

export function startRuntimeStopWorker(intervalMs = 15000) {
  if (stopWorkerIntervalHandle) {
    clearInterval(stopWorkerIntervalHandle);
  }
  console.log(`[RuntimeStopWorker] Initialized background container stop worker (interval: ${intervalMs}ms)`);
  runStopCycle().catch(e => console.error(e));
  stopWorkerIntervalHandle = setInterval(() => {
    runStopCycle().catch(e => console.error(e));
  }, intervalMs);
}

export function stopRuntimeStopWorker() {
  if (stopWorkerIntervalHandle) {
    clearInterval(stopWorkerIntervalHandle);
    stopWorkerIntervalHandle = null;
  }
}

export default {
  runStopCycle,
  startRuntimeStopWorker,
  stopRuntimeStopWorker
};
