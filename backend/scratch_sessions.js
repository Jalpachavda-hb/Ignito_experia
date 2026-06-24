import { getAllActiveSessions } from "./services/sessionRepository.js";
import fs from "fs";

async function run() {
  try {
    const sessions = await getAllActiveSessions();
    fs.writeFileSync("scratch_sessions_out.txt", JSON.stringify(sessions, null, 2));
    console.log("SUCCESS");
    process.exit(0);
  } catch (err) {
    fs.writeFileSync("scratch_sessions_out.txt", err.stack || err.message);
    console.error(err);
    process.exit(1);
  }
}
run();
