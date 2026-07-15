import { getAllActiveSessions } from "../services/sessionRepository.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testEndpoints() {
  const logFile = path.join(__dirname, "..", "debug.log");
  const log = (msg) => {
    fs.appendFileSync(logFile, msg + "\n");
    console.log(msg);
  };

  try {
    const sessions = await getAllActiveSessions();
    if (!sessions || sessions.length === 0) {
      log(`[Probe] No active sessions found.`);
      return;
    }

    // Prioritize sessions that have public IP
    const session = sessions.find(s => s.publicIp) || sessions[0];
    const host = session.publicIp || session.taskPrivateIp;

    if (!host) {
      log(`[Probe] Selected Session ${session.sessionId} has no IP address.`);
      return;
    }

    log(`[Probe] Selected Session: ID=${session.sessionId}, Lab=${session.labId}, Host=${host}`);

    const javaCode = `public class script {
    public static void main(String[] args) {
        System.out.println("Hello from Antigravity Java probe!");
    }
}`;

    const endpoints = [
      { method: "POST", path: "/execute", body: { path: "/workspace/script.java", language: "java", content: javaCode } },
    ];

    for (const ep of endpoints) {
      try {
        const url = `http://${host}:8080${ep.path}`;
        log(`[Probe] Hitting ${ep.method} ${url}...`);
        
        const res = await fetch(url, {
          method: ep.method,
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": session.sessionToken || ""
          },
          body: JSON.stringify(ep.body),
          signal: AbortSignal.timeout(10000) // 10 seconds timeout for compile/run
        });

        const text = await res.text();
        log(`[Probe] Response Status: ${res.status}`);
        log(`[Probe] Body: ${text}`);
      } catch (err) {
        log(`[Probe] Error for ${ep.path}: ${err.message}`);
      }
    }
  } catch (err) {
    log(`[Probe] General Error: ${err.message}`);
  }
}

// Check every 10 seconds for any active sessions and probe them
setInterval(testEndpoints, 10000);
