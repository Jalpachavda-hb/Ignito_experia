import { executeCode } from "../services/ExecutionService.js";
import { executeViaSsm, cleanDotnetOutput } from "../services/executeCommandService.js";
import { LogStreamer } from "./LogStreamer.js";
import { getContainerHost, isDirectContainerMode } from "../lib/labTools.js";
import { BrowserManager } from "./BrowserManager.js";
import net from "net";

const checkPort = (host, port, timeout = 1500) => {
  if (!host) return Promise.resolve(false);
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeout);
    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
  });
};

// Remember sessions whose direct HTTP agent is unreachable so subsequent runs go straight
// to SSM instead of paying the failed-HTTP (or 1.5s port probe) penalty on every click.
const HTTP_UNREACHABLE_TTL_MS = Number(process.env.HTTP_UNREACHABLE_TTL_MS || 5 * 60 * 1000);
const httpUnreachable = new Map(); // sessionId -> markedAt

const isHttpKnownUnreachable = (sessionId) => {
  const at = httpUnreachable.get(sessionId);
  if (!at) return false;
  if (Date.now() - at > HTTP_UNREACHABLE_TTL_MS) {
    httpUnreachable.delete(sessionId);
    return false;
  }
  return true;
};
const markHttpUnreachable = (sessionId, reason) => {
  console.warn(`[ExecuteCommand] HTTP agent unreachable for ${sessionId} (${reason}); using SSM for next ${Math.round(HTTP_UNREACHABLE_TTL_MS / 1000)}s`);
  httpUnreachable.set(sessionId, Date.now());
};

export class ExecuteCommand {
  static async execute(session, runId, payload) {
    const host = getContainerHost(session);
    // Real Container Mode if taskArn is defined (local development can connect to ECS container)
    // Mock Mode is only for local standalone testing if no container task exists
    const isLocalMock = !session.taskArn || process.env.FORCE_MOCK_EXECUTION === "true";

    if (isLocalMock) {
      LogStreamer.sendRunLog(runId, "Starting Selenium Environment...", "status");
      await new Promise(r => setTimeout(r, 600));

      LogStreamer.sendRunLog(runId, "Launching Chrome...", "status");
      await new Promise(r => setTimeout(r, 600));

      LogStreamer.sendRunLog(runId, "Connecting to browser...", "status");
      await new Promise(r => setTimeout(r, 600));

      LogStreamer.sendRunLog(runId, "🟢 Browser Connected", "status");

      // Extract target URL from payload content if possible to print in mock log
      let targetUrl = "https://example.com/login";
      if (payload.content) {
        const urlMatch = payload.content.match(/driver\.(?:get|navigate\(\)\.to)\s*\(\s*['"](https?:\/\/[^'"]+)['"]\s*\)/i);
        if (urlMatch) {
          targetUrl = urlMatch[1];
        }
      }

      const simulatedSteps = [
        { msg: "> webdriver.Chrome() initialized successfully.", delay: 800 },
        { msg: `> Opening target URL: ${targetUrl}`, delay: 1200 },
        { msg: "> Finding element by CSS: input[name='username']", delay: 800 },
        { msg: "> Typing username: 'student_user'...", delay: 600 },
        { msg: "> Finding element by CSS: input[name='password']", delay: 800 },
        { msg: "> Typing password: '••••••••'...", delay: 600 },
        { msg: "> Finding element by XPath: //button[@type='submit']", delay: 800 },
        { msg: "> Clicking login button...", delay: 1000 },
        { msg: "> Asserting dashboard page header is visible...", delay: 1000 },
        { msg: "> Assertion matches: 'Welcome, student_user!'", delay: 500 },
        { msg: "> Test execution finished.", delay: 400 },
      ];

      let output = "";
      for (const step of simulatedSteps) {
        LogStreamer.sendRunLog(runId, step.msg, "stdout");
        output += step.msg + "\n";
        await new Promise(r => setTimeout(r, step.delay));
      }

      const code = payload.content || "";
      if (code.includes("assert False") || code.includes("fail()") || code.includes("error") || code.includes("incorrect")) {
        LogStreamer.sendRunLog(runId, "❌ Assertion Error: Expected 'Welcome, student_user!' but got 'Invalid Credentials'", "stderr");
        LogStreamer.sendRunLog(runId, "🔴 Test Failed", "status");
        return { success: false, output: output + "AssertionError: Expected 'Welcome, student_user!' but got 'Invalid Credentials'\n", error: "AssertionError" };
      } else {
        LogStreamer.sendRunLog(runId, "🟢 Test Passed", "status");
        return { success: true, output, error: null };
      }
    }

    // Real ECS Container Execution Pipeline
    let finalPayload = payload;
    const isTesting = payload.labType === "testing";
    const executionMode = payload.executionMode || "gui";

    if (isTesting) {
      finalPayload = { ...payload };
      let code = finalPayload.content || "";

      console.log(`[ExecuteCommand] Original code:`, code);

      // 1. Robust environment-aware ChromeDriver path replacement (matches any setProperty path value)
      code = code.replace(
        /System\.setProperty\(\s*(['"])webdriver\.chrome\.driver\1\s*,\s*(['"])[^'"]+\2\s*\)/g,
        'System.setProperty("webdriver.chrome.driver", System.getenv("CHROMEDRIVER_PATH") != null ? System.getenv("CHROMEDRIVER_PATH") : "/usr/bin/chromedriver")'
      );

      // 2. Automatically maximize the Chrome window to fill the RDP display
      code = code.replace(
        /([a-zA-Z0-9_]+)\s*=\s*new\s+ChromeDriver\(([^)]*)\)/g,
        '$1 = new ChromeDriver($2);\n            $1.manage().window().maximize()'
      );

      // 3. Headless & Container compatibility options injection
      const match = code.match(/\bChromeOptions\s+([a-zA-Z0-9_]+)\s*=\s*new\s+ChromeOptions\(\)/);
      if (match) {
        const varName = match[1];
        
        // Inject required Docker sandbox settings
        if (!code.includes("--no-sandbox")) {
          const target = match[0];
          code = code.replace(target, `${target};\n            ${varName}.addArguments("--no-sandbox")`);
        }
        if (!code.includes("--disable-dev-shm-usage")) {
          const target = match[0];
          code = code.replace(target, `${target};\n            ${varName}.addArguments("--disable-dev-shm-usage")`);
        }

        // Inject Headless Mode argument if requested
        if (executionMode === "headless") {
          const target = match[0];
          code = code.replace(target, `${target};\n            ${varName}.addArguments("--headless=new")`);
        }
      }

      console.log(`[ExecuteCommand] Transformed code:`, code);
      finalPayload.content = code;
    }

    if (isTesting) {
      if (executionMode === "gui") {
        LogStreamer.sendRunLog(runId, "Execution Mode : GUI", "stdout");
        LogStreamer.sendRunLog(runId, "Display         : :99", "stdout");
        LogStreamer.sendRunLog(runId, "Viewer          : open the Browser desktop panel", "stdout");
        LogStreamer.sendRunLog(runId, "Launching Chrome...", "stdout");
      } else {
        LogStreamer.sendRunLog(runId, "Execution Mode : Headless", "stdout");
        LogStreamer.sendRunLog(runId, "Launching Chrome", "stdout");
        LogStreamer.sendRunLog(runId, "Running without GUI", "stdout");
      }
    } else {
      LogStreamer.sendRunLog(runId, "Connecting to container...", "status");
    }

    try {
      LogStreamer.sendRunLog(runId, `> Initiating execution on container: ${payload.path}...`, "stdout");
      
      const { FileSync } = await import("./FileSync.js");

      if (isTesting) {
        // Write modified code temporarily for compilation and run
        await FileSync.syncFile(session, finalPayload.path, finalPayload.content);
      }

      let result;
      const port = session.containerPort || 8080;
      const t0 = Date.now();
      let via = "http";

      const runSsm = async (reason) => {
        via = "ssm";
        console.log(`[ExecuteCommand] Using SSM for ${session.sessionId}: ${reason}`);
        return executeViaSsm(session, finalPayload);
      };

      if (isHttpKnownUnreachable(session.sessionId)) {
        // Already proved unreachable recently: skip the probe and go straight to SSM.
        result = await runSsm("HTTP agent marked unreachable (cached)");
      } else if (!(await checkPort(host, port, isDirectContainerMode() ? 1000 : 1500))) {
        // Fast TCP probe (≤1–1.5s) instead of letting fetch hang on an unreachable private IP.
        markHttpUnreachable(session.sessionId, `port ${host}:${port} closed`);
        result = await runSsm("port probe failed");
      } else {
        try {
          console.log(`[ExecuteCommand] Direct HTTP: http://${host}:${port}`);
          result = await executeCode(session, finalPayload, { runId });
          if (!result.success && (result.error === "Container unreachable" || result.error === "Runtime initialization failed")) {
            throw new Error(result.error);
          }
        } catch (directErr) {
          markHttpUnreachable(session.sessionId, directErr.message);
          result = await runSsm(`HTTP execution failed: ${directErr.message}`);
        }
      }

      console.log(`[ExecuteCommand] [TIMING] Session: ${session.sessionId} | via=${via} | ${Date.now() - t0}ms`);

      if (result.output && !result.plotHtml && result.output.includes("<!-- VLAB_PLOT_START -->")) {
        const plotMatch = result.output.match(/<!-- VLAB_PLOT_START -->([\s\S]*?)<!-- VLAB_PLOT_END -->/);
        if (plotMatch) {
          result.plotHtml = plotMatch[1].trim();
          result.output = result.output.replace(/<!-- VLAB_PLOT_START -->[\s\S]*?<!-- VLAB_PLOT_END -->/g, "").replace(/^\n+/, "").trimEnd();
        }
      }

      if (result.output) {
        result.output = cleanDotnetOutput(result.output);
        const lines = result.output.split("\n");
        for (const line of lines) {
          if (line.trim()) {
            LogStreamer.sendRunLog(runId, line, "stdout");
          }
        }
      }

      if (result.error) {
        result.error = cleanDotnetOutput(result.error);
        if (result.error) {
          LogStreamer.sendRunLog(runId, result.error, "stderr");
        }
      }

      if (result.success !== false) {
        if (isTesting && executionMode === "headless") {
          LogStreamer.sendRunLog(runId, "Execution completed successfully", "stdout");
        }
        LogStreamer.sendRunLog(runId, "🟢 Test Completed Successfully", "status");
      } else {
        LogStreamer.sendRunLog(runId, "🔴 Test Failed", "status");
      }

      return result;
    } catch (err) {
      LogStreamer.sendRunLog(runId, `Execution error: ${err.message}`, "stderr");
      LogStreamer.sendRunLog(runId, "🔴 Test Failed", "status");
      return { success: false, error: err.message, output: "" };
    } finally {
      if (isTesting) {
        try {
          const { FileSync } = await import("./FileSync.js");
          // Restore original student code
          await FileSync.syncFile(session, payload.path, payload.content);
        } catch (restoreErr) {
          console.error("[ExecuteCommand] Failed to restore original code file:", restoreErr.message);
        }
      }
    }
  }
}
