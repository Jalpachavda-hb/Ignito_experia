import dotenv from "dotenv";
dotenv.config();
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getDocClient } from "../lib/dynamodb.js";
import { ENV } from "../config/env.js";

async function main() {
  const res = await getDocClient().send(
    new ScanCommand({
      TableName: ENV.sessionsTable,
    })
  );
  const activeSessions = res.Items || [];
  console.log("=== SESSIONS ===");
  console.log(JSON.stringify(activeSessions, null, 2));
}

main();
