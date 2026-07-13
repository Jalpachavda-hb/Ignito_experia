import util from "util";
import { exec } from "child_process";
import os from "os";
import fs from "fs";
import path from "path";
import { ENV } from "../config/env.js";

const execAsync = util.promisify(exec);

export const getSsmEnv = () => {
  const env = { ...process.env };
  if (os.platform() === "win32") {
    const additions = [
      "C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin",
      "C:\\Program Files\\Amazon\\AWSCLIV2",
    ];
    const originalPath = env.PATH || env.Path || "";
    const newPath = [
      ...additions,
      originalPath,
    ].join(";");
    env.PATH = newPath;
    env.Path = newPath;
  }
  return env;
};

const resolveAwsCli = () => {
  const awsExePath = process.env.AWS_CLI_PATH || "aws";
  return { awsExePath, argsPrepend: [], isLocalWinSetup: false };
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
 * Executes a single AWS ECS execute-command CLI command.
 * Throws mapped errors. Does not handle retries.
 */
export const executeAwsCommand = async (session, commandValue, timeoutMs = 120000) => {
  const taskId = session.taskArn?.split("/").pop();
  const cluster = ENV.ecsCluster;
  const container = session.ContainerName || "lab-runtime";
  const region = ENV.awsRegion || "ap-south-1";

  if (!taskId) {
    throw new Error("Missing ECS task ARN for ExecuteCommand");
  }

  const aws = resolveAwsCli();
  let awsPrefix = `"${aws.awsExePath}"`;
  if (aws.argsPrepend.length > 0) {
    awsPrefix = `"${aws.awsExePath}" ${aws.argsPrepend.map((a) => `"${a}"`).join(" ")}`;
  } else if (!aws.awsExePath.includes("\\") && !aws.awsExePath.includes("/")) {
    awsPrefix = aws.awsExePath;
  }

  const nullDev = os.platform() === "win32" ? "NUL" : "/dev/null";
  const execCmd = `${awsPrefix} ecs execute-command --cluster ${cluster} --task ${taskId} --container ${container} --interactive --command "${commandValue}" --region ${region} < ${nullDev}`;

  try {
    const { stdout } = await execAsync(execCmd, {
      env: getSsmEnv(),
      maxBuffer: 10 * 1024 * 1024,
      timeout: timeoutMs,
    });
    return stripSsmNoise(stdout);
  } catch (err) {
    const errMessage = err.message || "";
    const errStderr = err.stderr || "";

    if (
      errMessage.includes("TargetNotConnectedException") ||
      errStderr.includes("TargetNotConnectedException") ||
      errMessage.includes("is not connected")
    ) {
      const connErr = new Error("ExecuteCommandAgent is still initializing. Retrying...");
      connErr.code = "TargetNotConnectedException";
      throw connErr;
    }

    if (
      errMessage.includes("SessionManagerPlugin") ||
      errStderr.includes("SessionManagerPlugin")
    ) {
      const pluginErr = new Error("AWS Session Manager Plugin is not installed on the host.");
      pluginErr.code = "SessionManagerPluginMissing";
      throw pluginErr;
    }

    if (
      errMessage.includes("TaskStopped") ||
      errStderr.includes("TaskStopped") ||
      errMessage.includes("is stopped")
    ) {
      const stoppedErr = new Error("Lab container stopped unexpectedly.");
      stoppedErr.code = "TaskStopped";
      throw stoppedErr;
    }

    if (err.killed || err.code === "ETIMEDOUT") {
      const timeoutErr = new Error(`SSM command timed out after ${Math.round(timeoutMs / 1000)}s`);
      timeoutErr.code = "ETIMEDOUT";
      throw timeoutErr;
    }

    throw err;
  }
};
