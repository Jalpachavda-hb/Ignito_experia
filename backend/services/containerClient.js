import fs from "fs";
import path from "path";
import { getSessionApiBaseUrl } from "../lib/labTools.js";
import { resolveLabType } from "../lib/labTypeMapper.js";
import { ENV } from "../config/env.js";
import { exec } from "child_process";
import util from "util";
import os from "os";
import { ANDROID_STARTER_FILES } from "../lib/androidStarter.js";

const execAsync = util.promisify(exec);

const CONTAINER_TIMEOUT_MS = 35000;

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
  const taskArn = session?.taskArn;
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
  const standardAws = "C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe";

  if (os.platform() === "win32") {
    if (fs.existsSync(standardAws)) {
      return { awsExePath: standardAws, argsPrepend: [], isLocalWinSetup: false };
    }

    // Dynamic search inside the current user's profile AppData directory
    const userHome = os.homedir();
    const pythonDir = path.join(userHome, "AppData", "Local", "Python");
    if (fs.existsSync(pythonDir)) {
      try {
        const folders = fs.readdirSync(pythonDir);
        for (const folder of folders) {
          const scriptsDir = path.join(pythonDir, folder, "Scripts");
          const awsExe = path.join(scriptsDir, "aws.exe");
          const awsNoExt = path.join(scriptsDir, "aws");
          const pythonExe = path.join(pythonDir, folder, "python.exe");

          if (fs.existsSync(awsExe)) {
            return { awsExePath: awsExe, argsPrepend: [], isLocalWinSetup: false };
          }
          if (fs.existsSync(awsNoExt) && fs.existsSync(pythonExe)) {
            return { awsExePath: pythonExe, argsPrepend: [awsNoExt], isLocalWinSetup: true };
          }
        }
      } catch (err) {
        console.warn("[resolveAwsCli] Error reading local Python directory:", err.message);
      }
    }
  }

  return { awsExePath: "aws", argsPrepend: [], isLocalWinSetup: false };
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
      } catch (e) {}
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

const runSsmShellCommand = async (session, commandValue) => {
  const ctx = getEcsExecContext(session);
  if (!ctx) {
    throw new Error("Missing ECS task info for SSM execution");
  }

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

  const { stdout } = await execAsync(execCmd, {
    env: getSsmEnv(),
    maxBuffer: 10 * 1024 * 1024,
  });

  return stripSsmNoise(stdout);
};

const executeViaSsm = async (session, payload) => {
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

  const body = {
    path: payload.path,
    filePath: payload.path,
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
      const response = await containerFetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: buildHeaders(session),
        body: JSON.stringify(body),
        timeout:
          payload.labType === "big-data"
            ? 120000
            : payload.language === "java"
              ? 60000
              : 15000,
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

  if (!baseUrl && !ctx) {
    console.log("[Container] No HTTP base URL or ECS task available");
    return null;
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
  let b64Json = "";
  if (isAndroid) {
    const jsonStr = JSON.stringify(ANDROID_STARTER_FILES);
    b64Json = Buffer.from(jsonStr).toString("base64");
  }

  const payload = {
    path: "/tmp/list_files.py",
    language: "python",
    content: `import os
import json
import base64
import shutil

workspace = "/tmp/workspace/workspace"
is_android = ${isAndroid ? 'True' : 'False'}

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

# 2. Seed Android Starter Files if needed
if is_android and not os.path.exists(os.path.join(workspace, "build.gradle")):
    try:
        files_data = json.loads(base64.b64decode('${b64Json}').decode('utf-8'))
        for file in files_data:
            path = file['path'].replace('/workspace/', '/tmp/workspace/workspace/')
            dir_name = os.path.dirname(path)
            if dir_name:
                os.makedirs(dir_name, exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(file['content'])
            if file['name'] in ['gradlew', 'build.sh']:
                try:
                    os.chmod(path, 0o755)
                except:
                    pass
    except Exception as e:
        print("SEED_ERROR: " + str(e))

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
            if f.endswith('.pyc') or f.endswith('.class') or f == '.DS_Store':
                continue
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, workspace)
            rel_path = rel_path.replace('\\\\', '/')
            result.append({
                "name": f,
                "path": "/workspace/" + rel_path,
                "type": "file"
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
        return JSON.parse(jsonStr);
      }
    }
    throw new Error("Unable to access container workspace. Please refresh or restart the session.");
  } catch (err) {
    console.error("[getFilesFromContainer] Error:", err.message);
    throw new Error("Unable to access container workspace. Please refresh or restart the session.");
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
