import { getContainerPort, getContainerHost } from "../lib/labTools.js";
import { ENV } from "../config/env.js";
import { updateSession } from "./sessionRepository.js";
import { executeCode } from "./ExecutionService.js";
import { executeViaSsm } from "./executeCommandService.js";
import crypto from "crypto";
import path from "path";

const activeS3Bootstraps = new Set();

/**
 * Pure Node.js cryptographic helper to generate S3 presigned URLs without AWS CLI.
 */
export const getPresignedUrl = async (bucket, key, ttlSeconds = 3600) => {
  const region = ENV.awsRegion || "ap-south-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) {
    console.warn("[S3 Presign] AWS credentials not found in env. Falling back to public URL.");
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  try {
    const datetime = new Date().toISOString().replace(/[:-]/g, "").split(".")[0] + "Z";
    const date = datetime.substring(0, 8);
    const host = `${bucket}.s3.${region}.amazonaws.com`;
    const endpoint = `https://${host}/${key}`;

    const service = "s3";
    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${date}/${region}/${service}/aws4_request`;

    const queryParams = {
      "X-Amz-Algorithm": algorithm,
      "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
      "X-Amz-Date": datetime,
      "X-Amz-Expires": ttlSeconds.toString(),
      "X-Amz-SignedHeaders": "host",
    };
    if (sessionToken) {
      queryParams["X-Amz-Security-Token"] = sessionToken;
    }

    const sortedQueryString = Object.keys(queryParams)
      .sort()
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join("&");

    const canonicalRequest = [
      "GET",
      `/${key}`,
      sortedQueryString,
      `host:${host}\n`,
      "host",
      "UNSIGNED-PAYLOAD"
    ].join("\n");

    const hash = crypto.createHash("sha256").update(canonicalRequest).digest("hex");
    const stringToSign = [
      algorithm,
      datetime,
      credentialScope,
      hash
    ].join("\n");

    const hmac = (key, val) => crypto.createHmac("sha256", key).update(val).digest();
    const kDate = hmac(`AWS4${secretAccessKey}`, date);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, "aws4_request");
    const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");

    return `${endpoint}?${sortedQueryString}&X-Amz-Signature=${signature}`;
  } catch (err) {
    console.error("[S3 Presign] Failed to generate presigned URL:", err.message);
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }
};

/**
 * Resolves the private runtime base URL for direct HTTP VPC communication.
 */
const getPrivateBaseUrl = async (session) => {
  const host = getContainerHost(session);
  if (!host) return null;
  const port = (await getContainerPort(session.labId)) || session.containerPort || 8080;
  return `http://${host}:${port}`;
};

/** Fail fast when the container HTTP endpoint is unreachable (common in local/dev). */
const CONTAINER_HTTP_TIMEOUT_MS = Number(process.env.CONTAINER_HTTP_TIMEOUT_MS || 2000);
const HTTP_FAIL_THRESHOLD = 2;
const HTTP_CIRCUIT_COOLDOWN_MS = Number(process.env.CONTAINER_HTTP_CIRCUIT_MS || 5 * 60 * 1000);
let httpFailCount = 0;
let httpCircuitOpenUntil = 0;

const shouldAttemptHttp = () => {
  if (process.env.CONTAINER_HTTP_ENABLED === "false") return false;
  return Date.now() >= httpCircuitOpenUntil;
};

const recordHttpSuccess = () => {
  httpFailCount = 0;
  httpCircuitOpenUntil = 0;
};

const recordHttpFailure = () => {
  httpFailCount += 1;
  if (httpFailCount >= HTTP_FAIL_THRESHOLD && Date.now() >= httpCircuitOpenUntil) {
    httpCircuitOpenUntil = Date.now() + HTTP_CIRCUIT_COOLDOWN_MS;
    console.warn(
      `[containerClient] Container HTTP unreachable — skipping HTTP for ${Math.round(HTTP_CIRCUIT_COOLDOWN_MS / 1000)}s (using SSM).`,
    );
  }
};

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONTAINER_HTTP_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Container HTTP timed out after ${CONTAINER_HTTP_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Build request headers.
 */
const buildHeaders = (session) => {
  const headers = { "Content-Type": "application/json" };
  if (session?.sessionToken) {
    headers["X-Session-Token"] = session.sessionToken;
  }
  return headers;
};

/* --- SSM FALLBACK HELPERS --- */

const getFilesSsmFallback = async (session) => {
  console.log(`[containerClient] Running SSM-based files listing fallback for session: ${session.sessionId}`);
  const pythonScript = `import os
import json

workspace = "/tmp/workspace/workspace"
result = []
if os.path.exists(workspace):
    for root, dirs, files in os.walk(workspace):
        dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '.gradle', '.idea', '__pycache__', 'tmp']]
        for f in files:
            if f.endswith('.pyc') or f.endswith('.class') or f == '.DS_Store':
                continue
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, workspace).replace('\\\\', '/')
            result.append({
                "name": f,
                "path": "/workspace/" + rel_path,
                "type": "file"
            })

print("---FILES_START---" + json.dumps(result) + "---FILES_END---")
`;

  const shellScript = `#!/bin/sh
cat << 'EOF' > /tmp/list_files.py
${pythonScript}
EOF
python3 /tmp/list_files.py
`;

  const execRes = await executeViaSsm(session, {
    action: "run",
    path: "/tmp/list_files.sh",
    language: "shell",
    labType: "linux",
    content: shellScript,
  });

  if (execRes && execRes.success) {
    const output = execRes.output || "";
    const startIdx = output.indexOf("---FILES_START---");
    const endIdx = output.indexOf("---FILES_END---");
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const jsonStr = output.substring(startIdx + 17, endIdx).trim();
      return JSON.parse(jsonStr);
    }
  }
  return [];
};

const saveSsmFallback = async (session, filePath, content) => {
  console.log(`[containerClient] Running SSM-based save fallback for file: ${filePath}`);
  const cleanPath = filePath.replace(/^\/workspace\//, "").replace(/^\/+/, "");
  const containerPath = `/tmp/workspace/workspace/${cleanPath}`;
  const containerDir = path.dirname(containerPath).replace(/\\/g, "/");
  const b64 = Buffer.from(content || "").toString("base64");

  const shellScript = `#!/bin/sh
mkdir -p "${containerDir}"
echo "${b64}" | base64 -d > "${containerPath}"
echo "SUCCESS"
`;

  const execRes = await executeViaSsm(session, {
    action: "run",
    path: "/tmp/save_file.sh",
    language: "shell",
    labType: "linux",
    content: shellScript,
  });

  if (!execRes || !execRes.success || !execRes.output.includes("SUCCESS")) {
    throw new Error(`Failed to save file via SSM fallback: ${execRes?.error || execRes?.output}`);
  }
  return { proxied: true };
};

const deleteSsmFallback = async (session, filePath) => {
  console.log(`[containerClient] Running SSM-based delete fallback for file: ${filePath}`);
  let containerPath = filePath;
  if (!filePath.startsWith("/tmp/workspace/workspace/")) {
    const cleanPath = filePath.replace(/^\/workspace\//, "").replace(/^\/+/, "");
    containerPath = `/tmp/workspace/workspace/${cleanPath}`;
  }
  const shellScript = `#!/bin/sh\nrm -f "${containerPath}"\necho "SUCCESS"`;

  const execRes = await executeViaSsm(session, {
    action: "run",
    path: "/workspace/.vlab_tmp/delete_file.sh",
    language: "shell",
    labType: "linux",
    content: shellScript,
  });

  if (!execRes || !execRes.success || !execRes.output.includes("SUCCESS")) {
    throw new Error(`Failed to delete file via SSM fallback: ${execRes?.error}`);
  }
};

const readSsmFallback = async (session, filePath) => {
  console.log(`[containerClient] Running SSM-based read fallback for file: ${filePath}`);
  let containerPath = filePath;
  if (!filePath.startsWith("/tmp/workspace/workspace/")) {
    const cleanPath = filePath.replace(/^\/workspace\//, "").replace(/^\/+/, "");
    containerPath = `/tmp/workspace/workspace/${cleanPath}`;
  }
  
  const shellScript = `#!/bin/sh
target="${containerPath}"
if [ -f "$target" ]; then
    echo "###START###"
    cat "$target" | base64
    echo "###END###"
else
    echo "###NOT_FOUND###"
fi
`;

  const execRes = await executeViaSsm(session, {
    action: "run",
    path: "/workspace/.vlab_tmp/read_file.sh",
    language: "shell",
    labType: "linux",
    content: shellScript,
  });

  if (execRes && execRes.success) {
    const output = execRes.output || "";
    if (output.includes("###NOT_FOUND###")) return null;
    const startIdx = output.indexOf("###START###");
    const endIdx = output.indexOf("###END###");
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const b64 = output.substring(startIdx + 11, endIdx).trim().replace(/\s/g, "");
      return Buffer.from(b64, "base64");
    }
  }
  return null;
};

/* --- CONTAINER EXPORTS --- */

/**
 * Save file content directly to the ECS container via private HTTP endpoint, or falls back to SSM.
 */
export const saveToContainer = async (session, { path: filePath, content }) => {
  const baseUrl = await getPrivateBaseUrl(session);
  if (baseUrl && shouldAttemptHttp()) {
    try {
      console.log(`[containerClient] Sending POST request to: ${baseUrl}/save`);
      const response = await fetchWithTimeout(`${baseUrl}/save`, {
        method: "POST",
        headers: buildHeaders(session),
        body: JSON.stringify({
          path: filePath,
          content: content !== undefined && content !== null ? String(content) : "",
        }),
      });

      if (response.status === 404) {
        console.warn(`[containerClient] /save endpoint returned HTTP 404 (not implemented yet). Falling back to SSM...`);
        recordHttpFailure();
      } else if (!response.ok) {
        throw new Error(`Failed to save file to container: HTTP ${response.status}`);
      } else {
        recordHttpSuccess();
        return { proxied: true };
      }
    } catch (err) {
      recordHttpFailure();
      console.warn(`[containerClient] HTTP save failed: ${err.message}. Checking SSM fallback...`);
    }
  }
  return await saveSsmFallback(session, filePath, content);
};

/**
 * Delete a file directly from the ECS container via private HTTP endpoint, or falls back to SSM.
 */
export const deleteFromContainer = async (session, filePath) => {
  const baseUrl = await getPrivateBaseUrl(session);
  if (baseUrl && shouldAttemptHttp()) {
    try {
      console.log(`[containerClient] Sending DELETE request to: ${baseUrl}/file`);
      const url = `${baseUrl}/file?path=${encodeURIComponent(filePath)}`;
      const response = await fetchWithTimeout(url, {
        method: "DELETE",
        headers: buildHeaders(session),
      });

      if (response.status === 404) {
        console.warn(`[containerClient] /file DELETE endpoint returned HTTP 404 (not implemented yet). Falling back to SSM...`);
        recordHttpFailure();
      } else if (!response.ok) {
        throw new Error(`Failed to delete file from container: HTTP ${response.status}`);
      } else {
        recordHttpSuccess();
        return;
      }
    } catch (err) {
      recordHttpFailure();
      console.warn(`[containerClient] HTTP delete failed: ${err.message}. Checking SSM fallback...`);
    }
  }
  await deleteSsmFallback(session, filePath);
};

/**
 * Rename/move a file or folder inside the container workspace.
 * Paths are /workspace/... style from the IDE.
 */
export const renameInContainer = async (session, oldPath, newPath) => {
  const toContainerPath = (p) => {
    if (p.startsWith("/tmp/workspace/workspace/")) return p;
    const clean = String(p || "").replace(/^\/workspace\//, "").replace(/^\/+/, "");
    return `/tmp/workspace/workspace/${clean}`;
  };

  const src = toContainerPath(oldPath);
  const dest = toContainerPath(newPath);
  const destDir = path.dirname(dest).replace(/\\/g, "/");

  const shellScript = `#!/bin/sh
set -e
SRC="${src}"
DEST="${dest}"
if [ ! -e "$SRC" ]; then
  echo "SOURCE_MISSING"
  exit 1
fi
if [ -e "$DEST" ]; then
  echo "DEST_EXISTS"
  exit 1
fi
mkdir -p "${destDir}"
mv "$SRC" "$DEST"
echo "SUCCESS"
`;

  const baseUrl = await getPrivateBaseUrl(session);
  if (baseUrl && shouldAttemptHttp()) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/execute`, {
        method: "POST",
        headers: buildHeaders(session),
        body: JSON.stringify({
          path: "/workspace/.vlab_tmp/rename_path.sh",
          content: shellScript,
          language: "shell",
          labType: "linux",
          sessionId: session.sessionId,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const output = data.output || "";
        if (output.includes("SUCCESS")) {
          recordHttpSuccess();
          return { success: true };
        }
        if (output.includes("SOURCE_MISSING")) throw new Error("Source path not found");
        if (output.includes("DEST_EXISTS")) throw new Error("A file or folder with that name already exists");
        if (data.success === false) throw new Error(data.error || output || "Rename failed");
        recordHttpSuccess();
        return { success: true };
      }
      recordHttpFailure();
    } catch (err) {
      if (!/Source path not found|already exists/i.test(err.message)) recordHttpFailure();
      console.warn(`[containerClient] HTTP rename failed: ${err.message}. Falling back to SSM...`);
      if (/Source path not found|already exists/i.test(err.message)) throw err;
    }
  }

  const execRes = await executeViaSsm(session, {
    action: "run",
    path: "/workspace/.vlab_tmp/rename_path.sh",
    language: "shell",
    labType: "linux",
    content: shellScript,
  });
  const output = execRes?.output || "";
  if (output.includes("SUCCESS")) return { success: true };
  if (output.includes("SOURCE_MISSING")) throw new Error("Source path not found");
  if (output.includes("DEST_EXISTS")) throw new Error("A file or folder with that name already exists");
  throw new Error(execRes?.error || output || "Rename failed via SSM");
};

/**
 * Read text file content directly from the ECS container via private HTTP endpoint, or falls back to SSM.
 */
export const readFromContainer = async (session, filePath) => {
  const baseUrl = await getPrivateBaseUrl(session);
  if (baseUrl && shouldAttemptHttp()) {
    try {
      console.log(`[containerClient] Sending GET request to: ${baseUrl}/file`);
      const url = `${baseUrl}/file?path=${encodeURIComponent(filePath)}`;
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers: buildHeaders(session),
      });

      if (response.status === 404) {
        console.warn(`[containerClient] /file GET endpoint returned HTTP 404 (not implemented yet). Falling back to SSM...`);
        recordHttpFailure();
      } else if (response.ok) {
        recordHttpSuccess();
        return await response.text();
      } else {
        throw new Error(`Failed to read file from container: HTTP ${response.status}`);
      }
    } catch (err) {
      recordHttpFailure();
      console.warn(`[containerClient] HTTP read failed: ${err.message}. Checking SSM fallback...`);
    }
  }
  const buffer = await readSsmFallback(session, filePath);
  return buffer ? buffer.toString("utf-8") : null;
};

export const getFileContentFromContainer = readFromContainer;

/**
 * Download a binary file directly from the ECS container via private HTTP endpoint, or falls back to SSM.
 */
export const readBinaryFromContainer = async (session, filePath) => {
  const baseUrl = await getPrivateBaseUrl(session);
  if (baseUrl && shouldAttemptHttp()) {
    try {
      console.log(`[containerClient] Sending GET request to: ${baseUrl}/download`);
      const url = `${baseUrl}/download?path=${encodeURIComponent(filePath)}`;
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers: buildHeaders(session),
      });

      if (response.status === 404) {
        console.warn(`[containerClient] /download endpoint returned HTTP 404 (not implemented yet). Falling back to SSM...`);
        recordHttpFailure();
      } else if (response.ok) {
        recordHttpSuccess();
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } else {
        throw new Error(`Failed to download binary file from container: HTTP ${response.status}`);
      }
    } catch (err) {
      recordHttpFailure();
      console.warn(`[containerClient] HTTP download failed: ${err.message}. Checking SSM fallback...`);
    }
  }
  return await readSsmFallback(session, filePath);
};

/**
 * List files directly from the ECS container via private HTTP endpoint, or falls back to SSM.
 */
export const getFilesFromContainer = async (session) => {
  const baseUrl = await getPrivateBaseUrl(session);
  const isAndroid = session?.labType === 'android' || session?.labId === 'android' || session?.labId === 'mobile-app-lab';
  const isDotnet = (session?.labId || "").toLowerCase().includes("dotnet") || (session?.labType || "").toLowerCase() === "dotnet";
  const isDataScience = (session?.labType || "").toLowerCase() === 'datascience' || (session?.labId || "").toLowerCase().includes('datascience') || (session?.labId || "").toLowerCase().includes('jupyter');

  if (baseUrl && shouldAttemptHttp()) {
    try {
      console.log(`[containerClient] Sending GET request to: ${baseUrl}/files`);
      const response = await fetchWithTimeout(`${baseUrl}/files`, {
        method: "GET",
        headers: buildHeaders(session),
      });

      if (response.status === 404) {
        console.warn(`[containerClient] /files endpoint returned HTTP 404 (not implemented yet). Falling back to SSM...`);
        recordHttpFailure();
      } else if (response.ok) {
        recordHttpSuccess();
        const filesList = await response.json();
        if ((isAndroid || isDotnet) && (!filesList || filesList.length === 0)) {
          if (!activeS3Bootstraps.has(session.sessionId)) {
            activeS3Bootstraps.add(session.sessionId);
            console.log(`[getFilesFromContainer] Workspace empty. Triggering S3 bootstrap for session ${session.sessionId}...`);
            try {
              await bootstrapWorkspaceFromS3(session);
              return await getFilesFromContainer(session);
            } catch (err) {
              console.error("[getFilesFromContainer] S3 bootstrap failed:", err.message);
            } finally {
              activeS3Bootstraps.delete(session.sessionId);
            }
          }
        }
        return filesList || [];
      } else {
        throw new Error(`Failed to fetch files list from container: HTTP ${response.status}`);
      }
    } catch (err) {
      recordHttpFailure();
      console.warn(`[containerClient] HTTP files request failed: ${err.message}. Checking SSM fallback...`);
    }
  }
  return await getFilesSsmFallback(session);
};

export const getContainerFiles = getFilesFromContainer;

/**
 * Triggers workspace extraction from S3 directly inside the container runtime.
 */
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
    key = "lab-assets/android/starter/latest.tar.gz";
  } else if (isDotnet) {
    let isMvc = false;
    if (session?.dotnetSubtype) {
      isMvc = session.dotnetSubtype === "mvc";
    } else {
      isMvc = labId.includes("mvc") || labId.includes("mvc-app") || labType.includes("mvc");
    }
    key = isMvc ? "lab-assets/dotnet/mvc/latest.tar.gz" : "lab-assets/dotnet/console-snippet/latest.tar.gz";
  } else {
    console.log(`[bootstrapWorkspaceFromS3] Lab ${labId} does not require S3 bootstrapping.`);
    return null;
  }

  console.log(`[bootstrapWorkspaceFromS3] Generating presigned URL for s3://${bucket}/${key}...`);
  try {
    const presignedUrl = await getPresignedUrl(bucket, key, ttl);

    // Download and extract inside container via a python process executed inside the container
    const pythonScript = `import urllib.request
import tarfile
import os

presigned_url = "${presignedUrl}"
dest_dir = "/tmp/workspace/workspace"
tmp_tar = "/tmp/bootstrap.tar.gz"

try:
    os.makedirs(dest_dir, exist_ok=True)
    urllib.request.urlretrieve(presigned_url, tmp_tar)
    with tarfile.open(tmp_tar, "r:gz") as tar:
        tar.extractall(path=dest_dir)
    if os.path.exists(tmp_tar):
        os.remove(tmp_tar)
    
    for filename in ["gradlew", "build.sh"]:
        filepath = os.path.join(dest_dir, filename)
        if os.path.exists(filepath):
            try:
                with open(filepath, "rb") as f:
                    content = f.read()
                content = content.replace(b"\\r\\n", b"\\n")
                with open(filepath, "wb") as f:
                    f.write(content)
            except Exception as e:
                print("CLEAN_ERR:", str(e))
            os.chmod(filepath, 0o755)
    print("SUCCESS")
except Exception as e:
    print("ERROR:", str(e))
`;
    const payload = {
      action: "run",
      path: "/tmp/bootstrap.py",
      language: "python",
      content: pythonScript
    };

    console.log(`[bootstrapWorkspaceFromS3] Executing bootstrap sync inside container...`);
    const result = await executeCode(session, payload);
    console.log(`[bootstrapWorkspaceFromS3] Container bootstrap outcome:`, result?.output || 'No output');

    return { success: result?.success || false };
  } catch (err) {
    console.error(`[bootstrapWorkspaceFromS3] Failed to bootstrap workspace:`, err.message);
    throw err;
  }
};

/**
 * Backward compatibility stub mapping execution requests directly to ExecutionService.
 */
export const executeInContainer = async (session, payload, options = {}) => {
  return await executeCode(session, payload, options);
};
