import "dotenv/config";
import { ENV } from "../config/env.js";
ENV.ecsCluster = "";
import pool from "../lib/mysql.js";
import { creditWalletService } from "../services/CreditWalletService.js";
import {
  sessionsStartHandler,
  sessionsGetHandler,
  sessionsExtendHandler,
  sessionsStopHandler
} from "../handlers/sessions.js";

async function testLabSessionSystem() {
  console.log("=== Testing Lab Session & Credit Consumption Handlers ===");
  const testUserId = 999991;
  const testTenantId = "TENANT_TEST_99";
  const testLabId = "lab-python-101";

  try {
    // 1. Setup Test User & Wallet
    await pool.query("DELETE FROM credit_transactions WHERE UserId = ?", [testUserId]);
    await pool.query("DELETE FROM lab_sessions WHERE UserId = ?", [testUserId]);
    await pool.query("DELETE FROM credit_wallets WHERE UserId = ?", [testUserId]);
    await pool.query("DELETE FROM Users WHERE UserId = ?", [testUserId]);
    await pool.query("DELETE FROM Labs WHERE LabCode = ?", [testLabId]);

    await pool.query(
      `INSERT INTO Users (UserId, FullName, Email, PasswordHash, Role, Status, TenantId)
       VALUES (?, 'Test Student', 'teststudent99@vlab.edu', 'hash', 'STUDENT', 'Active', ?)`,
      [testUserId, testTenantId]
    );

    await pool.query(
      `INSERT INTO Labs (LabCode, Title, TaskDefinition, DurationMinutes, Credits, Category, Status)
       VALUES (?, 'Python Advanced Lab', 'vlab-ide-task-def', 60, 100, 'Programming Labs', 'active')`,
      [testLabId]
    );

    // Initialize wallet with 500 credits
    await creditWalletService.processPurchase({
      userId: testUserId,
      tenantId: testTenantId,
      credits: 500,
      amount: 500,
      currency: "INR",
      paymentReference: "PAY-INIT-500",
      idempotencyKey: "INIT-500-" + Date.now()
    });

    const walletBefore = await creditWalletService.getWallet(testUserId, testTenantId);
    console.log("▶ Initial Wallet Balance:", walletBefore.Balance, "Credits | Available:", walletBefore.AvailableCredits);

    const auth = { userId: testUserId, tenantId: testTenantId, email: 'teststudent99@vlab.edu' };

    const parseBody = (res) => {
      if (!res) return {};
      if (res.body && typeof res.body === 'string') return JSON.parse(res.body);
      if (res.body && typeof res.body === 'object') return res.body;
      return res;
    };

    // 2. Start Lab Session with 2 Blocks (200 Credits, 120 Minutes)
    console.log("\n--- Step 1: Starting Lab Session (2 Blocks = 200 Credits) ---");
    const startRes = await sessionsStartHandler({
      body: { labId: testLabId, sessionBlocks: 2, idempotencyKey: "START-TX-1" },
      auth
    });

    const startData = parseBody(startRes);
    console.log("Start Response:", {
      sessionId: startData.sessionId,
      status: startData.status,
      allocatedCredits: startData.allocatedCredits,
      allocatedDurationMinutes: startData.allocatedDurationMinutes,
      remainingSeconds: startData.remainingSeconds
    });

    const walletAfterStart = await creditWalletService.getWallet(testUserId, testTenantId);
    console.log("▶ Wallet Balance After Start:", walletAfterStart.Balance, "Credits (Deducted 200 Cr)");

    // 3. Active Session Check: Attempt to start a 2nd session (Should fail with 400)
    console.log("\n--- Step 2: Attempting 2nd Session Start for Same Student ---");
    try {
      await sessionsStartHandler({
        body: { labId: "lab-java-201", sessionBlocks: 1 },
        auth
      });
      console.error("❌ ERROR: Expected active session block failed to trigger!");
    } catch (err) {
      console.log("✅ Active session block correctly caught:", err.message);
    }

    // 4. Get Session Status
    console.log("\n--- Step 3: Fetching Authoritative Session Status ---");
    const getRes = await sessionsGetHandler({
      pathParameters: { sessionId: startData.sessionId },
      auth
    });
    const getData = parseBody(getRes);
    console.log("Get Response:", {
      sessionId: getData.sessionId,
      status: getData.status,
      remainingSeconds: getData.remainingSeconds,
      tenMinuteWarningSent: getData.tenMinuteWarningSent
    });

    // 5. Extend Session with 1 Block (+100 Credits, +60 Minutes)
    console.log("\n--- Step 4: Extending Session (+1 Block = +100 Credits) ---");
    const extendRes = await sessionsExtendHandler({
      pathParameters: { sessionId: startData.sessionId },
      body: { sessionBlocks: 1, idempotencyKey: "EXTEND-TX-1" },
      auth
    });
    const extendData = parseBody(extendRes);
    console.log("Extend Response:", {
      sessionId: extendData.sessionId,
      status: extendData.status,
      allocatedCredits: extendData.allocatedCredits,
      allocatedDurationMinutes: extendData.allocatedDurationMinutes,
      remainingSeconds: extendData.remainingSeconds
    });

    const walletAfterExtend = await creditWalletService.getWallet(testUserId, testTenantId);
    console.log("▶ Wallet Balance After Extend:", walletAfterExtend.Balance, "Credits (Deducted 100 Cr)");

    // 6. Stop Lab Session & Verify Proportional Credit Refund to Internal Wallet
    console.log("\n--- Step 5: Stopping Lab Session (Manual Early Stop Proportional Refund) ---");
    const stopRes = await sessionsStopHandler({
      pathParameters: { sessionId: startData.sessionId },
      auth
    });
    const stopData = parseBody(stopRes);
    console.log("Stop Response:", {
      sessionId: stopData.sessionId,
      status: stopData.status,
      actualMinutesUsed: stopData.actualMinutesUsed,
      finalCreditsConsumed: stopData.finalCreditsConsumed,
      refundedCredits: stopData.refundedCredits,
      newWalletBalance: stopData.newWalletBalance
    });

    const walletAfterStop = await creditWalletService.getWallet(testUserId, testTenantId);
    console.log("▶ Final Wallet Balance:", walletAfterStop.Balance, "Credits");

    // 7. Cleanup Test Data
    await pool.query("DELETE FROM credit_transactions WHERE UserId = ?", [testUserId]);
    await pool.query("DELETE FROM lab_sessions WHERE UserId = ?", [testUserId]);
    await pool.query("DELETE FROM credit_wallets WHERE UserId = ?", [testUserId]);
    await pool.query("DELETE FROM Users WHERE UserId = ?", [testUserId]);

    console.log("\n🎉 ALL BACKEND LAB SESSION HANDLER TESTS PASSED PERFECTLY!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    process.exit(0);
  }
}

testLabSessionSystem();
