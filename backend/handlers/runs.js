import { ok } from "../lib/apigw.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { getSession } from "../services/sessionRepository.js";
import { createRun, getRun, completeRun } from "../services/runRepository.js";
import { getFile } from "../services/fileRepository.js";
import { readFromContainer } from "../services/containerClient.js";
import { resolveLabType } from "../lib/labTypeMapper.js";
import { validateFile } from "../utils/validation.js";
import fs from "fs";
import path from "path";

// Modular Production Pipeline Imports
import { SessionManager } from "../execution/SessionManager.js";
import { FileSync } from "../execution/FileSync.js";
import { RuntimeResolver } from "../runtime/RuntimeResolver.js";
import { BrowserManager } from "../execution/BrowserManager.js";
import { LogStreamer } from "../execution/LogStreamer.js";
import { ExecuteCommand } from "../execution/ExecuteCommand.js";

export const runsCreateHandler = async ({ body, auth }) => {
  const sessionId = body?.sessionId || body?.session_id;
  const filePath = body?.path || body?.filePath;
  const language = body?.language;
  const content = body?.content || body?.code;
  const executionMode = body?.executionMode === "headless" ? "headless" : "gui";

  if (!sessionId) throw badRequest("sessionId is required");

  // 1. Session & Container Validation
  const session = await SessionManager.validateSession(sessionId, auth);

  // 2. Resolve Lab Runtime
  const labType = resolveLabType({
    labId: session.labId,
    language,
    labType: body?.labType,
  });
  
  // Resolve runtime config from resolvers
  const runtimeConfig = RuntimeResolver.resolve(labType, language);

  let code = content || "";
  if (!code && filePath) {
    if (session.status === "running") {
      try {
        code = await readFromContainer(session, filePath);
      } catch (err) {
        console.warn(`[runsCreateHandler] Failed to read from container: ${err.message}`);
      }
    }
    if (!code) {
      const cleanPath = filePath.replace(/^\/workspace\//, "").replace(/^\/+/, "");
      const localPath = path.join(path.resolve(process.cwd(), ".."), cleanPath);
      if (fs.existsSync(localPath)) {
        try {
          code = fs.readFileSync(localPath, "utf-8");
        } catch (err) {
          console.warn(`[runsCreateHandler] Failed to read local file: ${err.message}`);
        }
      }
    }
  }

  // Fallback to DB file content if not found anywhere
  if (!code && filePath) {
    const file = await getFile(sessionId, filePath);
    if (file) code = file.content;
  }

  const isAndroid = labType === "android" || session.labId === "android" || session.labId === "mobile-app-lab";
  if (!code && !isAndroid) throw badRequest("content or saved file path is required");

  // Enforce runtime-specific validation before running
  if (filePath && !isAndroid) {
    const validation = validateFile(filePath, code, labType, { isRun: true });
    if (!validation.valid) {
      return ok({
        runId: `run_err_${Date.now()}`,
        status: "FAILED",
        output: "",
        error: validation.error,
        syntaxError: validation.error,
        runtimeError: validation.error,
        success: false,
      });
    }
  }

  // 3. File Synchronization
  if (filePath && code) {
    await FileSync.syncFile(session, filePath, code);
  }

  // 4. Create database run record
  const run = await createRun({ sessionId, labType });

  let payload = {
    path: filePath,
    language,
    content: code,
    labType,
    action: body?.action,
    stdin: body?.stdin,
    executionMode,
  };

  // Process wrapper transformation for Hadoop (if required)
  if (labType === "big-data" && language === "java") {
    const classNameMatch = code.match(/public\s+class\s+([a-zA-Z0-9_]+)/);
    const className = classNameMatch ? classNameMatch[1] : "Main";
    const b64Code = Buffer.from(code).toString('base64');
    const wrapperContent = `
import os
import base64
import subprocess
import glob

try:
    code = base64.b64decode("${b64Code}").decode('utf-8')
    with open('/workspace/${className}.java', 'w') as f:
        f.write(code)

    print("----- COMPILING JAVA -----")
    os.environ['HADOOP_CLASSPATH'] = subprocess.check_output(['hadoop', 'classpath']).decode().strip()
    subprocess.check_output(['javac', '-classpath', os.environ['HADOOP_CLASSPATH'], '-d', '.', f'/workspace/{className}.java'], stderr=subprocess.STDOUT)
    
    print("----- CREATING HADOOP JAR -----")
    subprocess.check_output(['jar', '-cvf', 'job.jar', f'{className}.class'], stderr=subprocess.STDOUT)
    for cls in glob.glob('*.class'):
        if cls != f'{className}.class':
            subprocess.check_output(['jar', '-uvf', 'job.jar', cls], stderr=subprocess.STDOUT)

    print("----- HADOOP JOB EXECUTION START -----")
    output = subprocess.check_output(['hadoop', 'jar', 'job.jar', className], stderr=subprocess.STDOUT)
    print(output.decode())
    print("----- HADOOP JOB EXECUTION COMPLETE -----")
except subprocess.CalledProcessError as e:
    if hasattr(e, 'output') and e.output:
        print(f"\\n[EXECUTION ERROR]:\\n{e.output.decode()}")
    else:
        print(f"\\n[EXECUTION ERROR]: {e}")
except Exception as e:
    print(f"\\n[ERROR]: {str(e)}")
`;
    payload = {
      path: "/workspace/.hadoop_wrapper.py",
      language: "python",
      content: wrapperContent,
      labType: "big-data"
    };
  }

  // 5. Execution Coordination
  if (labType === "testing") {
    // Execute inside container asynchronously
    (async () => {
      try {
        const result = await ExecuteCommand.execute(session, run.runId, payload);
        await completeRun(run.runId, result);
      } catch (err) {
        console.error("[runsCreateHandler] Async execution failed:", err);
      } finally {
        LogStreamer.completeRunLogs(run.runId);
      }
    })();

    // Resolve VNC browser URL and SSE logs endpoint
    const browserUrl = BrowserManager.getBrowserUrl(session);
    return ok({
      success: true,
      runId: run.runId,
      sessionId,
      executionMode,
      viewerUrl: executionMode === "gui" ? browserUrl : null,
      browser: {
        url: browserUrl,
        connected: true,
        title: "Ignito VLab Dashboard"
      },
      logs: {
        streamUrl: `/api/runs/${run.runId}/logs`
      }
    });
  }

  // Non-Selenium execution (Java, Python, .NET, Linux, Hadoop, etc.)
  let result;
  try {
    result = await ExecuteCommand.execute(session, run.runId, payload);
  } catch (err) {
    result = {
      success: false,
      output: "",
      error: err.message || "Execution failed",
      syntaxError: "",
      runtimeError: err.message || "Execution failed",
    };
  }

  await completeRun(run.runId, result);
  LogStreamer.completeRunLogs(run.runId);

  return ok({
    runId: run.runId,
    status: result.success ? "COMPLETED" : "FAILED",
    output: result.output,
    error: result.error,
    syntaxError: result.syntaxError || "",
    runtimeError: result.runtimeError || "",
    success: result.success,
  });
};

export const runsGetHandler = async ({ pathParameters, auth }) => {
  const runId = pathParameters?.runId;
  const run = await getRun(runId);
  if (!run) throw notFound("Run not found");

  const session = await getSession(run.sessionId);
  if (
    session &&
    String(session.userId) !== String(auth.userId) &&
    auth.role !== "Super Admin"
  ) {
    throw forbidden("You do not own this run");
  }

  return ok({
    runId: run.runId,
    sessionId: run.sessionId,
    status: run.status,
    success: run.success,
    output: run.output || "",
    error: run.error || run.runtimeError || "",
    syntaxError: run.syntaxError || "",
    runtimeError: run.runtimeError || "",
  });
};

/** Legacy frontend alias: POST /run */
export const runLegacyHandler = async (parsed) => {
  const sessionId =
    parsed.headers?.["x-session-id"] || parsed.queryStringParameters?.sessionId;
  return runsCreateHandler({
    ...parsed,
    body: {
      ...(parsed.body || {}),
      sessionId,
      path: parsed.body?.path,
      language: parsed.body?.language,
      content: parsed.body?.content,
      stdin: parsed.body?.stdin,
    },
  });
};
