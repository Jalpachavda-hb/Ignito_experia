import { spawn, execSync } from "child_process";
import os from "os";
import { ENV } from "../config/env.js";
import { isDirectContainerMode } from "../lib/ipManager.js";
import { ECSClient, ExecuteCommandCommand } from "@aws-sdk/client-ecs";
import path from "path";
import fs from "fs";
import https from "https";

const localSsmDir = path.join(process.cwd(), "bin", "ssm-plugin");
const localBinPath = os.platform() === "win32"
  ? path.join(localSsmDir, "bin", "bin", "session-manager-plugin.exe")
  : path.join(localSsmDir, "bin", "session-manager-plugin");

export const ensureSessionManagerPluginInstalled = async () => {
  // Direct container communication on AWS EC2 does not require session-manager-plugin
  if (isDirectContainerMode() && os.platform() !== "win32") {
    return;
  }

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
    // 4. Auto-download for Linux if missing
    try {
      console.log("[awsExecuteCommand] session-manager-plugin is missing on Linux. Auto-downloading portable package...");
      const debUrl = "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb";
      const debPath = path.join(os.tmpdir(), "session-manager-plugin.deb");

      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(debPath);
        https.get(debUrl, (response) => {
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
          fs.unlink(debPath, () => {});
          reject(err);
        });
      });

      fs.mkdirSync(localSsmDir, { recursive: true });
      execSync(`dpkg-deb -x "${debPath}" "${localSsmDir}" 2>/dev/null || (cd "${localSsmDir}" && ar x "${debPath}" && tar -xf data.tar.*)`, { stdio: "ignore" });
      const extractedBin = path.join(localSsmDir, "usr", "local", "sessionmanagerplugin", "bin", "session-manager-plugin");
      const targetBin = path.join(localSsmDir, "bin", "session-manager-plugin");
      fs.mkdirSync(path.dirname(targetBin), { recursive: true });
      if (fs.existsSync(extractedBin)) {
        fs.copyFileSync(extractedBin, targetBin);
        fs.chmodSync(targetBin, 0o755);
      }
      try { fs.unlinkSync(debPath); } catch (_) {}
      console.log(`[awsExecuteCommand] session-manager-plugin successfully auto-installed at: ${targetBin}`);
    } catch (err) {
      console.warn("[awsExecuteCommand] session-manager-plugin is missing. Please install it globally on this platform (Linux/macOS). Error:", err.message);
    }
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
  } else {
    // Linux / Ubuntu standard locations
    additions.push(
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
      "/usr/local/sessionmanagerplugin/bin",
      "/snap/bin",
      path.join(os.homedir(), ".local/bin")
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

export const resolveSessionManagerPluginPath = () => {
  if (process.env.SESSION_MANAGER_PLUGIN_PATH && fs.existsSync(process.env.SESSION_MANAGER_PLUGIN_PATH)) {
    return process.env.SESSION_MANAGER_PLUGIN_PATH;
  }

  if (os.platform() === "win32") {
    if (fs.existsSync(localBinPath)) return localBinPath;
    const defaultWin = "C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin\\session-manager-plugin.exe";
    if (fs.existsSync(defaultWin)) return defaultWin;
  } else {
    if (fs.existsSync(localBinPath)) return localBinPath;
    const linuxCandidates = [
      path.join(localSsmDir, "bin", "session-manager-plugin"),
      "/usr/local/sessionmanagerplugin/bin/session-manager-plugin",
      "/usr/local/bin/session-manager-plugin",
      "/usr/bin/session-manager-plugin",
      "/bin/session-manager-plugin",
      path.join(os.homedir(), ".local/bin/session-manager-plugin"),
    ];
    for (const cand of linuxCandidates) {
      if (fs.existsSync(cand)) return cand;
    }
  }

  return "session-manager-plugin";
};

export const resolveAwsCliPath = () => {
  if (ENV.awsCliPath && ENV.awsCliPath !== "aws" && fs.existsSync(ENV.awsCliPath)) {
    return ENV.awsCliPath;
  }

  if (os.platform() === "win32") {
    const defaultWin = "C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe";
    if (fs.existsSync(defaultWin)) {
      return defaultWin;
    }
  } else {
    const linuxCandidates = [
      "/usr/local/bin/aws",
      "/usr/bin/aws",
      "/bin/aws",
      "/snap/bin/aws",
      path.join(os.homedir(), ".local/bin/aws"),
    ];
    for (const cand of linuxCandidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }
  }

  return "aws";
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
 * Executes a single AWS ECS execute-command using pure AWS SDK (@aws-sdk/client-ecs)
 * and connects session streams via session-manager-plugin (without shelling out to 'aws' CLI).
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

  // 1. Direct AWS SDK ExecuteCommand (Pure API - No AWS CLI executable required)
  let sdkSession = null;
  try {
    const ecsClient = new ECSClient({ region });
    const response = await ecsClient.send(
      new ExecuteCommandCommand({
        cluster,
        task: taskId,
        container,
        interactive: true,
        command: commandValue,
      })
    );
    sdkSession = response?.session;
  } catch (sdkErr) {
    console.warn(`[awsExecuteCommand] ECS ExecuteCommand SDK API call failed: ${sdkErr.message}`);
    if (sdkErr.name === "TargetNotConnectedException" || sdkErr.message?.includes("is not connected")) {
      const connErr = new Error("ExecuteCommandAgent is still initializing. Retrying...");
      connErr.code = "TargetNotConnectedException";
      throw connErr;
    }
    if (sdkErr.name === "InvalidParameterException" && (sdkErr.message?.includes("stopped") || sdkErr.message?.includes("not running") || sdkErr.message?.includes("isn't running"))) {
      const stoppedErr = new Error("Lab container stopped unexpectedly.");
      stoppedErr.code = "TaskStopped";
      throw stoppedErr;
    }
    throw sdkErr;
  }

  if (sdkSession) {
    const pluginBin = resolveSessionManagerPluginPath();
    console.log(`[awsExecuteCommand] Launching session-manager-plugin via ${pluginBin} for taskId: ${taskId}`);

    return new Promise((resolve, reject) => {
      const args = [JSON.stringify(sdkSession), region, "StartSession", ""];
      const child = spawn(pluginBin, args, {
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

      child.on("error", (err) => {
        clearTimeout(timeout);
        return reject(err);
      });

      child.on("close", (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          const errMessage = stderr || stdout || `Process exited with code ${code}`;
          console.error(`[awsExecuteCommand] session-manager-plugin error:`, errMessage);
          return reject(new Error(errMessage));
        }

        resolve(stripSsmNoise(stdout));
      });
    });
  }

  throw new Error("Failed to initialize ECS ExecuteCommand session.");
};

