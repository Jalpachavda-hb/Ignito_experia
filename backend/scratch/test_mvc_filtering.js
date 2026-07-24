import dotenv from "dotenv";
dotenv.config();
import { listFiles } from "../services/fileRepository.js";

async function main() {
  const sessionId = "sess_f7cf9d68";
  console.log(`Calling listFiles for session: ${sessionId}`);
  const files = await listFiles(sessionId);
  console.log("=== FILTERED FILES LIST ===");
  console.log(`Total files returned: ${files.length}`);
  console.log(JSON.stringify(files, null, 2));
}

main();
