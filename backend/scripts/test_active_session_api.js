import "dotenv/config";
import pool from "../lib/mysql.js";
import { sessionsListByUserHandler } from "../handlers/sessions.js";

async function testActiveSessionEndpoints() {
  console.log("=== Testing Active Session Endpoint Handler ===");

  const auth = { userId: 101, tenantId: "TEN000001", email: "student@vlab.edu", role: "STUDENT" };

  try {
    // Test 1: GET /lab-sessions/active (pathParameters is empty/undefined)
    const res1 = await sessionsListByUserHandler({
      pathParameters: {},
      auth
    });
    console.log("▶ GET /lab-sessions/active response status:", res1.statusCode);

    // Test 2: GET /lab-sessions/user/101 (own userId)
    const res2 = await sessionsListByUserHandler({
      pathParameters: { userId: "101" },
      auth
    });
    console.log("▶ GET /lab-sessions/user/101 response status:", res2.statusCode);

    console.log("✅ BOTH ACTIVE SESSION ENDPOINTS RESOLVED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ Test failed:", err);
  } finally {
    process.exit(0);
  }
}

testActiveSessionEndpoints();
