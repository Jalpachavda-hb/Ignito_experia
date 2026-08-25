import { executeCode } from "../services/ExecutionService.js";
import { executeViaSsm } from "../services/executeCommandService.js";
import { LogStreamer } from "./LogStreamer.js";
import { getContainerHost } from "../lib/labTools.js";
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
        const viewerUrl = BrowserManager.getBrowserUrl(session);
        LogStreamer.sendRunLog(runId, "Execution Mode : GUI", "stdout");
        LogStreamer.sendRunLog(runId, "Display         : :99", "stdout");
        LogStreamer.sendRunLog(runId, `Viewer          : ${viewerUrl}`, "stdout");
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
      const isReachable = await checkPort(host, port, 1500);

      if (isReachable) {
        try {
          result = await executeCode(session, finalPayload, { runId });
          if (!result.success && result.error === "Container unreachable") {
            throw new Error("Container unreachable");
          }
        } catch (err) {
          LogStreamer.sendRunLog(runId, `⚠️ Private HTTP agent port unreachable. Executing script via AWS SSM fallback...`, "stdout");
          result = await executeViaSsm(session, finalPayload);
        }
      } else {
        LogStreamer.sendRunLog(runId, `⚠️ Private HTTP agent port unreachable. Executing script via AWS SSM fallback...`, "stdout");
        result = await executeViaSsm(session, finalPayload);
      }

      if (result.output) {
        const lines = result.output.split("\n");
        for (const line of lines) {
          LogStreamer.sendRunLog(runId, line, "stdout");
        }
      }

      if (result.error) {
        LogStreamer.sendRunLog(runId, result.error, "stderr");
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
