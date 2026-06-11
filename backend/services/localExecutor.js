import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const runPython = (content) =>
  new Promise((resolve) => {
    const tempFile = path.join(os.tmpdir(), `vlab_${Date.now()}.py`);
    fs.writeFileSync(tempFile, content);
    const commands =
      process.platform === "win32"
        ? ["python", "py", "python3"]
        : ["python3", "python"];

    const tryExecute = (index) => {
      if (index >= commands.length) {
        try {
          fs.unlinkSync(tempFile);
        } catch {}
        return resolve({
          success: true,
          output: "",
          error: "Python not found. Install Python and add it to PATH.",
        });
      }

      exec(`${commands[index]} "${tempFile}"`, { timeout: 30000 }, (error, stdout, stderr) => {
        if (
          error &&
          (error.message.includes("not recognized") ||
            error.message.includes("not found") ||
            error.code === 127 ||
            error.code === "ENOENT")
        ) {
          return tryExecute(index + 1);
        }

        try {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        } catch {}

        resolve({
          success: true,
          output: stdout,
          error: stderr || (error ? (error.killed ? "Execution timed out (30s)" : error.message) : null),
        });
      });
    };

    tryExecute(0);
  });

const runJava = (content) =>
  new Promise((resolve) => {
    const classMatch = content.match(/public\s+class\s+([a-zA-Z0-9_]+)/);
    const className = classMatch ? classMatch[1] : "Main";
    const tempDir = path.join(os.tmpdir(), `vlab_java_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    const javaFile = path.join(tempDir, `${className}.java`);
    fs.writeFileSync(javaFile, content);

    exec(
      `javac "${javaFile}" && java -cp "${tempDir}" ${className}`,
      { timeout: 60000 },
      (error, stdout, stderr) => {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {}

        resolve({
          success: true,
          output: stdout,
          error: stderr || (error ? (error.killed ? "Execution timed out (60s)" : error.message) : null),
        });
      },
    );
  });

const runJavascript = (content) =>
  new Promise((resolve) => {
    const tempFile = path.join(os.tmpdir(), `vlab_${Date.now()}.js`);
    
    // Inject mock browser globals so that scripts using window/navigator/document do not crash in Node.js
    const browserMocks = `
// --- Mock Browser Globals for Agile Lab ---
if (typeof global !== 'undefined') {
  if (!global.window) {
    global.window = {
      location: {
        href: "http://localhost:8080/vlab/agile-lab",
        hostname: "localhost",
        protocol: "http:",
        pathname: "/vlab/agile-lab",
        port: "8080"
      }
    };
  }
  if (!global.navigator) {
    global.navigator = {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
  }
  if (!global.document) {
    global.document = {
      body: {},
      createElement: () => ({ style: {} }),
      getElementById: () => null
    };
  }
}
// ------------------------------------------\n\n`;

    fs.writeFileSync(tempFile, browserMocks + content);
    exec(`node "${tempFile}"`, { timeout: 15000 }, (error, stdout, stderr) => {
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch {}
      resolve({
        success: true,
        output: stdout,
        error: stderr || (error ? (error.killed ? "Execution timed out (15s)" : error.message) : null),
      });
    });
  });

const runHtml = (content) =>
  Promise.resolve({
    success: true,
    output: "HTML Execution completed successfully. See the Live Preview tab to interact with your webpage.",
    error: null,
  });

const runIpynb = (content) => {
  try {
    const notebook = JSON.parse(content);
    let pythonCode = "";
    if (notebook && Array.isArray(notebook.cells)) {
      notebook.cells.forEach(cell => {
        if (cell.cell_type === "code" && Array.isArray(cell.source)) {
          pythonCode += cell.source.join("") + "\n";
        }
      });
    }
    return runPython(pythonCode || "print('Empty Notebook')");
  } catch (err) {
    return Promise.resolve({
      success: true,
      output: "",
      error: `Failed to parse Notebook: ${err.message}`,
    });
  }
};

export const executeLocally = async ({ language, content, path: filePath }) => {
  const ext = filePath?.split('.').pop().toLowerCase() || language;
  
  if (ext === "py" || ext === "python") return runPython(content);
  if (ext === "java") return runJava(content);
  if (ext === "js" || ext === "javascript" || ext === "jsx") return runJavascript(content);
  if (ext === "html") return runHtml(content);
  if (ext === "ipynb") return runIpynb(content);

  if (["md", "css", "json", "txt", "doc", "docx", "pdf", "csv"].includes(ext)) {
    return {
      success: true,
      output: `[File Viewer] Content:\n${content}`,
      error: null,
    };
  }

  return {
    success: true,
    output: `[System] Language "${language}" is not supported in local fallback mode.`,
    error: null,
  };
};
