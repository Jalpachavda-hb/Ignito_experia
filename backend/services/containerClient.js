import { getSessionApiBaseUrl } from "../lib/labTools.js";
import { resolveLabType } from "../lib/labTypeMapper.js";
import { exec } from "child_process";
import util from "util";
import os from "os";

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
    const cleanPath = filePath.replace(/^\/workspace\//, "");
    return `/tmp/workspace/workspace/${cleanPath}`;
  }
  const cleanPath = filePath.replace(/^\/+/, "");
  return `/tmp/workspace/workspace/${cleanPath}`;
};

const getTaskDetails = (session) => {
  if (!session?.taskArn) return { cluster: null, task: null };
  const parts = session.taskArn.split("/");
  if (parts.length >= 3) {
    return { cluster: parts[1], task: parts[2] };
  }
  return { cluster: process.env.ECS_CLUSTER || "vlab-dev-cluster", task: parts.pop() };
};

const buildHeaders = (session) => {
  const headers = { "Content-Type": "application/json" };
  if (session?.sessionToken) {
    headers["X-Session-Token"] = session.sessionToken;
  }
  return headers;
};

export const saveToContainer = async (session, { path: filePath, content }) => {
  const containerPath = getContainerFilePath(filePath);
  const baseUrl = await getSessionApiBaseUrl(session);
  let httpSuccess = false;

  if (baseUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(`${baseUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      if (response.ok) {
        const saveRes = await containerFetch(`${baseUrl}/api/save`, {
          method: "POST",
          headers: buildHeaders(session),
          body: JSON.stringify({ path: containerPath, content, sessionId: session.sessionId }),
        });
        if (saveRes.ok) {
          httpSuccess = true;
        }
      }
    } catch (err) {
      console.warn("[saveToContainer] HTTP save failed:", err.message);
    } finally {
      clearTimeout(timer);
    }
  }

  // Always write the file directly to the container's disk via SSM execute-command to keep the filesystem in sync
  if (session.taskArn) {
    const { cluster, task } = getTaskDetails(session);
    if (cluster && task) {
      try {
        const b64 = Buffer.from(content).toString('base64');
        const region = process.env.AWS_REGION || 'ap-south-1';
        const containerDir = containerPath.split('/').slice(0, -1).join('/');
        let execCmd = `aws ecs execute-command --cluster ${cluster} --task ${task} --container ${session.ContainerName || 'lab-runtime'} --interactive --command "sh -c 'mkdir -p \\"${containerDir}\\" && echo \\"${b64}\\" | base64 -d > \\"${containerPath}\\"'" --region ${region} < NUL`;

        const env = { ...process.env };
        if (os.platform() === 'win32') {
          env.PATH = `C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin;C:\\Users\\Hackberry Softech\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts;C:\\Users\\Hackberry Softech\\AppData\\Local\\Python\\pythoncore-3.14-64;${env.PATH || ''}`;
        }

        await execAsync(execCmd, { env });
        console.log(`[saveToContainer] SSM sync to container disk successful for ${containerPath}`);
        return { proxied: true, method: 'both', httpSuccess };
      } catch (ssmErr) {
        console.warn("[saveToContainer] SSM fallback failed:", ssmErr.message);
      }
    }
  }

  return { proxied: httpSuccess, method: 'http_only' };
};

export const executeInContainer = async (session, payload) => {
  const baseUrl = await getSessionApiBaseUrl(session);

  if (!baseUrl) {
    console.log("[Container] No base URL available");
    return null;
  }

  console.log("=================================");
  console.log("CONTAINER HEALTH CHECK");
  console.log("BASE URL:", baseUrl);
  console.log("=================================");

  try {
    const healthController = new AbortController();
    const healthTimer = setTimeout(
      () => healthController.abort(),
      10000
    );

    const healthResponse = await fetch(
      `${baseUrl}/health`,
      {
        method: "GET",
        signal: healthController.signal,
      }
    );

    clearTimeout(healthTimer);

    console.log(
      `[Health Check] Status: ${healthResponse.status}`
    );

    if (
      !healthResponse.ok &&
      healthResponse.status !== 404
    ) {
      throw new Error(
        `Container unhealthy (${healthResponse.status})`
      );
    }
  } catch (err) {
    console.log(
      `[Health Check Failed] ${err.message}`
    );
    throw new Error(
      `Container not reachable: ${err.message}`
    );
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

  for (const endpoint of endpoints) {
    try {
      console.log("=================================");
      console.log("CONTAINER EXECUTION REQUEST");
      console.log("URL:", `${baseUrl}${endpoint}`);
      console.log("LANGUAGE:", payload.language);
      console.log(
        "TIMEOUT:",
        payload.labType === "big-data"
          ? 120000
          : payload.language === "java"
            ? 60000
            : 15000
      );
      console.log("=================================");

      const response = await containerFetch(
        `${baseUrl}${endpoint}`,
        {
          method: "POST",
          headers: buildHeaders(session),
          body: JSON.stringify(body),
          timeout:
            payload.labType === "big-data"
              ? 120000
              : payload.language === "java"
                ? 60000
                : 15000,
        }
      );

      if (!response.ok) {
        const errorText =
          await response.text();

        throw new Error(
          `HTTP ${response.status}: ${errorText}`
        );
      }

      const rawText = await response.text();

      console.log("=================================");
      console.log("RAW CONTAINER RESPONSE");
      console.log("=================================");
      console.log(rawText);

      let data;

      try {
        data = JSON.parse(rawText);
      } catch (err) {
        throw new Error(
          `Invalid JSON response: ${rawText}`
        );
      }

      return {
        success: data.success !== false,
        output: data.output || "",
        error:
          data.error ||
          data.runtimeError ||
          data.syntaxError ||
          null,
        syntaxError:
          data.syntaxError || "",
        runtimeError:
          data.runtimeError || "",
      };
    } catch (err) {
      console.log(
        `[Container Error] ${endpoint}: ${err.message}`
      );

      if (endpoint === "/execute") {
        console.warn("[executeInContainer] HTTP execute failed, trying SSM fallback...");

        if (session.taskArn) {
          const { cluster, task } = getTaskDetails(session);
          if (cluster && task) {
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

              let execCmd = `aws ecs execute-command --cluster ${cluster} --task ${task} --container ${session.ContainerName || 'lab-runtime'} --interactive --command "sh -c 'echo ${b64} | base64 -d > /tmp/ssm_exec.${ext} && ${runner} /tmp/ssm_exec.${ext} 2>&1'" --region ${region} < NUL`;

              const env = { ...process.env };
              if (os.platform() === 'win32') {
                env.PATH = `C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin;C:\\Users\\Hackberry Softech\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts;C:\\Users\\Hackberry Softech\\AppData\\Local\\Python\\pythoncore-3.14-64;${env.PATH || ''}`;
              }

              const { stdout } = await execAsync(execCmd, { env });

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

  throw new Error(
    "Container execution endpoints not available"
  );
};

export const deleteFromContainer = async (session, filePath) => {
  const containerPath = getContainerFilePath(filePath);
  if (!containerPath) return;

  // Since container maps paths starting with /workspace/ to /tmp/workspace/workspace/,
  // we check all potential mapped paths inside the container to ensure cleanup.
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
    os.remove(__file__)`
  };

  try {
    await executeInContainer(session, payload);
  } catch (err) {
    console.warn("[deleteFromContainer] Failed to delete from container:", err.message);
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
        let execCmd = `aws ecs execute-command --cluster ${cluster} --task ${task} --container ${session.ContainerName || 'lab-runtime'} --interactive --command "sh -c 'mkdir -p /tmp/workspace/workspace && (if [ -z \\"\\\$(ls -A /tmp/workspace/workspace 2>/dev/null)\\" ] && [ -d /workspace ]; then cp -rn /workspace/* /tmp/workspace/workspace/ 2>/dev/null || true; fi) && find /tmp/workspace/workspace -maxdepth 8 -type f 2>/dev/null'" --region ${region} < NUL`;

        const env = { ...process.env };
        if (os.platform() === 'win32') {
          env.PATH = `C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin;C:\\Users\\Hackberry Softech\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts;C:\\Users\\Hackberry Softech\\AppData\\Local\\Python\\pythoncore-3.14-64;${env.PATH || ''}`;
        }

        const { stdout } = await execAsync(execCmd, { env });
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
    const result = await executeInContainer(session, payload);
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
        let execCmd = `aws ecs execute-command --cluster ${cluster} --task ${task} --container ${session.ContainerName || 'lab-runtime'} --interactive --command "sh -c 'if [ -f \\"${containerPath}\\" ]; then cat \\"${containerPath}\\" | base64; else echo NOT_FOUND; fi'" --region ${region} < NUL`;

        const env = { ...process.env };
        if (os.platform() === 'win32') {
          env.PATH = `C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin;C:\\Users\\Hackberry Softech\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts;C:\\Users\\Hackberry Softech\\AppData\\Local\\Python\\pythoncore-3.14-64;${env.PATH || ''}`;
        }

        const { stdout } = await execAsync(execCmd, { env });
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
