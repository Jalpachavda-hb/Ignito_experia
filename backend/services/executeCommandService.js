import { describeTask } from "./ecsService.js";
import { updateSession } from "./sessionRepository.js";
import { executeAwsCommand } from "./awsExecuteCommand.js";
import { ENV } from "../config/env.js";

export const METRICS = {
  totalRequests: 0,
  successCount: 0,
  retryCount: 0,
  totalWaitTimeMs: 0,
  failureReasons: {},
  timeoutCount: 0,
};

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
  METRICS.totalRequests++;

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
      METRICS.failureReasons[readiness.status] = (METRICS.failureReasons[readiness.status] || 0) + 1;
      throw new Error(errorMsg);
    }

    if (!readiness.ready) {
      console.log(`[ExecuteCommand] [WAIT] Session: ${sessionId} | Status: ${readiness.reason}`);
      await updateExecuteCommandState(sessionId, "retrying");
      
      console.log(`[ExecuteCommand] [BACKOFF] Session: ${sessionId} | Delaying ${currentDelay}ms...`);
      await new Promise(r => setTimeout(r, currentDelay));
      currentDelay = Math.min(currentDelay * backoffFactor, maxDelay);
      METRICS.retryCount++;
      continue;
    }

    try {
      const output = await executeAwsCommand(session, commandValue, timeoutMs);
      const totalDuration = Date.now() - startTime;
      METRICS.successCount++;
      METRICS.totalWaitTimeMs += totalDuration;
      
      console.log(`[ExecuteCommand] [SUCCESS] Session: ${sessionId} | Duration: ${Math.round(totalDuration / 1000)}s`);
      await updateExecuteCommandState(sessionId, "connected");
      return output;
    } catch (err) {
      lastError = err;
      METRICS.retryCount++;

      console.warn(`[ExecuteCommand] [FAIL] Session: ${sessionId} | Error Code: ${err.code || "UNKNOWN"} | Message: ${err.message}`);

      if (err.code === "SessionManagerPluginMissing" || err.code === "TaskStopped" || err.code === "ETIMEDOUT") {
        if (err.code === "ETIMEDOUT") {
          METRICS.timeoutCount++;
        }
        METRICS.failureReasons[err.code] = (METRICS.failureReasons[err.code] || 0) + 1;
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
  METRICS.failureReasons["MAX_RETRIES_EXCEEDED"] = (METRICS.failureReasons["MAX_RETRIES_EXCEEDED"] || 0) + 1;
  throw timeoutError;
};
