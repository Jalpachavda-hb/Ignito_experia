import { verifyDbConnection } from "../lib/mysql.js";

async function run() {
  console.log("[db:update] Starting database verification and updates...");
  const success = await verifyDbConnection();
  if (success) {
    console.log("[db:update] Database setup and migrations finished successfully!");
    process.exit(0);
  } else {
    console.error("[db:update] Database setup failed.");
    process.exit(1);
  }
}

run();
