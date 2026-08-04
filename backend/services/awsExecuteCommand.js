import { spawn, execSync } from "child_process";
import os from "os";
import { ENV } from "../config/env.js";
import path from "path";
import fs from "fs";
import https from "https";

const localSsmDir = path.join(process.cwd(), "bin", "ssm-plugin");
const localBinPath = os.platform() === "win32"
  ? path.join(localSsmDir, "bin", "bin", "session-manager-plugin.exe")
  : path.join(localSsmDir, "bin", "session-manager-plugin");

export const ensureSessionManagerPluginInstalled = async () => {
  // 1. Check if globally installed in PATH
  try {
    const cmd = os.platform() === "win32" ? "where session-manager-plugin" : "which session-manager-plugin";
    execSync(cmd, { stdio: "ignore" });
    return;
  } catch (e) {
    // Not in PATH
  }

  // 2. Check if already locally installed in backend/bin/ssm-plugin
  if (fs.existsSync(localBinPath)) {
    return;
  }

  // 3. Auto-download for Windows if missing
  if (os.platform() === "win32") {
    console.log("[awsExecuteCommand] session-manager-plugin is missing. Auto-downloading portable Windows zip...");
    const zipUrl = "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPlugin.zip";
    const zipPath = path.join(os.tmpdir(), "SessionManagerPlugin.zip");

    try {
      fs.mkdirSync(localSsmDir, { recursive: true });
      
      // Download file via https
      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(zipPath);
        https.get(zipUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download plugin: HTTP ${response.statusCode}`));
            return;
          }
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
        }).on("error", (err) => {
          fs.unlink(zipPath, () => {});
          reject(err);
        });
      });

      console.log("[awsExecuteCommand] Extracting plugin archive...");
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${localSsmDir}' -Force"`, { stdio: "inherit" });
      fs.unlinkSync(zipPath);

      const packageZip = path.join(localSsmDir, "package.zip");
      const innerBinDir = path.join(localSsmDir, "bin");
      if (fs.existsSync(packageZip)) {
        execSync(`powershell -Command "Expand-Archive -Path '${packageZip}' -DestinationPath '${innerBinDir}' -Force"`, { stdio: "inherit" });
        fs.unlinkSync(packageZip);
      }
      console.log(`[awsExecuteCommand] session-manager-plugin successfully auto-installed at: ${localBinPath}`);
    } catch (err) {
      console.error("[awsExecuteCommand] Failed to auto-install session-manager-plugin:", err.message);
    }
  } else {
    console.warn("[awsExecuteCommand] session-manager-plugin is missing. Please install it globally on this platform (Linux/macOS).");
  }
};

export const getSsmEnv = () => {
  const env = { ...process.env };
  const additions = [];

  // Support custom path from .env (cross-platform)
  if (process.env.SESSION_MANAGER_PLUGIN_PATH) {
    additions.push(process.env.SESSION_MANAGER_PLUGIN_PATH);
  }

  // Prepend portable plugin local bin directory if it exists
  const localExeBinDir = path.join(localSsmDir, "bin", "bin");
  if (fs.existsSync(localExeBinDir)) {
    additions.push(localExeBinDir);
  }

  if (os.platform() === "win32") {
    const home = env.USERPROFILE || "C:\\Users\\Hackberry Softech";
    additions.push(
      path.join(home, ".gemini", "antigravity-ide", "ssm-plugin", "bin", "bin"),
      "C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin",
      "C:\\Program Files\\Amazon\\AWSCLIV2"
    );
  }

  if (additions.length > 0) {
    const separator = os.platform() === "win32" ? ";" : ":";
    const originalPath = env.PATH || env.Path || "";
    const newPath = [...additions, originalPath].join(separator);
    env.PATH = newPath;
    env.Path = newPath;
  }
  return env;
};

export const stripSsmNoise = (stdout) => {
  let cleanOut = stdout || "";
  cleanOut = cleanOut.replace(
    /The Session Manager plugin was installed successfully\.\s*Use the AWS CLI to start a session\.[\r\n]*/gi,
    "",
  );
  cleanOut = cleanOut.replace(/Starting session with SessionId:\s*[\w-]+\s*/gi, "");
  cleanOut = cleanOut.replace(/Exiting session with sessionId:\s*[\w-]+\.?\s*/gi, "");
  return cleanOut.trim();
};

/**
 * Executes a single AWS ECS execute-command CLI command using child_process.spawn (bypassing cmd.exe shell parsing).
 */
export const executeAwsCommand = async (session, commandValue, timeoutMs = 120000) => {
  await ensureSessionManagerPluginInstalled();

  const taskId = session.taskArn?.split("/").pop();
  const cluster = ENV.ecsCluster;
  const container = session.ContainerName || "lab-runtime";
  const region = ENV.awsRegion || "ap-south-1";

  if (!taskId) {
    throw new Error("Missing ECS task ARN for ExecuteCommand");
  }

  const args = [
    "ecs",
    "execute-command",
    "--cluster",
    cluster,
    "--task",
    taskId,
    "--container",
    container,
    "--interactive",
    "--command",
    commandValue,
    "--region",
    region,
  ];

  console.log(`[awsExecuteCommand] Spawning aws ecs execute-command with args:`, args);

  return new Promise((resolve, reject) => {
    const child = spawn("aws", args, {
      env: getSsmEnv(),
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`SSM command timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        const errMessage = stderr || stdout || `Process exited with code ${code}`;
        console.error(`[awsExecuteCommand] AWS CLI error:`, errMessage);

        if (errMessage.includes("TargetNotConnectedException") || errMessage.includes("is not connected")) {
          const connErr = new Error("ExecuteCommandAgent is still initializing. Retrying...");
          connErr.code = "TargetNotConnectedException";
          return reject(connErr);
        }
        if (errMessage.includes("SessionManagerPlugin") || errMessage.includes("SessionManagerPluginMissing")) {
          const pluginErr = new Error("AWS Session Manager Plugin is not installed on the host.");
          pluginErr.code = "SessionManagerPluginMissing";
          return reject(pluginErr);
        }
        if (errMessage.includes("TaskStopped") || errMessage.includes("is stopped")) {
          const stoppedErr = new Error("Lab container stopped unexpectedly.");
          stoppedErr.code = "TaskStopped";
          return reject(stoppedErr);
        }

        return reject(new Error(errMessage));
      }

      resolve(stripSsmNoise(stdout));
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
};
