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

const buildHeaders = (session) => {
  const headers = { "Content-Type": "application/json" };
  if (session?.sessionToken) {
    headers["X-Session-Token"] = session.sessionToken;
  }
  return headers;
};

export const saveToContainer = async (session, { path, content }) => {
  const baseUrl = await getSessionApiBaseUrl(session);
  if (!baseUrl) return { proxied: false };

  // Fast reachability check (5s) to avoid 35s connection timeouts in local dev
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`health check failed (${response.status})`);
    }
  } catch (err) {
    console.warn("[saveToContainer] HTTP unreachable, attempting AWS SSM fallback:", err.message);
    
    if (session.TaskId && session.ClusterName) {
      try {
        const b64 = Buffer.from(content).toString('base64');
        const region = process.env.AWS_REGION || 'ap-south-1';
        let execCmd = `aws ecs execute-command --cluster ${session.ClusterName} --task ${session.TaskId} --container ${session.ContainerName || 'lab-runtime'} --interactive --command "sh -c 'echo \\"${b64}\\" | base64 -d > \\"${path}\\"'" --region ${region} < NUL`;
        
        // Use local Session Manager plugin if needed on Windows
        const localPipAwsPath = 'C:\\Users\\Hackberry Softech\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts\\aws.exe';
        const fs = await import('fs');
        if (os.platform() === 'win32' && fs.existsSync(localPipAwsPath)) {
           execCmd = `"${localPipAwsPath}" ecs execute-command --cluster ${session.ClusterName} --task ${session.TaskId} --container ${session.ContainerName || 'lab-runtime'} --interactive --command "sh -c 'echo \\"${b64}\\" | base64 -d > \\"${path}\\"'" --region ${region} < NUL`;
        }

        const env = { ...process.env };
        if (os.platform() === 'win32') {
          env.PATH = `C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin;C:\\Users\\Hackberry Softech\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts;${env.PATH || ''}`;
        }
        
        await execAsync(execCmd, { env });
        console.log(`[saveToContainer] SSM fallback sync successful for ${path}`);
        return { proxied: true, method: 'ssm' };
      } catch (ssmErr) {
        console.warn("[saveToContainer] SSM fallback failed:", ssmErr.message);
      }
    }
    
    return { proxied: false };
  } finally {
    clearTimeout(timer);
  }

  const response = await containerFetch(`${baseUrl}/api/save`, {
    method: "POST",
    headers: buildHeaders(session),
    body: JSON.stringify({ path, content, sessionId: session.sessionId }),
  });

  if (!response.ok) {
    throw new Error(`Container save failed (${response.status})`);
  }
  return { proxied: true, ...(await response.json()) };
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
        throw err;
      }
    }
  }

  throw new Error(
    "Container execution endpoints not available"
  );
};

export const deleteFromContainer = async (session, filePath) => {
  if (!filePath || !filePath.startsWith('/workspace/')) return;

  // Since container maps paths starting with /workspace/ to /tmp/workspace/workspace/,
  // we check all potential mapped paths inside the container to ensure cleanup.
  const payload = {
    path: "/workspace/.delete_script.py",
    language: "python",
    content: `import os
import shutil

targets = [
    "${filePath}",
    "${filePath}".replace('/workspace/', '/tmp/workspace/workspace/'),
    os.path.join(os.getcwd(), "${filePath}".split('/')[-1])
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
