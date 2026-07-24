import fs from "fs";
import path from "path";
import https from "https";
import net from "net";
import { exec } from "child_process";
import { promisify } from "util";
import { getSession, updateSession } from "./sessionRepository.js";
import { getPresignedUrl } from "./containerClient.js";
import { getContainerPort, getContainerHost } from "../lib/labTools.js";
import { getLabById } from "../config/labs.js";
import { ENV } from "../config/env.js";
import { executeCode } from "./ExecutionService.js";

const execAsync = promisify(exec);
const BOOTSTRAP_VERSION = "1.0.0";
const BOOTSTRAP_TIMEOUT_MS = 120000; // 120 seconds

const checkPort = (host, port) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let connected = false;

    socket.setTimeout(1500);

    socket.on("connect", () => {
      connected = true;
      socket.destroy();
    });

    socket.on("timeout", () => {
      socket.destroy();
    });

    socket.on("error", () => {
      socket.destroy();
    });

    socket.on("close", () => {
      resolve(connected);
    });

    socket.connect(port, host);
  });
};

const getLocalWorkspaceRoot = () => {
  if (process.env.LAB_WORKSPACE) {
    return path.join(process.env.LAB_WORKSPACE, "workspace");
  }
  return path.resolve(process.cwd(), "..");
};

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download starter archive: HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

const extractTar = async (tarPath, destDir) => {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  await execAsync(`tar -xzf "${tarPath}" -C "${destDir}"`);
};

// Data-driven template configuration resolver
const getTemplateConfig = (session, lab) => {
  // 1. Check data-driven overrides in lab definition
  if (lab?.requiresStarterFiles || lab?.starterAssetKey || lab?.runtime?.bootstrap?.assetKey) {
    const assetKey = lab.starterAssetKey || lab.runtime.bootstrap?.assetKey;
    const requiredFiles = lab.requiredFiles || lab.runtime.bootstrap?.requiredFiles || [];
    return { assetKey, requiredFiles };
  }

  // 2. Fall back to matching session labId / labType
  const labId = (session.labId || "").toLowerCase();
  const labType = (session.labType || "").toLowerCase();

  const isAndroid = labId === "mobile-app-lab" || labId === "android" || labType === "android";
  const isDotnet = labType === "dotnet" || labId === "dotnet-lab" || labId.includes("dotnet");
  const isDataScience = labType === "datascience" || labId === "data-science-lab" || labId.includes("datascience") || labId.includes("jupyter") || labId.includes("notebook");

  if (isAndroid) {
    return {
      assetKey: "lab-assets/android/starter/latest.tar.gz",
      requiredFiles: ["gradlew", "settings.gradle", "app/"],
    };
  }

  if (isDotnet) {
    let isMvc = false;
    if (session.dotnetSubtype) {
      isMvc = session.dotnetSubtype === "mvc";
    } else {
      isMvc = labId.includes("mvc") || labId.includes("mvc-app") || labType.includes("mvc");
    }
    return isMvc ? {
      assetKey: "lab-assets/dotnet/mvc/latest.tar.gz",
      requiredFiles: ["Program.cs", "Controllers/", "Views/"],
    } : {
      assetKey: "lab-assets/dotnet/console-snippet/latest.tar.gz",
      requiredFiles: ["Program.cs"],
    };
  }

  if (isDataScience) {
    return {
      assetKey: "lab-assets/datascience/notebook/latest.tar.gz",
      requiredFiles: ["notebook.ipynb"],
    };
  }

  return null; // Starter files not required for this lab
};

const waitForContainerReady = async (session, timeoutMs = 45000) => {
  const host = getContainerHost(session);
  const port = (await getContainerPort(session.labId)) || session.containerPort || 8080;
  if (!host) {
    throw new Error("Container unreachable (no host IP resolved)");
  }

  console.log(`[WorkspaceBootstrap] Probing container port health check at ${host}:${port}...`);
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const ok = await checkPort(host, port);
    if (ok) {
      console.log(`[WorkspaceBootstrap] Container port health check PASSED at ${host}:${port}`);
      return { host, port };
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Container health check timed out (unreachable at ${host}:${port})`);
};

const runContainerSsmBootstrap = async (session, presignedUrl) => {
  const shellScript = `#!/bin/sh
PRESIGNED_URL="${presignedUrl}"
DEST_DIR="/tmp/workspace/workspace"
TMP_TAR="/tmp/bootstrap.tar.gz"

mkdir -p "$DEST_DIR"
if command -v curl >/dev/null 2>&1; then
    curl -sSL -o "$TMP_TAR" "$PRESIGNED_URL"
elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$TMP_TAR" "$PRESIGNED_URL"
else
    echo "ERROR: Neither curl nor wget is available"
    exit 1
fi

if [ -f "$TMP_TAR" ]; then
    tar -xzf "$TMP_TAR" -C "$DEST_DIR"
    rm -f "$TMP_TAR"
    
    # Fix CRLF line endings for gradlew and build.sh and make executable
    for filename in gradlew build.sh; do
        filepath="$DEST_DIR/$filename"
        if [ -f "$filepath" ]; then
            sed -i 's/\\r$//' "$filepath"
            chmod +x "$filepath"
        fi
    done
    echo "SUCCESS"
else
    echo "ERROR: Failed to download archive"
    exit 1
fi
`;

  const payload = {
    action: "run",
    path: "/tmp/bootstrap.sh",
    language: "shell",
    labType: "linux",
    content: shellScript,
  };

  console.log(`[WorkspaceBootstrap] Executing SSM bootstrap sync inside container...`);
  const result = await executeCode(session, payload);
  console.log(`[WorkspaceBootstrap] Container SSM bootstrap outcome:`, result?.output || "No output");
  if (!result || !result.success || !result.output.includes("SUCCESS")) {
    throw new Error(`SSM Bootstrap shell script failed: ${result?.error || result?.output}`);
  }
};

const verifyContainerWorkspace = async (session, requiredFiles) => {
  if (!requiredFiles || requiredFiles.length === 0) return;

  const checks = requiredFiles.map((file) => {
    if (file.endsWith("/")) {
      const cleanDir = file.slice(0, -1);
      return `[ -d "/tmp/workspace/workspace/${cleanDir}" ]`;
    } else {
      return `[ -f "/tmp/workspace/workspace/${file}" ]`;
    }
  }).join(" && ");

  const shellScript = `#!/bin/sh
if ${checks}; then
    echo "VERIFY_SUCCESS"
else
    echo "VERIFY_FAILED"
    exit 1
fi
`;

  const payload = {
    action: "run",
    path: "/tmp/verify_workspace.sh",
    language: "shell",
    labType: "linux",
    content: shellScript,
  };

  console.log(`[WorkspaceBootstrap] Verifying container workspace with required files: ${requiredFiles.join(", ")}`);
  const result = await executeCode(session, payload);
  if (!result || !result.success || !result.output.includes("VERIFY_SUCCESS")) {
    throw new Error(`Workspace verification failed. Required files not found: ${requiredFiles.join(", ")}. Container output: ${result?.output || "None"}`);
  }
  console.log(`[WorkspaceBootstrap] Container workspace verification PASSED.`);
};

const verifyLocalWorkspace = (localDestDir, requiredFiles) => {
  if (!requiredFiles || requiredFiles.length === 0) return;

  for (const file of requiredFiles) {
    const fullPath = path.join(localDestDir, file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Workspace verification failed. Required local file or folder missing: ${file}`);
    }
  }
  console.log(`[WorkspaceBootstrap] Local workspace verification PASSED.`);
};

// Main bootstrap execution
export const bootstrap = async (session, netInfo = null) => {
  const sessionId = session.sessionId;

  // Re-fetch session to ensure fresh state check
  const freshSession = await getSession(sessionId);
  if (!freshSession) {
    console.warn(`[WorkspaceBootstrap] Session ${sessionId} not found during start.`);
    return;
  }

  // Idempotency: Skip if already successfully bootstrapped
  if (freshSession.isBootstrapped && freshSession.bootstrapState === "READY" && freshSession.bootstrapVersion === BOOTSTRAP_VERSION) {
    console.log(`[WorkspaceBootstrap] Session ${sessionId} is already bootstrapped (READY). Skipping.`);
    return;
  }

  // DB Coordination: Check if another replica/process is already bootstrapping
  if (freshSession.bootstrapState === "BOOTSTRAPPING") {
    const now = Date.now();
    const startedAt = freshSession.bootstrapStartedAt ? new Date(freshSession.bootstrapStartedAt).getTime() : now;
    // If it has been running for less than timeout, do not duplicate
    if (now - startedAt < BOOTSTRAP_TIMEOUT_MS) {
      console.log(`[WorkspaceBootstrap] Bootstrap already in progress by another worker for session ${sessionId}.`);
      return;
    }
    console.warn(`[WorkspaceBootstrap] Previous bootstrap for session ${sessionId} hung or timed out. Re-initiating.`);
  }

  // Atomically update DB status to BOOTSTRAPPING to acquire lock
  await updateSession(sessionId, {
    bootstrapState: "BOOTSTRAPPING",
    bootstrapStartedAt: new Date().toISOString(),
    message: "Initializing workspace and downloading templates...",
  });

  const runBootstrapOnce = async () => {
    const lab = await getLabById(freshSession.labId);
    const config = getTemplateConfig(freshSession, lab);

    if (!config) {
      console.log(`[WorkspaceBootstrap] Lab ${freshSession.labId} does not require starter files.`);
      return;
    }

    const { assetKey, requiredFiles } = config;
    const bucket = ENV.testCasesBucket || "vlab-dev-lab-files-0kdrg0q8";
    const ttl = ENV.labBootstrapPresignTtlSeconds || 3600;

    console.log(`[WorkspaceBootstrap] Resolving starter files for key: s3://${bucket}/${assetKey}`);
    const presignedUrl = await getPresignedUrl(bucket, assetKey, ttl);

    const isEcs = !!freshSession.taskArn && (ENV.ecsCluster || netInfo);

    if (isEcs) {
      // Container boot
      console.log(`[WorkspaceBootstrap] Performing container bootstrap for session ${sessionId}`);
      const { host, port } = await waitForContainerReady(freshSession);
      const baseUrl = `http://${host}:${port}`;

      console.log(`[WorkspaceBootstrap] Sending POST /bootstrap to container API: ${baseUrl}/bootstrap`);
      const headers = { "Content-Type": "application/json" };
      if (freshSession.sessionToken) {
        headers["X-Session-Token"] = freshSession.sessionToken;
      }
      
      let ssmFallbackNeeded = false;
      try {
        const response = await fetch(`${baseUrl}/bootstrap`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            sessionId: freshSession.sessionId,
            labType: freshSession.labType,
            starterUrl: presignedUrl,
            bootstrapVersion: "1"
          }),
        });

        if (response.status === 404) {
          console.warn(`[WorkspaceBootstrap] Container bootstrap endpoint returned HTTP 404 (not implemented yet). Falling back to SSM...`);
          ssmFallbackNeeded = true;
        } else if (!response.ok) {
          throw new Error(`Container bootstrap endpoint returned HTTP ${response.status}`);
        } else {
          const resData = await response.json();
          console.log(`[WorkspaceBootstrap] Container bootstrap response:`, resData);

          if (resData.success !== true || resData.bootstrapped !== true || resData.verified !== true) {
            throw new Error(resData.reason || resData.message || "Workspace verification failed inside the container runtime");
          }
          console.log(`[WorkspaceBootstrap] Container bootstrap and verification passed.`);
        }
      } catch (err) {
        console.warn(`[WorkspaceBootstrap] HTTP bootstrap attempt failed: ${err.message}. Checking SSM fallback...`);
        if (err.message.includes("404") || err.message.includes("fetch failed") || err.message.includes("refused")) {
          ssmFallbackNeeded = true;
        } else {
          throw err;
        }
      }

      if (ssmFallbackNeeded) {
        console.log(`[WorkspaceBootstrap] Running SSM-based S3 bootstrap fallback...`);
        await runContainerSsmBootstrap(freshSession, presignedUrl);
        await verifyContainerWorkspace(freshSession, requiredFiles);
      }
    } else {
      // Local boot
      console.log(`[WorkspaceBootstrap] Performing local mock bootstrap for session ${sessionId}`);
      const root = getLocalWorkspaceRoot();
      if (!fs.existsSync(root)) {
        fs.mkdirSync(root, { recursive: true });
      }

      const tempTarPath = path.join(root, `bootstrap_${sessionId}.tar.gz`);

      console.log(`[WorkspaceBootstrap] Downloading starter archive to: ${tempTarPath}`);
      await downloadFile(presignedUrl, tempTarPath);

      console.log(`[WorkspaceBootstrap] Extracting archive...`);
      await extractTar(tempTarPath, root);

      if (fs.existsSync(tempTarPath)) {
        fs.unlinkSync(tempTarPath);
      }

      // Script normalization
      for (const filename of ["gradlew", "build.sh"]) {
        const filepath = path.join(root, filename);
        if (fs.existsSync(filepath)) {
          try {
            let content = fs.readFileSync(filepath, "utf8");
            content = content.replace(/\r\n/g, "\n");
            fs.writeFileSync(filepath, content, "utf8");
            fs.chmodSync(filepath, 0o755);
          } catch (e) {
            console.warn(`[WorkspaceBootstrap] Local script normalization failed: ${e.message}`);
          }
        }
      }

      // Verify local workspace contents
      verifyLocalWorkspace(root, requiredFiles);
    }
  };

  const runWithTimeout = async () => {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Bootstrap timed out (exceeded 120s limit)")), BOOTSTRAP_TIMEOUT_MS)
    );
    await Promise.race([runBootstrapOnce(), timeoutPromise]);
  };

  try {
    // Attempt 1
    await runWithTimeout();
  } catch (err) {
    console.warn(`[WorkspaceBootstrap] First bootstrap attempt failed for session ${sessionId}: ${err.message}. Retrying once...`);
    try {
      // Attempt 2 (Exactly one retry)
      await runWithTimeout();
    } catch (retryErr) {
      console.error(`[WorkspaceBootstrap] Fatal bootstrap failure (including retry) for session ${sessionId}:`, retryErr.message);
      await updateSession(sessionId, {
        bootstrapState: "FAILED",
        bootstrapError: retryErr.message,
        status: "failed",
        message: `Workspace initialization failed: ${retryErr.message}`,
      });
      return;
    }
  }

  // Set READY status and invalidate cached files
  await updateSession(sessionId, {
    bootstrapState: "READY",
    isBootstrapped: true,
    bootstrapCompletedAt: new Date().toISOString(),
    bootstrapVersion: BOOTSTRAP_VERSION,
    status: "running",
    files: null, // Clear/invalidate any files cache
    message: "Workspace ready",
  });
  console.log(`[WorkspaceBootstrap] Bootstrap COMPLETED and verified successfully for session ${sessionId}.`);
};
