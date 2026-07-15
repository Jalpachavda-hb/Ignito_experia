import { executeCode } from "../services/ExecutionService.js";
import { getPresignedUrl } from "../services/containerClient.js";

async function verify() {
  console.log("=== VERIFYING REFACTORED CONTAINER ARCHITECTURE ===");

  // 1. Verify S3 presign URL generation without dependencies
  console.log("Testing cryptographic S3 presigner...");
  try {
    const url = await getPresignedUrl("test-bucket", "assets/starter.tar.gz", 3600);
    console.log("Presigned URL created successfully:", url);
    if (!url.startsWith("https://test-bucket.s3")) {
      throw new Error("Invalid presigned URL base");
    }
  } catch (err) {
    console.error("Presign test failed:", err);
  }

  // 2. Verify ExecutionService mock handling
  console.log("\nTesting ExecutionService mock handling...");
  const mockSessionOffline = {
    sessionId: "mock-session-id",
    status: "stopped",
    taskPrivateIp: "10.0.0.5",
  };

  const offlineRes = await executeCode(mockSessionOffline, {
    path: "Main.py",
    content: "print('hello')",
    language: "python"
  });

  console.log("Offline Session execution result:", JSON.stringify(offlineRes, null, 2));
  if (offlineRes.error !== "Container not running") {
    console.error("FAILED: ExecutionService did not catch stopped session correctly.");
  } else {
    console.log("SUCCESS: ExecutionService correctly caught stopped session.");
  }

  const mockSessionNoIp = {
    sessionId: "mock-session-id",
    status: "running",
    taskPrivateIp: null,
  };

  const noIpRes = await executeCode(mockSessionNoIp, {
    path: "Main.py",
    content: "print('hello')",
    language: "python"
  });

  console.log("No IP Session execution result:", JSON.stringify(noIpRes, null, 2));
  if (noIpRes.error !== "Container unreachable") {
    console.error("FAILED: ExecutionService did not catch missing private IP correctly.");
  } else {
    console.log("SUCCESS: ExecutionService correctly caught missing private IP.");
  }

  console.log("\n=== VERIFICATION COMPLETE ===");
}

verify();
