export class LogStreamer {
  static sendRunLog(runId, message, type = "stdout") {
    global.activeLogStreams = global.activeLogStreams || new Map();
    let streamEntry = global.activeLogStreams.get(runId);
    if (!streamEntry) {
      streamEntry = { clients: [], history: [], completed: false };
      global.activeLogStreams.set(runId, streamEntry);
    }
    const logObj = { type, message, timestamp: new Date().toISOString() };
    streamEntry.history.push(logObj);
    for (const client of streamEntry.clients) {
      try {
        client.write(`data: ${JSON.stringify(logObj)}\n\n`);
      } catch (e) {
        console.error("[LogStreamer] Error writing to SSE client:", e);
      }
    }
  }

  static completeRunLogs(runId) {
    global.activeLogStreams = global.activeLogStreams || new Map();
    const streamEntry = global.activeLogStreams.get(runId);
    if (streamEntry) {
      streamEntry.completed = true;
      for (const client of streamEntry.clients) {
        try {
          client.end();
        } catch (e) {}
      }
      if (streamEntry.clients.length === 0) {
        global.activeLogStreams.delete(runId);
      }
    }
  }
}
