import { getContainerPort, getContainerHost } from "../lib/labTools.js";
import { ENV } from "../config/env.js";

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

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        path: payload.path,
        content: payload.content || payload.code || "",
        language: payload.language,
        stdin: payload.stdin || "",
        labType: payload.labType,
        sessionId: session.sessionId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${errorText || "Container error"}`);
    }

    const data = await response.json();

    return {
      success: data.success !== false,
      status: data.success !== false ? "COMPLETED" : "FAILED",
      runId,
      output: data.output || "",
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
