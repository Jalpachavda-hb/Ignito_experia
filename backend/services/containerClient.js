import fs from "fs";
import path from "path";
import { getSessionApiBaseUrl } from "../lib/labTools.js";
import { resolveLabType } from "../lib/labTypeMapper.js";
import { ENV } from "../config/env.js";
import { exec } from "child_process";
import util from "util";
import os from "os";
import { describeTask } from "./ecsService.js";
const execAsync = util.promisify(exec);
const nullDev = os.platform() === "win32" ? "NUL" : "/dev/null";

const activeS3Bootstraps = new Set();

const CONTAINER_TIMEOUT_MS = 35000;
const DOTNET_BUILD_TIMEOUT_SEC = 300;
const DOTNET_BUILD_SSM_TIMEOUT_MS = DOTNET_BUILD_TIMEOUT_SEC * 1000 + 60000;
const DOTNET_RUN_SSM_TIMEOUT_MS = 240000;
const DOTNET_MVC_RUN_PORT = 5050;

const isDotnetSession = (session) => {
  const labId = (session?.labId || "").toLowerCase();
  const labType = (session?.labType || "").toLowerCase();
  return labId.includes("dotnet") || labType === "dotnet";
};

const DOTNET_ALLOWED_FILE_NAMES = new Set([
  "program.cs",
  "homecontroller.cs",
  "apicontroller.cs",
  "appsettings.json",
  "appsettings.development.json",
]);

const DOTNET_BUILD_ARTIFACT_EXTENSIONS = [
  ".dll",
  ".pdb",
  ".exe",
  ".deps.json",
  ".runtimeconfig.json",
  ".nuget.cache",
  ".assets.json",
];

const isDotnetBuildArtifact = (filePath, fileName) => {
  const normalized = (filePath || "").replace(/^\/workspace\//, "").replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const name = (fileName || parts[parts.length - 1] || "").toLowerCase();

  if (parts.some((part) => part.toLowerCase() === "bin" || part.toLowerCase() === "obj")) {
    return true;
  }
  return DOTNET_BUILD_ARTIFACT_EXTENSIONS.some((ext) => name.endsWith(ext));
};

const DOTNET_ALLOWED_CSHARP_VIEW = "index.cshtml";

const isDotnetAllowedCshtml = (fileName) =>
  (fileName || "").toLowerCase() === DOTNET_ALLOWED_CSHARP_VIEW;

const isDotnetWorkspaceFileAllowed = (filePath, fileName) => {
  if (isDotnetBuildArtifact(filePath, fileName)) {
    return false;
  }
  const normalized = (filePath || "").replace(/^\/workspace\//, "").replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const name = (fileName || parts[parts.length - 1] || "").toLowerCase();

  if (name.endsWith(".csproj")) return true;
  if (name.endsWith(".cshtml")) return isDotnetAllowedCshtml(name);
  if (DOTNET_ALLOWED_FILE_NAMES.has(name)) return true;
  return false;
};

const filterDotnetWorkspaceFiles = (files) =>
  (files || []).filter((file) => isDotnetWorkspaceFileAllowed(file.path, file.name));

const DOTNET_LIST_FILES_SCRIPT = `import os
import json
import shutil

workspace = "/tmp/workspace/workspace"

ALLOWED_NAMES = {
    "program.cs",
    "homecontroller.cs",
    "apicontroller.cs",
    "appsettings.json",
    "appsettings.development.json",
}

BUILD_ARTIFACT_EXTS = (
    ".dll", ".pdb", ".exe", ".deps.json", ".runtimeconfig.json",
    ".nuget.cache", ".assets.json",
)

def is_build_artifact(rel_path):
    rel = rel_path.replace("\\\\", "/")
    parts = [p.lower() for p in rel.split("/") if p]
    if "bin" in parts or "obj" in parts:
        return True
    name = parts[-1] if parts else ""
    return any(name.endswith(ext) for ext in BUILD_ARTIFACT_EXTS)

def is_allowed(rel_path):
    if is_build_artifact(rel_path):
        return False
    rel = rel_path.replace("\\\\", "/")
    parts = [p for p in rel.split("/") if p]
    if not parts:
        return False
    name = parts[-1].lower()
    rel_lower = rel.lower()
    if name.endswith(".csproj"):
        return True
    if name.endswith(".cshtml"):
        return name in ("index.cshtml", "_viewimports.cshtml", "_viewstart.cshtml", "_layout.cshtml")
    if "/models/" in rel_lower and name.endswith(".cs"):
        return True
    if name in ALLOWED_NAMES:
        return True
    return False

def in_bin_or_obj(rel_path):
    parts = [p.lower() for p in rel_path.replace("\\\\", "/").split("/") if p]
    return "bin" in parts or "obj" in parts

if os.path.exists("/workspace") and os.path.isdir("/workspace"):
    try:
        os.makedirs(workspace, exist_ok=True)
        if not os.listdir(workspace):
            for item in os.listdir("/workspace"):
                s = os.path.join("/workspace", item)
                d = os.path.join(workspace, item)
                if os.path.isdir(s):
                    if item not in [".git", "node_modules", ".gradle", ".idea", "__pycache__", "tmp"]:
                        shutil.copytree(s, d)
                else:
                    shutil.copy2(s, d)
    except Exception as e:
        print("COPY_ERROR: " + str(e))

if os.path.exists(workspace):
    for root, dirs, files in os.walk(workspace, topdown=False):
        rel_root = os.path.relpath(root, workspace)
        if rel_root == ".":
            rel_root = ""
        rel_root_norm = rel_root.replace("\\\\", "/")
        inside_bin_obj = in_bin_or_obj(rel_root_norm) if rel_root_norm else False

        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, workspace).replace("\\\\", "/")
            if inside_bin_obj or is_allowed(rel_path):
                continue
            try:
                os.remove(full_path)
            except Exception:
                pass

        if rel_root and not inside_bin_obj:
            try:
                if not os.listdir(root):
                    os.rmdir(root)
            except Exception:
                pass

result = []
if os.path.exists(workspace):
    for root, dirs, files in os.walk(workspace):
        dirs[:] = [
            d for d in dirs
            if d not in [".git", "node_modules", ".gradle", ".idea", "__pycache__", "tmp"]
            and d.lower() not in ("bin", "obj")
        ]
        for f in files:
            if f.endswith(".pyc") or f == ".DS_Store":
                continue
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, workspace).replace("\\\\", "/")
            if rel_path.lower().startswith("consolerun/"):
                continue
            if not is_allowed(rel_path):
                continue
            result.append({
                "name": f,
                "path": "/workspace/" + rel_path,
                "type": "file"
            })

print("---FILES_START---" + json.dumps(result) + "---FILES_END---")`;

const normalizeExecutePath = (filePath) => {
  if (!filePath) return filePath;
  return filePath.replace(/^\/tmp\/workspace\/workspace\//, "").replace(/^\/workspace\//, "").replace(/^\/+/, "");
};

const getExecuteTimeoutMs = ({ labType, language, labId }) => {
  const type = (labType || "").toLowerCase();
  const lang = (language || "").toLowerCase();
  const id = (labId || "").toLowerCase();

  if (type === "big-data" || id.includes("big-data") || id.includes("bigdata")) {
    return 120000;
  }
  if (
    type === "dotnet" ||
    type === "csharp" ||
    type === "c#" ||
    type === "cs" ||
    id.includes("dotnet") ||
    lang === "csharp" ||
    lang === "c#"
  ) {
    return 90000;
  }
  if (type === "java" || lang === "java" || id.includes("java")) {
    return 60000;
  }
  return 15000;
};

const isDotnetPayload = (session, payload) => {
  const labType = resolveLabType({
    labId: session?.labId,
    language: payload?.language,
    labType: payload?.labType,
  }).toLowerCase();
  if (["dotnet", "csharp", "c#", "cs"].includes(labType)) return true;
  const lang = (payload?.language || "").toLowerCase();
  if (["csharp", "c#", "cs"].includes(lang)) return true;
  const filePath = (payload?.path || "").toLowerCase();
  return filePath.endsWith(".cs") || filePath.endsWith(".cshtml");
};

const formatLabServerResult = (data) => ({
  success: data.success !== false,
  output: data.output || "",
  error: data.error || data.runtimeError || data.syntaxError || null,
  syntaxError: data.syntaxError || "",
  runtimeError: data.runtimeError || "",
});

const parseLabServerJsonOutput = (output) => {
  const text = (output || "").trim();
  if (!text) {
    return {
      success: false,
      output: "",
      error: "Empty lab_server response",
      syntaxError: "",
      runtimeError: "Empty lab_server response",
    };
  }

  try {
    return formatLabServerResult(JSON.parse(text));
  } catch {
    // continue
  }

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      return formatLabServerResult(JSON.parse(text.substring(jsonStart, jsonEnd + 1)));
    } catch {
      // continue
    }
  }

  const buildSucceeded = /build succeeded/i.test(text);
  const hasCompileFailure =
    /build failed/i.test(text) ||
    /error cs\d+/i.test(text) ||
    /BUILD_EXIT:(?!0\b)/i.test(text);
  const connectionLost = /remote end closed connection/i.test(text);
  const buildTimedOut = /timed out after \d+ seconds/i.test(text);

  if (buildTimedOut) {
    return {
      success: false,
      output: text,
      error:
        "Build timed out. The first build downloads NuGet packages and can take several minutes — try BUILD again.",
      syntaxError: "",
      runtimeError:
        "Build timed out. The first build downloads NuGet packages and can take several minutes — try BUILD again.",
    };
  }

  if (connectionLost) {
    return {
      success: false,
      output: text,
      error: "Build timed out or the container connection closed. Wait a moment and try BUILD again.",
      syntaxError: "",
      runtimeError: "Build timed out or the container connection closed.",
    };
  }

  const pageMarker = "--- PAGE OUTPUT ---";
  const runHttpOk = /RUN_HTTP_OK/i.test(text);
  const runTimedOut = /RUN_TIMEOUT:/i.test(text);
  if (runHttpOk) {
    const pageIdx = text.indexOf(pageMarker);
    const pageHtml = pageIdx >= 0 ? text.substring(pageIdx + pageMarker.length).trim() : text;
    return {
      success: true,
      output: pageHtml,
      error: null,
      syntaxError: "",
      runtimeError: "",
    };
  }
  if (runTimedOut) {
    return {
      success: false,
      output: text,
      error: "Web app did not respond in time. Ensure HomeController and Index.cshtml exist, then try RUN again.",
      syntaxError: "",
      runtimeError: "Web app did not respond in time.",
    };
  }

  const consoleMarker = "--- PROGRAM OUTPUT ---";
  if (text.includes(consoleMarker)) {
    const outputStart = text.indexOf(consoleMarker) + consoleMarker.length;
    const outputEnd = text.indexOf("RUN_EXIT:", outputStart);
    const programOutput = (
      outputEnd >= 0 ? text.substring(outputStart, outputEnd) : text.substring(outputStart)
    ).trim();
    const exitMatch = text.match(/RUN_EXIT:(\d+)/);
    const exitCode = exitMatch ? Number.parseInt(exitMatch[1], 10) : 1;
    return {
      success: exitCode === 0,
      output: programOutput || "(No output)",
      error: exitCode === 0 ? null : "Program exited with an error",
      syntaxError: "",
      runtimeError: exitCode === 0 ? "" : programOutput || "Program exited with an error",
    };
  }

  if (buildSucceeded && !hasCompileFailure) {
    return {
      success: true,
      output: text,
      error: null,
      syntaxError: "",
      runtimeError: "",
    };
  }

  return {
    success: false,
    output: text,
    error: hasCompileFailure ? "Build failed" : "Execution failed",
    syntaxError: "",
    runtimeError: hasCompileFailure ? "Build failed" : "Execution failed",
  };
};

const isPrivateHost = (host) =>
  Boolean(host && /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(host));

const shouldPreferSsmExecution = (host, ctx) =>
  Boolean(
    ctx &&
    (ENV.containerHostMode === "private" || isPrivateHost(host) || !host),
  );

const isDotnetMvcCode = (content = "") => {
  const code = String(content || "");
  return (
    code.includes("WebApplication.CreateBuilder") ||
    code.includes("AddControllersWithViews") ||
    code.includes("MapControllerRoute") ||
    code.includes("MapControllers")
  );
};

const isDotnetConsoleProgram = (filePath, content = "") => {
  const normalized = normalizeExecutePath(filePath) || "Program.cs";
  const name = normalized.split("/").pop()?.toLowerCase() || "";
  if (name !== "program.cs") return false;
  return !isDotnetMvcCode(content);
};

const resolveDotnetExecutePath = (filePath, content = "") => {
  const normalized = normalizeExecutePath(filePath) || "Program.cs";
  const code = String(content || "");
  const name = normalized.split("/").pop() || normalized;
  const lowerName = name.toLowerCase();

  if (lowerName === "program.cs") {
    return isDotnetMvcCode(code) ? "MyWebApp/Program.cs" : "Program.cs";
  }

  if (normalized.startsWith("MyWebApp/")) return normalized;

  if (lowerName.endsWith(".cshtml") || lowerName.endsWith(".html")) {
    if (lowerName === "index.cshtml" || lowerName === "index.html") {
      return "MyWebApp/Views/Home/Index.cshtml";
    }
    const viewName = name.replace(/\.(cshtml|html)$/i, ".cshtml");
    return `MyWebApp/Views/Home/${viewName}`;
  }

  if (lowerName.endsWith(".cs")) {
    if (
      lowerName === "homecontroller.cs" ||
      code.includes(": Controller") ||
      code.includes("Microsoft.AspNetCore.Mvc")
    ) {
      return "MyWebApp/Controllers/HomeController.cs";
    }
    if (code.includes("DbContext")) {
      return `MyWebApp/Data/${name}`;
    }
    if (code.includes("Microsoft.AspNetCore") || code.includes("AspNetCore")) {
      return `MyWebApp/Models/${name}`;
    }
  }

  return normalized;
};

const isDotnetBuildRequest = (filePath, content = "", action) => {
  if (action === "run") return false;
  if (action === "build") return true;
  if (isDotnetConsoleProgram(filePath, content)) return false;

  const normalized = normalizeExecutePath(filePath) || "";
  const lower = normalized.toLowerCase();
  if (lower.endsWith(".cshtml") || lower.endsWith(".html")) return true;
  if (lower.includes("controller")) return true;
  if (lower.endsWith("program.cs") && isDotnetMvcCode(content)) return true;
  return normalized.startsWith("MyWebApp/") && !lower.endsWith("program.cs");
};

const isDotnetMvcProject = (filePath, content = "") => {
  if (isDotnetConsoleProgram(filePath, content)) return false;
  return isDotnetBuildRequest(filePath, content, "build");
};

const resolveDotnetSsmAction = (payload) => {
  const action = (payload?.action || "").toLowerCase();
  if (action === "build" || action === "run") return action;
  return isDotnetBuildRequest(payload?.path, payload?.content) ? "build" : "run";
};

const writeFileViaSsm = async (session, workspacePath, content) => {
  const containerPath = getContainerFilePath(workspacePath);
  const safeContent = content !== undefined && content !== null ? String(content) : "";
  const b64 = Buffer.from(safeContent).toString("base64");
  const safePath = containerPath.replace(/'/g, "\\'");
  const pythonScript = `import base64
import os

path = '${safePath}'
content_b64 = '${b64}'

try:
    dir_name = os.path.dirname(path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    with open(path, 'wb') as f:
        f.write(base64.b64decode(content_b64))
    print('SUCCESS')
except Exception as e:
    print('ERROR: ' + str(e))
`;
  const scriptB64 = Buffer.from(pythonScript).toString("base64");
  const commandValue = `sh -c 'echo ${scriptB64} | base64 -d | python3 2>&1'`;
  const output = await runSsmShellCommand(session, commandValue);
  if (!output.includes("SUCCESS")) {
    throw new Error(output || "Failed to write file to container workspace");
  }
};

const executeDotnetBuildViaSsm = async (session, payload) => {
  const executePath = resolveDotnetExecutePath(payload.path, payload.content);
  const workspacePath = executePath.startsWith("/workspace/")
    ? executePath
    : `/workspace/${executePath}`;
  const containerPath = getContainerFilePath(workspacePath);
  const projectDir = executePath.includes("MyWebApp")
    ? "/tmp/workspace/workspace/MyWebApp"
    : "/tmp/workspace/workspace";

  const safeContent =
    payload.content !== undefined && payload.content !== null ? String(payload.content) : "";
  const contentB64 = Buffer.from(safeContent).toString("base64");
  const errorViewModelB64 = Buffer.from(DOTNET_ERROR_VIEW_MODEL).toString("base64");
  const safePath = containerPath.replace(/'/g, "\\'");
  const safeProjectDir = projectDir.replace(/'/g, "\\'");

  const pyScript = `import base64
import os
import subprocess

path = '${safePath}'
project_dir = '${safeProjectDir}'
content_b64 = '${contentB64}'
error_vm_b64 = '${errorViewModelB64}'
build_timeout = ${DOTNET_BUILD_TIMEOUT_SEC}

env = os.environ.copy()
env['DOTNET_CLI_TELEMETRY_OPTOUT'] = '1'
env['DOTNET_SKIP_FIRST_TIME_EXPERIENCE'] = '1'
env['NUGET_XMLDOC_MODE'] = 'skip'

def run_step(label, cmd, timeout):
    print('STEP: ' + label)
    result = subprocess.run(
        cmd,
        cwd=project_dir,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
    )
    out = (result.stdout or '') + (result.stderr or '')
    if out.strip():
        print(out)
    return result.returncode

try:
    if content_b64:
        dir_name = os.path.dirname(path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        with open(path, 'wb') as f:
            f.write(base64.b64decode(content_b64))

    if project_dir.endswith('MyWebApp'):
        models_dir = os.path.join(project_dir, 'Models')
        error_vm_path = os.path.join(models_dir, 'ErrorViewModel.cs')
        if not os.path.isfile(error_vm_path):
            os.makedirs(models_dir, exist_ok=True)
            with open(error_vm_path, 'wb') as f:
                f.write(base64.b64decode(error_vm_b64))

    assets = os.path.join(project_dir, 'obj', 'project.assets.json')
    if os.path.isfile(assets):
        code = run_step('dotnet build', ['dotnet', 'build', '--no-restore', '--verbosity', 'minimal'], build_timeout)
    else:
        restore_timeout = max(180, build_timeout - 60)
        code = run_step('dotnet restore', ['dotnet', 'restore', '--verbosity', 'minimal'], restore_timeout)
        if code == 0:
            code = run_step('dotnet build', ['dotnet', 'build', '--no-restore', '--verbosity', 'minimal'], 120)
        else:
            print('BUILD_EXIT:' + str(code))

    if code != 0:
        print('BUILD_EXIT:' + str(code))
except subprocess.TimeoutExpired:
    print('ERROR: dotnet build timed out after ' + str(build_timeout) + ' seconds')
except Exception as e:
    print('ERROR: ' + str(e))
`;
  const scriptB64 = Buffer.from(pyScript).toString("base64");
  const commandValue = `sh -c 'echo ${scriptB64} | base64 -d | python3 2>&1'`;
  const output = await runSsmShellCommand(session, commandValue, { timeoutMs: DOTNET_BUILD_SSM_TIMEOUT_MS });
  return parseLabServerJsonOutput(stripSsmNoise(output));
};

const executeDotnetMvcRunViaSsm = async (session, payload) => {
  const executePath = resolveDotnetExecutePath(payload.path, payload.content);
  const workspacePath = executePath.startsWith("/workspace/")
    ? executePath
    : `/workspace/${executePath}`;
  const containerPath = getContainerFilePath(workspacePath);
  const projectDir = executePath.includes("MyWebApp")
    ? "/tmp/workspace/workspace/MyWebApp"
    : "/tmp/workspace/workspace";

  const safeContent =
    payload.content !== undefined && payload.content !== null ? String(payload.content) : "";
  const contentB64 = Buffer.from(safeContent).toString("base64");
  const errorViewModelB64 = Buffer.from(DOTNET_ERROR_VIEW_MODEL).toString("base64");
  const safePath = containerPath.replace(/'/g, "\\'");
  const safeProjectDir = projectDir.replace(/'/g, "\\'");

  const pyScript = `import base64
import os
import subprocess
import time
import urllib.request

path = '${safePath}'
project_dir = '${safeProjectDir}'
content_b64 = '${contentB64}'
error_vm_b64 = '${errorViewModelB64}'
run_port = ${DOTNET_MVC_RUN_PORT}
log_path = '/tmp/dotnet_mvc_run.log'
pid_path = '/tmp/dotnet_mvc_run.pid'

env = os.environ.copy()
env['DOTNET_CLI_TELEMETRY_OPTOUT'] = '1'
env['DOTNET_SKIP_FIRST_TIME_EXPERIENCE'] = '1'
env['ASPNETCORE_URLS'] = f'http://127.0.0.1:{run_port}'

def run_cmd(label, cmd, timeout=120):
    print('STEP: ' + label)
    result = subprocess.run(
        cmd,
        cwd=project_dir,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
    )
    out = (result.stdout or '') + (result.stderr or '')
    if out.strip():
        print(out)
    return result.returncode

def stop_previous_server():
    if not os.path.isfile(pid_path):
        return
    try:
        with open(pid_path, 'r', encoding='utf-8') as pid_file:
            old_pid = int(pid_file.read().strip())
        os.kill(old_pid, 9)
    except (ProcessLookupError, ValueError, PermissionError, OSError):
        pass

try:
    if content_b64:
        dir_name = os.path.dirname(path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        with open(path, 'wb') as f:
            f.write(base64.b64decode(content_b64))

    if project_dir.endswith('MyWebApp'):
        models_dir = os.path.join(project_dir, 'Models')
        error_vm_path = os.path.join(models_dir, 'ErrorViewModel.cs')
        if not os.path.isfile(error_vm_path):
            os.makedirs(models_dir, exist_ok=True)
            with open(error_vm_path, 'wb') as f:
                f.write(base64.b64decode(error_vm_b64))

    assets = os.path.join(project_dir, 'obj', 'project.assets.json')
    if os.path.isfile(assets):
        code = run_cmd('dotnet build', ['dotnet', 'build', '--no-restore', '--verbosity', 'minimal'], 180)
    else:
        code = run_cmd('dotnet restore', ['dotnet', 'restore', '--verbosity', 'minimal'], 240)
        if code == 0:
            code = run_cmd('dotnet build', ['dotnet', 'build', '--no-restore', '--verbosity', 'minimal'], 120)

    if code != 0:
        print('BUILD_EXIT:' + str(code))
    else:
        stop_previous_server()
        with open(log_path, 'wb') as log_file:
            proc = subprocess.Popen(
                ['dotnet', 'run', '--no-build', '--no-launch-profile', '--urls', f'http://127.0.0.1:{run_port}'],
                cwd=project_dir,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                env=env,
            )
        with open(pid_path, 'w', encoding='utf-8') as pid_file:
            pid_file.write(str(proc.pid))
        print('STEP: waiting for web app')
        page = ''
        for _ in range(60):
            time.sleep(1)
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{run_port}/', timeout=3) as resp:
                    page = resp.read().decode('utf-8', errors='replace')
                    if resp.status == 200 and page.strip():
                        print('RUN_HTTP_OK')
                        print('--- PAGE OUTPUT ---')
                        print(page)
                        break
            except Exception:
                pass
        else:
            print('RUN_TIMEOUT: app did not respond on port ' + str(run_port))
            try:
                with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
                    tail = f.read()[-4000:]
                    if tail.strip():
                        print(tail)
            except Exception:
                pass
except subprocess.TimeoutExpired:
    print('ERROR: dotnet run timed out')
except Exception as e:
    print('ERROR: ' + str(e))
`;
  const scriptB64 = Buffer.from(pyScript).toString("base64");
  const commandValue = `sh -c 'echo ${scriptB64} | base64 -d | python3 2>&1'`;
  const output = await runSsmShellCommand(session, commandValue, { timeoutMs: DOTNET_RUN_SSM_TIMEOUT_MS });
  return parseLabServerJsonOutput(stripSsmNoise(output));
};

const DOTNET_ERROR_VIEW_MODEL = `namespace MyWebApp.Models
{
    public class ErrorViewModel
    {
        public string RequestId { get; set; }
        public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);
    }
}
`;

const DOTNET_CONSOLE_CSPROJ = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>disable</ImplicitUsings>
    <Nullable>disable</Nullable>
  </PropertyGroup>
</Project>`;

const DOTNET_CONSOLE_PROJECT_DIR = "/tmp/workspace/workspace/ConsoleRun";

const executeDotnetConsoleRunViaSsm = async (session, payload) => {
  const projectDir = DOTNET_CONSOLE_PROJECT_DIR;
  const programPath = `${projectDir}/Program.cs`;
  const csprojPath = `${projectDir}/ConsoleApp.csproj`;

  const safeContent =
    payload.content !== undefined && payload.content !== null ? String(payload.content) : "";
  const stdinText =
    payload.stdin !== undefined && payload.stdin !== null ? String(payload.stdin) : "";
  const contentB64 = Buffer.from(safeContent).toString("base64");
  const stdinB64 = Buffer.from(stdinText).toString("base64");
  const csprojB64 = Buffer.from(DOTNET_CONSOLE_CSPROJ).toString("base64");
  const safeProgramPath = programPath.replace(/'/g, "\\'");
  const safeProjectDir = projectDir.replace(/'/g, "\\'");
  const safeCsprojPath = csprojPath.replace(/'/g, "\\'");

  const pyScript = `import base64
import os
import subprocess
import shutil

program_path = '${safeProgramPath}'
project_dir = '${safeProjectDir}'
csproj_path = '${safeCsprojPath}'
content_b64 = '${contentB64}'
stdin_b64 = '${stdinB64}'
csproj_b64 = '${csprojB64}'

env = os.environ.copy()
env['DOTNET_CLI_TELEMETRY_OPTOUT'] = '1'
env['DOTNET_SKIP_FIRST_TIME_EXPERIENCE'] = '1'

try:
    if os.path.isdir(project_dir):
        shutil.rmtree(project_dir)
    os.makedirs(project_dir, exist_ok=True)
    with open(program_path, 'wb') as f:
        f.write(base64.b64decode(content_b64))
    with open(csproj_path, 'wb') as f:
        f.write(base64.b64decode(csproj_b64))

    stdin_data = base64.b64decode(stdin_b64).decode('utf-8') if stdin_b64 else ''

    result = subprocess.run(
        ['dotnet', 'run', '--project', csproj_path, '--verbosity', 'quiet', '--nologo'],
        cwd=project_dir,
        capture_output=True,
        text=True,
        input=stdin_data,
        timeout=90,
        env=env,
    )
    combined = ((result.stdout or '') + (result.stderr or '')).strip()
    print('--- PROGRAM OUTPUT ---')
    print(combined or '(No output)')
    print('RUN_EXIT:' + str(result.returncode))
except subprocess.TimeoutExpired:
    print('--- PROGRAM OUTPUT ---')
    print('Program timed out after 90 seconds')
    print('RUN_EXIT:1')
except Exception as e:
    print('--- PROGRAM OUTPUT ---')
    print('ERROR: ' + str(e))
    print('RUN_EXIT:1')
`;
  const scriptB64 = Buffer.from(pyScript).toString("base64");
  const commandValue = `sh -c 'echo ${scriptB64} | base64 -d | python3 2>&1'`;
  const output = await runSsmShellCommand(session, commandValue, { timeoutMs: 120000 });
  return parseLabServerJsonOutput(stripSsmNoise(output));
};

const runDotnetViaSsm = async (session, payload) => {
  const action = resolveDotnetSsmAction(payload);
  if (action === "build") {
    return executeDotnetBuildViaSsm(session, payload);
  }
  if (isDotnetMvcProject(payload.path, payload.content)) {
    return executeDotnetMvcRunViaSsm(session, payload);
  }
  if (isDotnetConsoleProgram(payload.path, payload.content)) {
    return executeDotnetConsoleRunViaSsm(session, payload);
  }
  return executeDotnetViaSsmLabServer(session, payload);
};

const executeDotnetViaSsmLabServer = async (session, payload) => {
  const executePath = resolveDotnetExecutePath(payload.path, payload.content);
  const body = {
    path: executePath,
    content: payload.content || "",
    labType: "dotnet",
    sessionId: session.sessionId,
  };
  const bodyB64 = Buffer.from(JSON.stringify(body)).toString("base64");
  const token = session.sessionToken || "";
  const tokenLine = token
    ? `headers["X-Session-Token"] = ${JSON.stringify(token)}`
    : "";

  const pyScript = `import base64, json, urllib.request, urllib.error
body = json.loads(base64.b64decode(${JSON.stringify(bodyB64)}).decode())
headers = {"Content-Type": "application/json"}
${tokenLine}
req = urllib.request.Request("http://127.0.0.1:8080/execute", data=json.dumps(body).encode(), headers=headers, method="POST")
try:
    with urllib.request.urlopen(req, timeout=90) as resp:
        print(resp.read().decode())
except urllib.error.HTTPError as e:
    print(e.read().decode())
except Exception as e:
    print(json.dumps({"success": False, "output": "", "error": str(e)}))
`;
  const scriptB64 = Buffer.from(pyScript).toString("base64");
  const commandValue = `sh -c 'echo ${scriptB64} | base64 -d | python3 2>&1'`;
  const output = await runSsmShellCommand(session, commandValue);
  return parseLabServerJsonOutput(output);
};

const containerFetch = async (url, options = {}) => {
  const timeout = options.timeout || CONTAINER_TIMEOUT_MS;
  const { timeout: _, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const getContainerFilePath = (filePath) => {
  if (!filePath) return "";
  if (filePath.startsWith("/tmp/workspace/workspace/")) {
    return filePath;
  }
  if (filePath.startsWith("/workspace/")) {
    return filePath.replace("/workspace/", "/tmp/workspace/workspace/");
  }
  if (filePath === "/workspace") {
    return "/tmp/workspace/workspace";
  }
  const cleanPath = filePath.replace(/^\/+/, "");
  return `/tmp/workspace/workspace/${cleanPath}`;
};

const buildHeaders = (session) => {
  const headers = { "Content-Type": "application/json" };
  if (session?.sessionToken) {
    headers["X-Session-Token"] = session.sessionToken;
  }
  return headers;
};

const getEcsExecContext = (session) => {
  const taskArn = session?.taskArn || session?.TaskArn;
  if (!taskArn) return null;
  const taskId = session.TaskId || taskArn.split("/").pop();
  const cluster = session.cluster || session.ClusterName || ENV.ecsCluster;
  if (!taskId || !cluster) return null;
  return {
    taskId,
    cluster,
    container: session.ContainerName || "lab-runtime",
  };
};

const resolveAwsCli = () => {
  let awsExePath = process.env.AWS_CLI_PATH || "aws";
  if (!process.env.AWS_CLI_PATH && os.platform() === "win32") {
    if (fs.existsSync("C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe")) {
      awsExePath = "C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe";
    } else {
      awsExePath = "aws.exe";
    }
  }
  return { awsExePath, argsPrepend: [], isLocalWinSetup: false };
};

const getSsmEnv = () => {
  const env = { ...process.env };
  if (os.platform() === "win32") {
    const userHome = os.homedir();
    const additions = [
      "C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin",
      "C:\\Program Files\\Amazon\\AWSCLIV2",
    ];

    // Dynamically find any python core scripts directories to add to PATH
    const pythonDir = path.join(userHome, "AppData", "Local", "Python");
    if (fs.existsSync(pythonDir)) {
      try {
        const folders = fs.readdirSync(pythonDir);
        for (const folder of folders) {
          additions.push(path.join(pythonDir, folder, "Scripts"));
        }
      } catch (e) { }
    }

    env.PATH = [
      ...additions,
      env.PATH || "",
    ].join(";");
  }
  return env;
};

const stripSsmNoise = (stdout) => {
  let cleanOut = stdout || "";
  cleanOut = cleanOut.replace(
    /The Session Manager plugin was installed successfully\.\s*Use the AWS CLI to start a session\.[\r\n]*/gi,
    "",
  );
  cleanOut = cleanOut.replace(/Starting session with SessionId:\s*[\w-]+\s*/gi, "");
  cleanOut = cleanOut.replace(/Exiting session with sessionId:\s*[\w-]+\.?\s*/gi, "");
  return cleanOut.trim();
};
const waitForExecuteCommandAgent = async (session) => {
  const MAX_RETRIES = 15;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const task = await describeTask(session.taskArn);

    if (!task) {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    const container =
      task.containers?.find(c => c.name === "lab-runtime") ||
      task.containers?.[0];

    const agent =
      container?.managedAgents?.find(
        a => a.name === "ExecuteCommandAgent"
      );

    console.log({
      taskStatus: task.lastStatus,
      containerStatus: container?.lastStatus,
      agentStatus: agent?.lastStatus,
    });

    if (
      task.lastStatus === "RUNNING" &&
      container?.lastStatus === "RUNNING" &&
      agent?.lastStatus === "RUNNING"
    ) {
      console.log("ExecuteCommandAgent READY");
      return;
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  throw new Error(
    "ExecuteCommandAgent did not become RUNNING within timeout."
  );
};
const runSsmShellCommand = async (session, commandValue, { timeoutMs = 120000 } = {}) => {
  const ctx = getEcsExecContext(session);
  if (!ctx) {
    throw new Error("Missing ECS task info for SSM execution");
  }
  await waitForExecuteCommandAgent(session);
  const region = ENV.awsRegion;
  const aws = resolveAwsCli();
  let awsPrefix = `"${aws.awsExePath}"`;
  if (aws.argsPrepend.length > 0) {
    awsPrefix = `"${aws.awsExePath}" ${aws.argsPrepend.map((a) => `"${a}"`).join(" ")}`;
  } else if (!aws.awsExePath.includes("\\") && !aws.awsExePath.includes("/")) {
    awsPrefix = aws.awsExePath;
  }

  const execCmd =
    os.platform() === "win32"
      ? `${awsPrefix} ecs execute-command --cluster ${ctx.cluster} --task ${ctx.taskId} --container ${ctx.container} --interactive --command "${commandValue}" --region ${region} < NUL`
      : `${awsPrefix} ecs execute-command --cluster ${ctx.cluster} --task ${ctx.taskId} --container ${ctx.container} --interactive --command "${commandValue}" --region ${region}`;

  try {
    const { stdout } = await execAsync(execCmd, {
      env: getSsmEnv(),
      maxBuffer: 10 * 1024 * 1024,
      timeout: timeoutMs,
    });

    return stripSsmNoise(stdout);
  } catch (err) {
    if (err.killed || err.code === "ETIMEDOUT") {
      throw new Error(`SSM command timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  }
};

const executeViaSsm = async (session, payload) => {
  if (isDotnetPayload(session, payload)) {
    return runDotnetViaSsm(session, payload);
  }

  let lang = (payload.language || "").toLowerCase();

  // If language is missing, infer from file path
  if (!lang && payload.path) {
    const ext = payload.path.split('.').pop().toLowerCase();
    if (ext === 'java') lang = 'java';
    else if (ext === 'py') lang = 'python';
    else if (ext === 'js') lang = 'javascript';
    else if (ext === 'sh') lang = 'bash';
  }

  const content = payload.content || "";
  const b64 = Buffer.from(content).toString("base64");

  let commandValue = "";

  if (lang === "java") {
    const containerPath = payload.path ? getContainerFilePath(payload.path) : "/tmp/workspace/workspace/Main.java";
    const fileName = containerPath.split('/').pop();
    const className = fileName.replace('.java', '');
    const dirName = containerPath.substring(0, containerPath.lastIndexOf('/'));

    commandValue = `sh -c 'echo ${b64} | base64 -d > "${containerPath}" && cd "${dirName}" && javac "${fileName}" && java "${className}" 2>&1'`;
  } else {
    let ext = "py";
    let runner = "python3";
    if (lang === "javascript" || lang === "js" || lang === "node") {
      ext = "js";
      runner = "node";
    } else if (lang === "bash" || lang === "shell" || lang === "sh") {
      ext = "sh";
      runner = "bash";
    }

    commandValue = `sh -c 'echo ${b64} | base64 -d > /tmp/ssm_exec.${ext} && ${runner} /tmp/ssm_exec.${ext} 2>&1'`;
  }

  const output = await runSsmShellCommand(session, commandValue);

  return {
    success: true,
    output: output || "",
    error: null,
    syntaxError: "",
    runtimeError: "",
  };
};

const executeViaHttp = async (session, payload, baseUrl) => {
  const healthController = new AbortController();
  const healthTimer = setTimeout(() => healthController.abort(), 10000);

  try {
    const healthResponse = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: healthController.signal,
    });

    if (!healthResponse.ok && healthResponse.status !== 404) {
      throw new Error(`Container unhealthy (${healthResponse.status})`);
    }
  } finally {
    clearTimeout(healthTimer);
  }

  const labType = resolveLabType({
    labId: session.labId,
    language: payload.language,
    labType: payload.labType,
  });

  const executePath = isDotnetPayload(session, payload)
    ? resolveDotnetExecutePath(payload.path, payload.content)
    : normalizeExecutePath(payload.path);

  const body = {
    path: executePath,
    filePath: executePath,
    content: payload.content,
    code: payload.content,
    language: payload.language,
    labType,
    labId: session.labId,
    sessionId: session.sessionId,
  };

  const endpoints = ["/api/run", "/execute"];
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const executeTimeoutMs = getExecuteTimeoutMs({
        labType,
        language: payload.language,
        labId: session.labId,
      });

      const response = await containerFetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: buildHeaders(session),
        body: JSON.stringify(body),
        timeout: executeTimeoutMs,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Invalid JSON response: ${rawText}`);
      }

      return {
        success: data.success !== false,
        output: data.output || "",
        error: data.error || data.runtimeError || data.syntaxError || null,
        syntaxError: data.syntaxError || "",
        runtimeError: data.runtimeError || "",
      };
    } catch (err) {
      lastError = err;
      console.log(`[Container Error] ${endpoint}: ${err.message}`);
      if (endpoint === "/execute") {
        console.warn("[executeInContainer] HTTP execute failed, trying SSM fallback...");

        if (session.taskArn && isDotnetPayload(session, payload)) {
          try {
            return await runDotnetViaSsm(session, payload);
          } catch (ssmErr) {
            console.warn("[executeInContainer] dotnet SSM lab_server failed:", ssmErr.message);
            throw ssmErr;
          }
        }

        if (session.taskArn) {
          const ctx = getEcsExecContext(session);
          if (ctx?.cluster && ctx?.taskId) {
            try {
              const b64 = Buffer.from(payload.content || "").toString('base64');
              const region = process.env.AWS_REGION || 'ap-south-1';
              let runner = "python3";
              let ext = "py";

              const lang = (payload.language || "").toLowerCase();
              if (lang === "javascript" || lang === "node" || lang === "js") {
                runner = "node"; ext = "js";
              } else if (lang === "bash" || lang === "shell" || lang === "sh") {
                runner = "bash"; ext = "sh";
              } else if (lang === "java") {
                runner = "python3"; ext = "py";
              }

              let execCmd = `aws ecs execute-command --cluster ${ctx.cluster} --task ${ctx.taskId} --container ${session.ContainerName || 'lab-runtime'} --interactive --command "sh -c 'echo ${b64} | base64 -d > /tmp/ssm_exec.${ext} && ${runner} /tmp/ssm_exec.${ext} 2>&1'" --region ${region} < ${nullDev}`;
              const { stdout } = await execAsync(execCmd, { env: process.env });

              let cleanOut = stdout;
              cleanOut = cleanOut.replace(/The Session Manager plugin was installed successfully\.\s*Use the AWS CLI to start a session\.[\r\n]*/gi, '');
              cleanOut = cleanOut.replace(/Starting session with SessionId:\s*[\w-]+\s*/gi, '');
              cleanOut = cleanOut.replace(/Exiting session with sessionId:\s*[\w-]+\.?\s*/gi, '');

              return {
                success: true,
                output: cleanOut.trim(),
                error: null,
                syntaxError: "",
                runtimeError: ""
              };
            } catch (ssmErr) {
              console.warn("[executeInContainer] SSM fallback failed:", ssmErr.message);
              throw new Error(`SSM Fallback execution failed: ${ssmErr.message}`);
            }
          }
        }

        throw err;
      }
    }
  }

  throw lastError || new Error("Container execution endpoints not available");
};

export const saveToContainer = async (session, { path: filePath, content }) => {
  const containerPath = getContainerFilePath(filePath);
  const ctx = getEcsExecContext(session);
  if (!ctx) {
    return { proxied: false }; // Mock session fallback
  }
  try {
    const safeContent = content !== undefined && content !== null ? String(content) : "";
    const b64 = Buffer.from(safeContent).toString("base64");
    const safePath = containerPath.replace(/'/g, "\\'");
    const pythonScript = `import base64
import os

path = '${safePath}'
content_b64 = '${b64}'

try:
    dir_name = os.path.dirname(path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    with open(path, 'wb') as f:
        f.write(base64.b64decode(content_b64))
    print('SUCCESS')
except Exception as e:
    print('ERROR: ' + str(e))
`;

    const payload = {
      path: "/tmp/save_file.py",
      language: "python",
      content: pythonScript,
    };

    const result = await executeInContainer(session, payload, { forceSsm: true });
    if (result && result.output && result.output.includes("SUCCESS")) {
      console.log(`[saveToContainer] SSM Python sync successful for ${containerPath}`);
      return { proxied: true, method: "ssm" };
    } else {
      console.warn("[saveToContainer] SSM Python sync failed, output:", result?.output);
      throw new Error("Unable to access container workspace. Please refresh or restart the session.");
    }
  } catch (ssmErr) {
    console.warn("[saveToContainer] SSM sync failed:", ssmErr.message);
    throw new Error("Unable to access container workspace. Please refresh or restart the session.");
  }
};

export const executeInContainer = async (session, payload, options = {}) => {
  const baseUrl = await getSessionApiBaseUrl(session);
  const ctx = getEcsExecContext(session);
  const dotnet = isDotnetPayload(session, payload);

  if (!baseUrl && !ctx) {
    console.log("[Container] No HTTP base URL or ECS task available");
    return null;
  }

  let host = null;
  if (baseUrl) {
    try {
      host = new URL(baseUrl).hostname;
    } catch {
      host = null;
    }
  }

  const preferSsm = shouldPreferSsmExecution(host, ctx) && !options.forceSsm;

  if (preferSsm) {
    console.log("=================================");
    if (dotnet) {
      const dotnetAction = resolveDotnetSsmAction(payload);
      console.log(
        dotnetAction === "build"
          ? "CONTAINER SSM DOTNET BUILD (dotnet build)"
          : isDotnetMvcProject(payload.path, payload.content)
            ? "CONTAINER SSM DOTNET RUN (dotnet run + preview)"
            : isDotnetConsoleProgram(payload.path, payload.content)
              ? "CONTAINER SSM DOTNET CONSOLE RUN (dotnet run)"
              : "CONTAINER SSM DOTNET (lab_server @ 127.0.0.1:8080)",
      );
    } else {
      console.log("CONTAINER SSM EXECUTION");
    }
    console.log("Task:", ctx.taskId, "Cluster:", ctx.cluster);
    console.log("=================================");
    try {
      return await (dotnet
        ? runDotnetViaSsm(session, payload)
        : executeViaSsm(session, payload));
    } catch (err) {
      console.warn("[executeInContainer] SSM execution failed:", err.message);
      if (!baseUrl || ENV.containerHostMode === "private" || isPrivateHost(host)) {
        throw err;
      }
    }
  }

  if (baseUrl && !options.forceSsm) {
    console.log("=================================");
    console.log("CONTAINER HTTP EXECUTION");
    console.log("BASE URL:", baseUrl);
    console.log("=================================");

    try {
      return await executeViaHttp(session, payload, baseUrl);
    } catch (err) {
      console.warn("[executeInContainer] HTTP execution failed:", err.message);
      if (!ctx) {
        throw err;
      }
      console.log("[executeInContainer] Falling back to SSM execution...");
    }
  }

  if (ctx) {
    console.log("=================================");
    console.log("CONTAINER SSM EXECUTION");
    console.log("Task:", ctx.taskId, "Cluster:", ctx.cluster);
    console.log("=================================");
    return await executeViaSsm(session, payload);
  }

  return null;
};

export const deleteFromContainer = async (session, filePath) => {
  const containerPath = getContainerFilePath(filePath);
  if (!containerPath) return;

  const ctx = getEcsExecContext(session);
  if (!ctx) {
    return; // Mock session fallback
  }

  const payload = {
    path: "/workspace/.delete_script.py",
    language: "python",
    content: `import os
import shutil

targets = [
    "${containerPath}",
    "${containerPath}".replace('/workspace/', '/tmp/workspace/workspace/'),
    os.path.join(os.getcwd(), "${containerPath}".split('/')[-1])
]

deleted_any = False
for target in targets:
    if os.path.exists(target):
        try:
            if os.path.isdir(target):
                shutil.rmtree(target)
            else:
                os.remove(target)
            deleted_any = True
        except Exception as e:
            print(f"Error deleting {target}: {e}")

if deleted_any:
    print("Deleted successfully")
else:
    print("No targets found")

if os.path.exists(__file__):
    os.remove(__file__)`,
  };

  try {
    const result = await executeInContainer(session, payload, { forceSsm: true });
    if (!result || !result.output || (!result.output.includes("Deleted successfully") && !result.output.includes("No targets found"))) {
      throw new Error("Unable to access container workspace. Please refresh or restart the session.");
    }
  } catch (err) {
    console.warn("[deleteFromContainer] Failed to delete from container:", err.message);
    throw new Error("Unable to access container workspace. Please refresh or restart the session.");
  }
};

export const getFilesFromContainer = async (session) => {
  const ctx = getEcsExecContext(session);
  if (!ctx) {
    return []; // Mock session fallback
  }

  const isAndroid = session?.labType === 'android' || session?.labId === 'android' || session?.labId === 'mobile-app-lab';
  const isDotnet = isDotnetSession(session);
  const isDataScience = session?.labType === 'datascience' || session?.labId === 'data-science-lab' || session?.labId?.includes('datascience') || session?.labId?.includes('jupyter') || session?.labId?.includes('notebook');

  const payload = {
    path: "/tmp/list_files.py",
    language: "python",
    content: isDotnet ? DOTNET_LIST_FILES_SCRIPT : `import os
import json
import base64
import shutil

workspace = "/tmp/workspace/workspace"

# 1. Copy-on-Initialize: Copy from /workspace to /tmp/workspace/workspace if empty
if os.path.exists("/workspace") and os.path.isdir("/workspace"):
    try:
        os.makedirs(workspace, exist_ok=True)
        if not os.listdir(workspace):
            for item in os.listdir("/workspace"):
                s = os.path.join("/workspace", item)
                d = os.path.join(workspace, item)
                if os.path.isdir(s):
                    if item not in ['.git', 'node_modules', '.gradle', '.idea', '__pycache__', 'tmp']:
                        shutil.copytree(s, d)
                else:
                    shutil.copy2(s, d)
    except Exception as e:
        print("COPY_ERROR: " + str(e))

# 3. List all files
result = []
if os.path.exists(workspace):
    for root, dirs, files in os.walk(workspace):
        filtered_dirs = []
        for d in dirs:
            if d in ['.git', 'node_modules', '.gradle', '.idea', '__pycache__', 'tmp']:
                continue
            if d == 'build':
                if not (root.endswith('/app') or root.endswith('\\\\app') or root == '/tmp/workspace/workspace/app' or root == '/tmp/workspace/workspace\\\\\\\\app'):
                    continue
            parts = root.replace('\\\\', '/').split('/')
            if 'build' in parts:
                build_idx = parts.index('build')
                sub_parts = parts[build_idx+1:]
                if len(sub_parts) == 0 and d != 'outputs':
                    continue
                if len(sub_parts) == 1 and sub_parts[0] == 'outputs' and d != 'apk':
                    continue
            filtered_dirs.append(d)
        dirs[:] = filtered_dirs

        for f in files:
            if f.endswith('.pyc') or f.endswith('.class') or f == '.DS_Store' or f.endswith('.apk') or f.endswith('.zip') or f.endswith('.tar.gz') or f.endswith('.png') or f.endswith('.jpg') or f.endswith('.jpeg') or f.endswith('.gif') or f.endswith('.ico'):
                continue
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, workspace)
            rel_path = rel_path.replace('\\\\', '/')
            
            # Safely read small text files to preload their content
            content = ""
            try:
                if os.path.getsize(full_path) < 500 * 1024:
                    with open(full_path, 'r', encoding='utf-8', errors='replace') as file_obj:
                        content = file_obj.read()
            except Exception:
                pass

            result.append({
                "name": f,
                "path": "/workspace/" + rel_path,
                "type": "file",
                "content": content
            })

print("---FILES_START---" + json.dumps(result) + "---FILES_END---")`
  };

  try {
    const result = await executeInContainer(session, payload, { forceSsm: true });
    if (result && result.output) {
      const output = result.output;
      const startMarker = "---FILES_START---";
      const endMarker = "---FILES_END---";
      const startIdx = output.indexOf(startMarker);
      const endIdx = output.lastIndexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const jsonStr = output.substring(startIdx + startMarker.length, endIdx).trim();
        const filesList = JSON.parse(jsonStr);

        if ((isAndroid || isDotnet || isDataScience) && filesList.length === 0) {
          if (!activeS3Bootstraps.has(session.sessionId)) {
            activeS3Bootstraps.add(session.sessionId);
            console.log(`[getFilesFromContainer] Workspace is empty. Triggering self-healing S3 bootstrap for session ${session.sessionId}...`);
            try {
              await bootstrapWorkspaceFromS3(session);
              // Re-read files after successful bootstrap
              return await getFilesFromContainer(session);
            } catch (err) {
              console.error("[getFilesFromContainer] Self-healing S3 bootstrap failed:", err.message);
            } finally {
              activeS3Bootstraps.delete(session.sessionId);
            }
          } else {
            console.log("[getFilesFromContainer] S3 bootstrap is already running for this session.");
          }
        }

        return isDotnet ? filterDotnetWorkspaceFiles(filesList) : filesList;
      }
    }
    throw new Error("Unable to access container workspace. Please refresh or restart the session.");
  } catch (err) {
    console.error("[getFilesFromContainer] Error:", err.message, err.stack);
    throw new Error("DEBUG: " + err.message);
  }
};

export const getFileContentFromContainer = async (session, filePath) => {
  const ctx = getEcsExecContext(session);
  if (!ctx) {
    return ""; // Mock session fallback
  }

  const containerPath = getContainerFilePath(filePath);
  const payload = {
    path: "/tmp/read_file.py",
    language: "python",
    content: `import base64
import os
filePath = '${containerPath}'
try:
    if os.path.exists(filePath):
        with open(filePath, 'rb') as f:
            print('---CONTENT_START---' + base64.b64encode(f.read()).decode() + '---CONTENT_END---')
    else:
        print('ERROR: File not found')
except Exception as e:
    print('ERROR: ' + str(e))`
  };

  try {
    const result = await executeInContainer(session, payload, { forceSsm: true });
    if (result && result.output) {
      const output = result.output;
      const startMarker = "---CONTENT_START---";
      const endMarker = "---CONTENT_END---";
      const startIdx = output.indexOf(startMarker);
      const endIdx = output.lastIndexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const b64 = output.substring(startIdx + startMarker.length, endIdx).trim();
        return Buffer.from(b64, "base64").toString("utf-8");
      }
    }
    throw new Error("Unable to access container workspace. Please refresh or restart the session.");
  } catch (err) {
    console.error("[getFileContentFromContainer] Error:", err.message);
    throw new Error("Unable to access container workspace. Please refresh or restart the session.");
  }
};

export const getContainerFiles = async (session) => {
  const baseUrl = await getSessionApiBaseUrl(session);

  const payload = {
    path: "/workspace/.list_script.py",
    language: "python",
    content: `import os
import json
import mimetypes
import shutil

ignored = ['__pycache__', 'node_modules', '.git', '.delete_script.py', '.list_script.py', '.hadoop_wrapper.py', '.read_script.py', 'semple.csv', 'sample.csv', 'intermediates', 'generated', 'tmp', 'kotlin', '.gradle', '.tanstack']

workspace_dir = '/tmp/workspace/workspace'
if not os.path.exists(workspace_dir):
    try:
        os.makedirs(workspace_dir, exist_ok=True)
    except:
        workspace_dir = '/workspace'

if workspace_dir == '/tmp/workspace/workspace' and os.path.exists('/workspace'):
    is_empty = True
    try:
        for f in os.listdir(workspace_dir):
            if f not in ignored:
                is_empty = False
                break
    except:
        pass
    if is_empty:
        try:
            for item in os.listdir('/workspace'):
                if item not in ignored:
                    s = os.path.join('/workspace', item)
                    d = os.path.join(workspace_dir, item)
                    if os.path.isdir(s):
                        shutil.copytree(s, d, dirs_exist_ok=True)
                    else:
                        shutil.copy2(s, d)
        except:
            pass

files_list = []
for root, dirs, files in os.walk(workspace_dir):
    dirs[:] = [d for d in dirs if d not in ignored]
    for f in files:
        if f in ignored or f.endswith('.class'): continue
        path = os.path.join(root, f)
        if workspace_dir == '/tmp/workspace/workspace':
             rel_path = path.replace('/tmp/workspace/workspace', '/workspace')
        else:
             rel_path = path
        mime, _ = mimetypes.guess_type(path)
        lang = 'plaintext'
        if f.endswith('.py'): lang = 'python'
        elif f.endswith('.js'): lang = 'javascript'
        elif f.endswith('.java'): lang = 'java'
        elif f.endswith('.cs'): lang = 'csharp'
        elif f.endswith('.cshtml'): lang = 'razor'
        elif f.endswith('.sh'): lang = 'shell'
        elif f.endswith('.json'): lang = 'json'
        elif f.endswith('.html'): lang = 'html'
        elif f.endswith('.css'): lang = 'css'
        
        files_list.append({
          'name': f,
          'path': rel_path,
          'language': lang,
          'type': 'file'
        })

print("###" + json.dumps(files_list) + "###")`
  };

  try {
    const result = await executeInContainer(session, payload);
    if (result && result.success && result.output) {
      const match = result.output.match(/###(.*?)###/s);
      if (match) {
        return JSON.parse(match[1]);
      }
    }
  } catch (err) {
    console.warn("[getContainerFiles] HTTP execute failed, trying SSM fallback:", err.message);
  }

  // SSM Fallback (Always execute if HTTP fails)
  if (session.taskArn) {
    const { cluster, task } = getTaskDetails(session);
    if (cluster && task) {
      try {
        const region = process.env.AWS_REGION || 'ap-south-1';
        let execCmd = `aws ecs execute-command --cluster ${cluster} --task ${task} --container ${session.ContainerName || 'lab-runtime'} --interactive --command "sh -c 'mkdir -p /tmp/workspace/workspace && (if [ -z \\"\\\$(ls -A /tmp/workspace/workspace 2>/dev/null)\\" ] && [ -d /workspace ]; then cp -rn /workspace/* /tmp/workspace/workspace/ 2>/dev/null || true; fi) && find /tmp/workspace/workspace -maxdepth 8 -type f 2>/dev/null'" --region ${region} < ${nullDev}`;

        const { stdout } = await execAsync(execCmd, { env: process.env });
        const files = stdout.split('\n')
          .map(line => line.trim())
          .filter(line => {
            const clean = line.replace('/tmp/workspace/workspace', '/workspace');
            const name = clean.split('/').pop();
            // Filter out system and heavy build directories to keep list clean
            if (clean.includes('/.git/') || clean.includes('/node_modules/') || clean.includes('/__pycache__/') || clean.includes('/.gradle/') ||
              clean.includes('/build/intermediates/') || clean.includes('/build/generated/') || clean.includes('/build/tmp/') || clean.includes('/build/kotlin/')) {
              return false;
            }
            return (line.startsWith('/workspace/') || line.startsWith('/tmp/workspace/workspace/')) &&
              name !== 'semple.csv' && name !== 'sample.csv';
          });

        const detectLanguage = (fileName) => {
          const ext = fileName.split('.').pop()?.toLowerCase();
          if (ext === 'py') return 'python';
          if (ext === 'java') return 'java';
          if (ext === 'cs') return 'csharp';
          if (ext === 'cshtml') return 'razor';
          if (ext === 'html') return 'html';
          if (ext === 'css') return 'css';
          if (ext === 'js' || ext === 'jsx') return 'javascript';
          if (ext === 'json') return 'json';
          if (ext === 'md') return 'markdown';
          if (ext === 'gradle') return 'groovy';
          if (ext === 'properties') return 'properties';
          if (ext === 'sh') return 'shell';
          if (ext === 'xml') return 'xml';
          return 'plaintext';
        };

        return files.map(f => {
          const cleanPath = f.replace('/tmp/workspace/workspace', '/workspace');
          const name = cleanPath.split('/').pop();
          return {
            name,
            path: cleanPath,
            type: 'file',
            language: detectLanguage(name)
          };
        });
      } catch (ssmErr) {
        console.warn("[getContainerFiles] SSM fallback failed:", ssmErr.message);
      }
    }
  }

  return [];
};

export const readFromContainer = async (session, filePath) => {
  const containerPath = getContainerFilePath(filePath);

  const payload = {
    path: "/workspace/.read_script.py",
    language: "python",
    content: `import os
import base64

target = "${containerPath}"
if os.path.exists(target) and os.path.isfile(target):
    with open(target, 'rb') as f:
        print("###" + base64.b64encode(f.read()).decode('utf-8') + "###")
else:
    print("###NOT_FOUND###")`
  };

  try {
    const result = await executeInContainer(session, payload, { forceSsm: true });
    if (result && result.success && result.output) {
      const match = result.output.match(/###(.*?)###/s);
      if (match) {
        const data = match[1];
        if (data === "NOT_FOUND") return null;
        return Buffer.from(data, 'base64').toString('utf-8');
      }
    }
  } catch (err) {
    console.warn("[readFromContainer] HTTP execute failed, trying SSM fallback:", err.message);
  }

  // SSM Fallback
  if (session.taskArn) {
    const { cluster, task } = getTaskDetails(session);
    if (cluster && task) {
      try {
        const region = process.env.AWS_REGION || 'ap-south-1';
        let execCmd = `aws ecs execute-command --cluster ${cluster} --task ${task} --container ${session.ContainerName || 'lab-runtime'} --interactive --command "sh -c 'if [ -f \\"${containerPath}\\" ]; then cat \\"${containerPath}\\" | base64; else echo NOT_FOUND; fi'" --region ${region} < ${nullDev}`;

        const { stdout } = await execAsync(execCmd, { env: process.env });
        let cleanOut = stdout;
        cleanOut = cleanOut.replace(/The Session Manager plugin was installed successfully\.\s*Use the AWS CLI to start a session\.[\r\n]*/gi, '');
        cleanOut = cleanOut.replace(/Starting session with SessionId:\s*[\w-]+\s*/gi, '');
        cleanOut = cleanOut.replace(/Exiting session with sessionId:\s*[\w-]+\.?\s*/gi, '');

        const lines = cleanOut.split('\n').map(l => l.trim()).filter(Boolean);
        const lastLine = lines[lines.length - 1];
        if (lastLine === "NOT_FOUND") return null;

        const b64Data = lines.join('');
        return Buffer.from(b64Data, 'base64').toString('utf-8');
      } catch (ssmErr) {
        console.warn("[readFromContainer] SSM fallback failed:", ssmErr.message);
      }
    }
  }

  return null;
};

export const getPresignedUrl = async (bucket, key, ttlSeconds = 3600) => {
  try {
    const awsCmd = `aws s3 presign s3://${bucket}/${key} --expires-in ${ttlSeconds}`;
    console.log(`[S3] Generating presigned URL with cmd: ${awsCmd}`);
    const { stdout } = await execAsync(awsCmd);
    return stdout.trim();
  } catch (err) {
    console.error("[getPresignedUrl] Error generating presigned URL:", err.message);
    throw err;
  }
};

export const bootstrapWorkspaceFromS3 = async (session) => {
  const bucket = ENV.testCasesBucket || 'vlab-dev-lab-files-0kdrg0q8';
  const ttl = ENV.labBootstrapPresignTtlSeconds || 3600;
  
  const labId = (session?.labId || "").toLowerCase();
  const labType = (session?.labType || "").toLowerCase();

  const isAndroid = labId === 'mobile-app-lab' || labId === 'android' || labType === 'android';
  const isDotnet = labType === 'dotnet' || labId === 'dotnet-lab' || labId.includes('dotnet');
  const isDataScience = labType === 'datascience' || labId === 'data-science-lab' || labId.includes('datascience') || labId.includes('jupyter') || labId.includes('notebook');

  let key = "";
  if (isAndroid) {
    key = "lab-assets/android-starter/latest.tar.gz";
  } else if (isDotnet) {
    const isMvc = labId.includes("mvc") || labId.includes("mvc-app") || labType.includes("mvc");
    key = isMvc ? "lab-assets/dotnet/mvc/latest.tar.gz" : "lab-assets/dotnet/console-snippet/latest.tar.gz";
  } else if (isDataScience) {
    key = "lab-assets/datascience/notebook/latest.tar.gz";
  } else {
    console.log(`[bootstrapWorkspaceFromS3] Lab ${labId} (type: ${labType}) does not require S3 bootstrapping.`);
    return null;
  }

  console.log(`[bootstrapWorkspaceFromS3] Generating presigned URL for s3://${bucket}/${key}...`);
  try {
    const presignedUrl = await getPresignedUrl(bucket, key, ttl);
    console.log(`[bootstrapWorkspaceFromS3] Successfully generated presigned URL.`);

    // Download to /tmp/bootstrap.tar.gz, extract via tar, and set executable permissions safely
    const cmd = `mkdir -p /tmp/workspace/workspace && curl -sL "${presignedUrl}" -o /tmp/bootstrap.tar.gz && tar -xzf /tmp/bootstrap.tar.gz -C /tmp/workspace/workspace && (chmod +x /tmp/workspace/workspace/gradlew /tmp/workspace/workspace/build.sh 2>/dev/null || true) && rm /tmp/bootstrap.tar.gz`;

    console.log(`[bootstrapWorkspaceFromS3] Running download & extract script inside container...`);
    const payload = {
      path: "/tmp/bootstrap.sh",
      language: "shell",
      content: cmd
    };

    const result = await executeInContainer(session, payload, { forceSsm: true });
    console.log(`[bootstrapWorkspaceFromS3] Execution result:`, result?.output || 'No output');
    return result;
  } catch (err) {
    console.error(`[bootstrapWorkspaceFromS3] Failed to bootstrap workspace from S3:`, err.message);
    throw err;
  }
};

export const readBinaryFromContainer = async (session, filePath) => {
  const containerPath = getContainerFilePath(filePath);
  const ctx = getEcsExecContext(session);
  if (!ctx) return null;

  if (session.taskArn) {
    const { cluster, task } = getTaskDetails(session);
    if (cluster && task) {
      try {
        const region = process.env.AWS_REGION || 'ap-south-1';
        let execCmd = `aws ecs execute-command --cluster ${cluster} --task ${task} --container ${session.ContainerName || 'lab-runtime'} --interactive --command "sh -c 'if [ -f \\"${containerPath}\\" ]; then cat \\"${containerPath}\\" | base64; else echo NOT_FOUND; fi'" --region ${region} < ${nullDev}`;

        const { stdout } = await execAsync(execCmd, { env: process.env });
        let cleanOut = stdout;
        cleanOut = cleanOut.replace(/The Session Manager plugin was installed successfully\.\s*Use the AWS CLI to start a session\.[\r\n]*/gi, '');
        cleanOut = cleanOut.replace(/Starting session with SessionId:\s*[\w-]+\s*/gi, '');
        cleanOut = cleanOut.replace(/Exiting session with sessionId:\s*[\w-]+\.?\s*/gi, '');

        const lines = cleanOut.split('\n').map(l => l.trim()).filter(Boolean);
        const lastLine = lines[lines.length - 1];
        if (lastLine === "NOT_FOUND") return null;

        const cleanBase64 = cleanOut.replace(/[^a-zA-Z0-9+/=]/g, '').trim();
        return Buffer.from(cleanBase64, 'base64');
      } catch (err) {
        console.warn("[readBinaryFromContainer] SSM read failed:", err.message);
        throw err;
      }
    }
  }
  return null;
};
