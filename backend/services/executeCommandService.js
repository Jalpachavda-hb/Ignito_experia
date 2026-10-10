import { describeTask } from "./ecsService.js";
import { updateSession } from "./sessionRepository.js";
import { executeAwsCommand } from "./awsExecuteCommand.js";
import { ENV } from "../config/env.js";
import { getPythonPlotHookB64 } from "../lib/pythonPlotHook.js";
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
export const executeViaSsm = async (session, { path: filePath, content, language, labType, action, stdin, dotnetSubtype }) => {
  const b64 = Buffer.from(content || "").toString("base64");
  
  let containerPath = filePath.replace(/\\/g, "/");
  if (containerPath.startsWith("/workspace/")) {
    containerPath = "/tmp/workspace/workspace/" + containerPath.substring(11);
  } else if (containerPath.startsWith("workspace/")) {
    containerPath = "/tmp/workspace/workspace/" + containerPath.substring(10);
  } else if (!containerPath.startsWith("/tmp/")) {
    containerPath = "/tmp/workspace/workspace/" + containerPath.replace(/^\/+/, "");
  }

  // Resolve parent directory path in Node.js using unix forward slashes for the container
  const parentDir = path.dirname(containerPath).replace(/\\/g, "/");
  const fileName = path.basename(containerPath);
  const currentLabType = labType || session?.labType || "";
  const isDotnet = language === "csharp" || filePath.endsWith(".cs") || currentLabType === "dotnet";

  const resolvedDotnetSubtype = String(
    dotnetSubtype || session?.dotnetSubtype || session?.subtype || session?.Subtype || ""
  ).toLowerCase().trim();

  const hasMvcSignatures = typeof content === "string" && (
    content.includes("WebApplication") ||
    content.includes("AddControllersWithViews") ||
    content.includes("Microsoft.AspNetCore") ||
    content.includes("MapControllerRoute") ||
    content.includes("MapControllers") ||
    content.includes("ControllerBase") ||
    content.includes("IActionResult") ||
    content.includes("ErrorViewModel")
  );

  const isMvcProject =
    resolvedDotnetSubtype === "mvc" ||
    hasMvcSignatures ||
    containerPath.includes("/MyWebApp/") ||
    containerPath.toLowerCase().includes("/controllers/") ||
    containerPath.toLowerCase().includes("/views/") ||
    containerPath.toLowerCase().endsWith(".cshtml");

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
  } else if (isDotnet) {
    if (action === "build") {
      runCmd = `dotnet build --nologo`;
    } else {
      runCmd = `dotnet run --nologo`;
    }
    interpreter = "sh";
  } else {
    runCmd = `sh ${containerPath}`;
  }

  const isPython = language === "python" || filePath.endsWith(".py");
  let pythonHookB64 = "";
  if (isPython) {
    pythonHookB64 = getPythonPlotHookB64();
  }

  const hasStdin = typeof stdin === "string" && stdin.length > 0;
  const stdinB64 = hasStdin ? Buffer.from(stdin).toString("base64") : "";

  // Create a robust self-contained runner script.
  // This avoids quote escaping and subshell parsing issues over the SSM connection.
  const runnerScript = `#!/bin/sh
mkdir -p "${parentDir}"
if [ $? -ne 0 ]; then
  echo "###EXIT_CODE:$?"
  exit $?
fi

cd "${parentDir}"
${isDotnet ? `
# Ensure workspace write permissions for NuGet restore & build outputs
chmod -R 777 /workspace /tmp/workspace "${parentDir}" 2>/dev/null || true

PROJECT_ARG=""
if [ "${isMvcProject ? "1" : "0"}" = "1" ]; then
  # Find the directory containing the .csproj file (e.g. /tmp/workspace/workspace/MyWebApp)
  PROJ_FILE=$(find /tmp/workspace/workspace /workspace "${parentDir}" . -maxdepth 3 -name "*.csproj" 2>/dev/null | grep -v "/opt/" | head -n 1)
  if [ -n "$PROJ_FILE" ]; then
    PROJ_DIR=$(dirname "$PROJ_FILE")
  elif [ -d "/tmp/workspace/workspace/MyWebApp" ]; then
    PROJ_DIR="/tmp/workspace/workspace/MyWebApp"
  elif [ -d "/workspace/MyWebApp" ]; then
    PROJ_DIR="/workspace/MyWebApp"
  else
    PROJ_DIR="${parentDir}"
  fi

  chmod -R 777 "$PROJ_DIR" 2>/dev/null || true
  rm -f "$PROJ_DIR/obj/"*.tmp 2>/dev/null || true

  # Ensure the active file or Program.cs is synced into the MVC project directory
  if [ -f "${containerPath}" ] && [ "$(basename "${containerPath}")" = "Program.cs" ]; then
    cp -f "${containerPath}" "$PROJ_DIR/Program.cs" 2>/dev/null || true
  fi
  if [ -f "/tmp/workspace/workspace/Program.cs" ] && [ "$PROJ_DIR" != "/tmp/workspace/workspace" ]; then
    cp -f "/tmp/workspace/workspace/Program.cs" "$PROJ_DIR/Program.cs" 2>/dev/null || true
  elif [ -f "/workspace/Program.cs" ] && [ "$PROJ_DIR" != "/workspace" ]; then
    cp -f "/workspace/Program.cs" "$PROJ_DIR/Program.cs" 2>/dev/null || true
  fi

  for sub in Controllers Models Views wwwroot; do
    if [ -d "/tmp/workspace/workspace/$sub" ] && [ "$PROJ_DIR" != "/tmp/workspace/workspace" ]; then
      cp -ru "/tmp/workspace/workspace/$sub" "$PROJ_DIR/" 2>/dev/null || true
    elif [ -d "/workspace/$sub" ] && [ "$PROJ_DIR" != "/workspace" ]; then
      cp -ru "/workspace/$sub" "$PROJ_DIR/" 2>/dev/null || true
    fi
  done

  cd "$PROJ_DIR"
  PROJECT_ARG="--project \"$PROJ_DIR\""
fi
` : ""}
${isPython ? `
mkdir -p /tmp/vlab_hooks
echo "${pythonHookB64}" | base64 -d > /tmp/vlab_hooks/sitecustomize.py
export PYTHONPATH="/tmp/vlab_hooks:\${PYTHONPATH}"
` : ""}

${content ? `
echo "${b64}" | base64 -d > "${containerPath}"
if [ $? -ne 0 ]; then
  echo "###EXIT_CODE:$?"
  exit $?
fi
chmod +x "${containerPath}"
` : ""}

${isMvcProject ? `
# For MVC projects, sync active edited file into project directory and stay in PROJ_DIR
if [ -n "$PROJ_DIR" ] && [ -d "$PROJ_DIR" ]; then
  if [ -f "${containerPath}" ] && [ "$(basename "${containerPath}")" = "Program.cs" ]; then
    cp -f "${containerPath}" "$PROJ_DIR/Program.cs" 2>/dev/null || true
  fi
  cd "$PROJ_DIR"
fi
` : `
cd "${parentDir}"
`}

${isDotnet && !isMvcProject ? `
# Isolated console snippet runner:
# Copy the active file into /opt/dotnet-snippet/Program.cs so that multiple .cs files in the workspace
# (e.g., Program.cs and Program1.cs each declaring 'class Program' or 'Main()') do not conflict.
SNIP_DIR="/opt/dotnet-snippet"
mkdir -p "$SNIP_DIR" 2>/dev/null || true
if ! find "$SNIP_DIR" -maxdepth 1 -name "*.csproj" 2>/dev/null | grep -q .; then
  if [ -f "${parentDir}/dotnet-snippet.csproj" ]; then
    cp "${parentDir}/dotnet-snippet.csproj" "$SNIP_DIR/" 2>/dev/null || true
  elif [ -f "/workspace/dotnet-snippet.csproj" ]; then
    cp "/workspace/dotnet-snippet.csproj" "$SNIP_DIR/" 2>/dev/null || true
  else
    (cd "$SNIP_DIR" && dotnet new console --force 2>/dev/null || true)
  fi
fi
if [ -d "${parentDir}/obj" ]; then
  cp -r "${parentDir}/obj" "$SNIP_DIR/" 2>/dev/null || true
elif [ -d "/workspace/obj" ]; then
  cp -r "/workspace/obj" "$SNIP_DIR/" 2>/dev/null || true
fi
cp "${containerPath}" "$SNIP_DIR/Program.cs"
cd "$SNIP_DIR"
PROJECT_ARG="--project $SNIP_DIR"
` : ""}

# Execute target command with optional stdin
${isDotnet && isMvcProject && action !== "build" ? `
# MVC Run execution: Build first to catch any errors, then start server and capture startup logs
kill $(pgrep -f "MyWebApp") 2>/dev/null || true
kill $(pgrep -f "dotnet") 2>/dev/null || true
pkill -f "MyWebApp.dll" 2>/dev/null || true
pkill -f "dotnet run" 2>/dev/null || true

dotnet build --nologo
BUILD_EXIT=$?
if [ $BUILD_EXIT -ne 0 ]; then
  echo "###EXIT_CODE:$BUILD_EXIT"
  exit $BUILD_EXIT
fi

(dotnet run --no-build --nologo > /tmp/mvc_app.log 2>&1 &)
MVC_PID=$!
sleep 4
if ps -p $MVC_PID > /dev/null 2>&1; then
  cat /tmp/mvc_app.log
  echo ""
  echo "Application started successfully."
  echo "###EXIT_CODE:0"
  exit 0
else
  cat /tmp/mvc_app.log
  WAIT_EXIT=0
  wait $MVC_PID 2>/dev/null || WAIT_EXIT=$?
  echo "###EXIT_CODE:\${WAIT_EXIT:-1}"
  exit \${WAIT_EXIT:-1}
fi
` : hasStdin ? `
echo "${stdinB64}" | base64 -d > /tmp/vlab_stdin.txt
(${runCmd} \${PROJECT_ARG:-}) < /tmp/vlab_stdin.txt
EXEC_EXIT=$?
rm -f /tmp/vlab_stdin.txt
echo "###EXIT_CODE:$EXEC_EXIT"
exit $EXEC_EXIT
` : `
(${runCmd} \${PROJECT_ARG:-}) < /dev/null
echo "###EXIT_CODE:$?"
`}
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
    cleanOutput = rawOutput.replace(/###EXIT_CODE:\d+[\r\n]*/g, "");
  }

  // Strip ANSI escape codes, terminal control sequences and formatting artifacts
  cleanOutput = cleanOutput
    .replace(/\x1b\[[0-9;?]*[a-zA-Z=]/g, "")
    .replace(/\x1b[=>]/g, "")
    .replace(/\+\[[0-9;?]*[a-zA-Z=]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/^\n+/, "")
    .trimEnd();

  // Extract plot HTML if present
  let plotHtml = null;
  const plotMatch = cleanOutput.match(/<!-- VLAB_PLOT_START -->([\s\S]*?)<!-- VLAB_PLOT_END -->/);
  if (plotMatch) {
    plotHtml = plotMatch[1].trim();
    cleanOutput = cleanOutput.replace(/<!-- VLAB_PLOT_START -->[\s\S]*?<!-- VLAB_PLOT_END -->/g, "").replace(/^\n+/, "").trimEnd();
  }

  const success = (exitCode === 0);
  return {
    success,
    output: cleanOutput,
    plotHtml,
    error: success ? null : (cleanOutput || "Execution failed"),
  };
};
