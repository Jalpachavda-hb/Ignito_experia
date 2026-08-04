import { describeTask } from "./ecsService.js";
import { updateSession } from "./sessionRepository.js";
import { executeAwsCommand } from "./awsExecuteCommand.js";
import { ENV } from "../config/env.js";
import path from "path";

const updateExecuteCommandState = async (sessionId, state) => {
  try {
    await updateSession(sessionId, { executeCommandState: state });
  } catch (err) {
    console.error(`[ExecuteCommandService] Failed to update state for ${sessionId}:`, err.message);
  }
};

const verifyAgentReadiness = async (taskArn) => {
  const task = await describeTask(taskArn);
  if (!task) {
    return { ready: false, stopped: true, status: "NOT_FOUND", reason: "Task metadata not found in ECS." };
  }

  const lastStatus = task.lastStatus || "UNKNOWN";
  
  if (["STOPPED", "DEPROVISIONING", "STOPPING"].includes(lastStatus)) {
    return { ready: false, stopped: true, status: lastStatus, reason: `Task status is ${lastStatus}.` };
  }

  const container = task.containers?.find(c => c.name === "lab-runtime") || task.containers?.[0];
  if (!container) {
    return { ready: false, stopped: false, status: lastStatus, reason: "Container 'lab-runtime' not found in ECS task metadata." };
  }

  if (container.lastStatus === "STOPPED") {
    return { ready: false, stopped: true, status: lastStatus, reason: "Container 'lab-runtime' is STOPPED." };
  }

  const agent = container.managedAgents?.find(a => a.name === "ExecuteCommandAgent");
  if (!agent) {
    return { ready: false, stopped: false, status: lastStatus, reason: "ExecuteCommandAgent not initialized in ECS task metadata." };
  }

  if (
    lastStatus === "RUNNING" &&
    container.lastStatus === "RUNNING" &&
    agent.lastStatus === "RUNNING"
  ) {
    return { ready: true, stopped: false, status: "RUNNING", agent, container };
  }

  return { 
    ready: false, 
    stopped: false, 
    status: lastStatus, 
    reason: `Waiting for components: Task=${lastStatus}, Container=${container.lastStatus}, Agent=${agent.lastStatus}` 
  };
};

/**
 * Executes a command inside the container using AWS ECS execute-command with exponential backoff and connection checks.
 */
export const runCommandInContainer = async (session, commandValue, options = {}) => {
  const startTime = Date.now();
  const sessionId = session.sessionId;
  const taskArn = session.taskArn;

  if (!taskArn) {
    throw new Error("Cannot run SSM command: taskArn is not defined in session.");
  }

  console.log(`[ExecuteCommand] [START] Session: ${sessionId} | Command: ${commandValue}`);

  const maxRetries = Number(options.maxRetries || ENV.executeCommandMaxRetries || 6);
  const timeoutMs = Number(options.timeoutMs || ENV.executeCommandTimeout || 120000);
  const initialDelay = Number(options.initialDelay || ENV.executeCommandInitialDelay || 2000);
  const maxDelay = Number(options.maxDelay || ENV.executeCommandMaxDelay || 30000);
  const backoffFactor = Number(options.backoffFactor || ENV.executeCommandBackoffFactor || 1.5);

  let currentDelay = initialDelay;
  let attempt = 0;
  let lastError = null;

  await updateExecuteCommandState(sessionId, "connecting");

  while (attempt <= maxRetries) {
    attempt++;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[ExecuteCommand] [RUN] Session: ${sessionId} | Attempt: ${attempt}/${maxRetries + 1} | Elapsed: ${elapsed}s`);

    let readiness;
    try {
      readiness = await verifyAgentReadiness(taskArn);
    } catch (err) {
      readiness = { ready: false, stopped: false, reason: `ECS DescribeTask failed: ${err.message}` };
    }

    if (readiness.stopped) {
      const errorMsg = `Command execution aborted: ${readiness.reason}`;
      console.error(`[ExecuteCommand] [ABORT] Session: ${sessionId} | Reason: ${errorMsg}`);
      await updateExecuteCommandState(sessionId, "failed");
      throw new Error(errorMsg);
    }

    if (!readiness.ready) {
      console.log(`[ExecuteCommand] [WAIT] Session: ${sessionId} | Status: ${readiness.reason}`);
      await updateExecuteCommandState(sessionId, "retrying");
      
      console.log(`[ExecuteCommand] [BACKOFF] Session: ${sessionId} | Delaying ${currentDelay}ms...`);
      await new Promise(r => setTimeout(r, currentDelay));
      currentDelay = Math.min(currentDelay * backoffFactor, maxDelay);
      continue;
    }

    try {
      const output = await executeAwsCommand(session, commandValue, timeoutMs);
      const totalDuration = Date.now() - startTime;
      console.log(`[ExecuteCommand] [SUCCESS] Session: ${sessionId} | Duration: ${Math.round(totalDuration / 1000)}s`);
      await updateExecuteCommandState(sessionId, "connected");
      return output;
    } catch (err) {
      lastError = err;
      console.warn(`[ExecuteCommand] [FAIL] Session: ${sessionId} | Error Code: ${err.code || "UNKNOWN"} | Message: ${err.message}`);

      if (err.code === "SessionManagerPluginMissing" || err.code === "TaskStopped" || err.code === "ETIMEDOUT") {
        await updateExecuteCommandState(sessionId, "failed");
        throw err;
      }

      if (err.code === "TargetNotConnectedException" && attempt <= maxRetries) {
        if (attempt === maxRetries) {
          console.log(`[ExecuteCommand] [RECOVERY] Session: ${sessionId} | Attempting to refresh container network IPs...`);
          try {
            const task = await describeTask(taskArn);
            const eniAttachment = task?.attachments?.find(a => a.type === "ElasticNetworkInterface");
            const privateIpDetail = eniAttachment?.details?.find(d => d.name === "privateIPv4Address");
            const privateIp = privateIpDetail?.value;
            if (privateIp) {
              await updateSession(sessionId, { taskPrivateIp: privateIp });
            }
          } catch (recoveryErr) {
            console.error(`[ExecuteCommand] [RECOVERY_FAILED] Session: ${sessionId} | Network IP refresh failed:`, recoveryErr.message);
          }
        }

        console.log(`[ExecuteCommand] [BACKOFF] Session: ${sessionId} | Delaying ${currentDelay}ms...`);
        await new Promise(r => setTimeout(r, currentDelay));
        currentDelay = Math.min(currentDelay * backoffFactor, maxDelay);
        continue;
      }

      throw err;
    }
  }

  const totalDuration = Date.now() - startTime;
  const timeoutError = new Error(`ExecuteCommand failed: Connection remained unreachable after ${maxRetries + 1} attempts (${Math.round(totalDuration / 1000)}s).`);
  console.error(`[ExecuteCommand] [FATAL] Session: ${sessionId} | Error: ${timeoutError.message}`);
  await updateExecuteCommandState(sessionId, "failed");
  throw timeoutError;
};

/**
 * SSM bridge payload executor mapping path/content/language directly to Fargate execute-command shell writes.
 */
export const executeViaSsm = async (session, { path: filePath, content, language, labType }) => {
  const b64 = Buffer.from(content || "").toString("base64");
  
  let containerPath = filePath.replace(/\\/g, "/");
  if (containerPath.startsWith("/workspace/")) {
    containerPath = "/tmp/workspace/workspace/" + containerPath.substring(11);
  } else if (containerPath.startsWith("workspace/")) {
    containerPath = "/tmp/workspace/workspace/" + containerPath.substring(10);
  }

  // Resolve parent directory path in Node.js using unix forward slashes for the container
  const parentDir = path.dirname(containerPath).replace(/\\/g, "/");
  const fileName = path.basename(containerPath);
  const currentLabType = labType || session?.labType || "";

  let runCmd = "";
  let interpreter = "";
  if (language === "java" || filePath.endsWith(".java")) {
    const className = fileName.replace(/\.java$/, "");
    if (currentLabType === "testing") {
      runCmd = `(pgrep x11vnc >/dev/null || (killall -9 x11vnc 2>/dev/null; x11vnc -display :99 -forever -shared -nopw -rfbport 5900 -bg -noshm)) && export DISPLAY=:99 && javac -cp ".:/opt/selenium/lib/*" -d . ${containerPath} && java -Dwebdriver.chrome.driver=/usr/bin/chromedriver -cp ".:/opt/selenium/lib/*" ${className}`;
    } else {
      runCmd = `javac -d . ${containerPath} && java ${className}`;
    }
    interpreter = "sh";
  } else if (language === "python" || filePath.endsWith(".py")) {
    runCmd = `python3 ${containerPath}`;
    interpreter = "python3";
  } else if (language === "javascript" || filePath.endsWith(".js")) {
    runCmd = `node ${containerPath}`;
    interpreter = "node";
  } else if (language === "csharp" || filePath.endsWith(".cs")) {
    runCmd = `dotnet run`;
    interpreter = "sh";
  } else {
    runCmd = `sh ${containerPath}`;
  }

  // Create a robust self-contained runner script.
  // This avoids quote escaping and subshell parsing issues over the SSM connection.
  const runnerScript = `#!/bin/sh
mkdir -p "${parentDir}"
if [ $? -ne 0 ]; then
  echo "###EXIT_CODE:$?"
  exit $?
fi

echo "${b64}" | base64 -d > "${containerPath}"
if [ $? -ne 0 ]; then
  echo "###EXIT_CODE:$?"
  exit $?
fi

chmod +x "${containerPath}"
cd "${parentDir}"

# Execute target command
${runCmd}
echo "###EXIT_CODE:$?"
`;

  const runnerB64 = Buffer.from(runnerScript).toString("base64");
  const ssmCmd = `/bin/sh -c "echo '${runnerB64}' | base64 -d > /tmp/run_ssm.sh && chmod +x /tmp/run_ssm.sh && /bin/sh /tmp/run_ssm.sh"`;
  
  console.log(`[executeViaSsm] Running SSM command for session ${session.sessionId}...`);
  const rawOutput = await runCommandInContainer(session, ssmCmd);
  
  // Parse exit status code
  const exitCodeMatch = (rawOutput || "").match(/###EXIT_CODE:(\d+)/);
  let exitCode = 0;
  let cleanOutput = rawOutput || "";
  if (exitCodeMatch) {
    exitCode = parseInt(exitCodeMatch[1], 10);
    cleanOutput = rawOutput.replace(/###EXIT_CODE:\d+[\r\n]*/g, "").trim();
  }

  const success = (exitCode === 0);
  return {
    success,
    output: cleanOutput,
    error: success ? null : (cleanOutput || "Execution failed"),
  };
};
