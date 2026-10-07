import { getContainerPort, getContainerHost } from "../lib/labTools.js";
import { ENV } from "../config/env.js";
import { PYTHON_PLOT_HOOK_CODE } from "../lib/pythonPlotHook.js";

const EXECUTION_TIMEOUT_MS = ENV.executeCommandTimeout || 120000;

/**
 * Maps system/network error messages to standardized structured errors.
 */
const mapExecutionError = (err) => {
  const msg = (err.message || "").toLowerCase();
  if (msg.includes("abort") || msg.includes("timeout") || msg.includes("etimedout")) {
    return "Execution timeout";
  }
  if (msg.includes("econnrefused") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return "Container unreachable";
  }
  if (msg.includes("workspace") || msg.includes("enoent")) {
    return "Workspace unavailable";
  }
  if (msg.includes("build failed") || msg.includes("compile")) {
    return "Build failed";
  }
  if (msg.includes("runtime missing") || msg.includes("not found")) {
    return "Runtime unavailable";
  }
  return err.message || "Runtime initialization failed";
};

/**
 * Standardized execution service for executing student code inside ECS containers.
 * All executions are routed via the private VPC network.
 */
export const executeCode = async (session, payload, options = {}) => {
  const runId = options.runId || payload.runId || `run_${Date.now().toString(36)}`;

  // 1. Validate session status
  if (!session || session.status !== "running") {
    return {
      success: false,
      status: "FAILED",
      runId,
      output: "",
      error: "Container not running",
    };
  }

  // 2. Resolve runtime endpoint
  const host = getContainerHost(session);
  if (!host) {
    return {
      success: false,
      status: "FAILED",
      runId,
      output: "",
      error: "Container unreachable",
    };
  }

  const port = (await getContainerPort(session.labId)) || session.containerPort || 8080;
  const baseUrl = `http://${host}:${port}`;

  // 3. Resolve the endpoint mapping based on the action
  const action = (payload.action || "").toLowerCase();
  let endpoint = "/execute";
  if (action === "build") {
    endpoint = "/build";
  } else if (action === "format") {
    endpoint = "/format";
  }

  // 4. Send request to the container via the private network
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXECUTION_TIMEOUT_MS);

  try {
    const headers = {
      "Content-Type": "application/json",
    };
    if (session.sessionToken) {
      headers["X-Session-Token"] = session.sessionToken;
    }

    console.log(`[ExecutionService] Sending POST request to resolved endpoint: ${baseUrl}${endpoint} (RunId: ${runId})`);

    let execContent = payload.content || payload.code || "";
    const isPython = payload.language === "python" || (payload.path && payload.path.endsWith(".py"));
    if (isPython && !execContent.includes("_vlab_emit_html")) {
      const pythonHookInline = `exec(compile(${JSON.stringify(PYTHON_PLOT_HOOK_CODE)}, '<vlab_init>', 'exec'))\n`;
      execContent = pythonHookInline + execContent;
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        path: payload.path,
        content: execContent,
        language: payload.language,
        stdin: payload.stdin || "",
        labType: payload.labType,
        sessionId: session.sessionId,
        timeout: 360000,
        timeoutMs: 360000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${errorText || "Container error"}`);
    }

    const data = await response.json();

    if (data.output && data.output.includes("BUILD_STARTED")) {
      console.log(`[ExecutionService] Android background build started for session ${session.sessionId}. Starting polling loop...`);
      const startTime = Date.now();
      const timeoutMs = 360000; // 6 minutes
      let completed = false;
      let exitCode = 1;
      let output = "";
      
      const runHttpCmd = async (cmdPath, cmdContent) => {
        try {
          const res = await fetch(`${baseUrl}/execute`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              path: cmdPath,
              content: cmdContent,
              language: "shell",
              labType: "android",
              sessionId: session.sessionId,
            }),
          });
          if (res.ok) {
            const json = await res.json();
            return json.output || "";
          }
        } catch (e) {
          console.warn("[ExecutionService] runHttpCmd failed:", e.message);
        }
        return "";
      };

      while (Date.now() - startTime < timeoutMs) {
        const statusContent = await runHttpCmd("/workspace/read_status.sh", "cat build.status");
        if (statusContent && statusContent.trim() && !statusContent.includes("No such file")) {
          const parsedCode = parseInt(statusContent.trim(), 10);
          if (!isNaN(parsedCode)) {
            exitCode = parsedCode;
            completed = true;
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      output = await runHttpCmd("/workspace/read_log.sh", "cat build.log");
      if (!output) {
        output = "Failed to read build log from container.";
      }
      
      await runHttpCmd("/workspace/clean_build.sh", "rm -f build.status build.log").catch(() => {});
      
      return {
        success: completed && exitCode === 0,
        status: completed && exitCode === 0 ? "COMPLETED" : "FAILED",
        runId,
        output: output,
        error: completed ? (exitCode === 0 ? null : `Build failed with exit code ${exitCode}`) : "Build timed out after 6 minutes",
        syntaxError: "",
        runtimeError: completed && exitCode !== 0 ? `exit code ${exitCode}` : "",
      };
    }

    let cleanOutput = data.output || "";
    let plotHtml = null;
    const plotMatch = cleanOutput.match(/<!-- VLAB_PLOT_START -->([\s\S]*?)<!-- VLAB_PLOT_END -->/);
    if (plotMatch) {
      plotHtml = plotMatch[1].trim();
      cleanOutput = cleanOutput.replace(/<!-- VLAB_PLOT_START -->[\s\S]*?<!-- VLAB_PLOT_END -->/g, "").replace(/^\n+/, "").trimEnd();
    }

    return {
      success: data.success !== false,
      status: data.success !== false ? "COMPLETED" : "FAILED",
      runId,
      output: cleanOutput,
      plotHtml,
      error: data.error || null,
      syntaxError: data.syntaxError || "",
      runtimeError: data.runtimeError || "",
    };

  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[ExecutionService] Code execution failed for session ${session.sessionId}:`, err.message);

    const mappedError = mapExecutionError(err);
    return {
      success: false,
      status: "FAILED",
      runId,
      output: "",
      error: mappedError,
    };
  }
};
