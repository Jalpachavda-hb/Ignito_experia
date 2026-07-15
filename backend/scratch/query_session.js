import dotenv from "dotenv";
dotenv.config();
import { getSession } from "../services/sessionRepository.js";

async function main() {
  const sessionId = "sess_4bd50b82";
  try {
    const session = await getSession(sessionId);
    console.log("=== SESSION DETAILS ===");
    console.log(JSON.stringify(session, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
