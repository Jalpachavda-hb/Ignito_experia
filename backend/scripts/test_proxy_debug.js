import { getSession, getAllActiveSessions } from "../services/sessionRepository.js";
import { signJupyterEmbedToken } from "../lib/jwt.js";
import { ENV } from "../config/env.js";

async function run() {
  console.log("Starting proxy auth test...");
  
  const activeSessions = await getAllActiveSessions();
  if (activeSessions.length === 0) {
    console.log("No active sessions found in database!");
    return;
  }
  
  const session = activeSessions[0];
  console.log("Found active session:", {
    sessionId: session.sessionId,
    userId: session.userId,
    status: session.status,
    runtimeType: session.runtimeType
  });
  
  const token = signJupyterEmbedToken(session.sessionId, session.userId);
  console.log("Generated token:", token.substring(0, 30) + "...");
  
  const url = `http://localhost:8080/api/lab-sessions/${session.sessionId}/jupyter/lab?access_token=${encodeURIComponent(token)}`;
  console.log("Testing URL:", url);
  
  try {
    const res = await fetch(url, { method: "GET" });
    console.log("Response status:", res.status);
    const text = await res.text();
    console.log("Response body:", text);
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

run().catch(console.error);
