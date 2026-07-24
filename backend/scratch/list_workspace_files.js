import dotenv from "dotenv";
dotenv.config();
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getDocClient } from "../lib/dynamodb.js";
import { ENV } from "../config/env.js";
import { executeCode } from "../services/ExecutionService.js";

async function main() {
  const res = await getDocClient().send(
    new ScanCommand({
      TableName: ENV.sessionsTable,
      FilterExpression: "#s = :running",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":running": "running" },
    })
  );
  const activeSessions = res.Items || [];
  if (activeSessions.length === 0) {
    console.log("No active sessions found.");
    return;
  }
  const session = activeSessions[0];
  console.log("Found Active Session:", session.sessionId, "Lab:", session.labId, "Type:", session.labType);

  const payload = {
    action: "run",
    path: "/tmp/list_files_debug.sh",
    language: "shell",
    content: `
echo "=== FIND FILES ==="
find /tmp/workspace/workspace -type f
`
  };

  const result = await executeCode(session, payload);
  console.log("=== FILES IN CONTAINER ===");
  console.log(result.output);
}

main();
