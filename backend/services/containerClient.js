import { getContainerPort, getContainerHost } from "../lib/labTools.js";
import { ENV } from "../config/env.js";
import { executeCode } from "./ExecutionService.js";
import crypto from "crypto";

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

/**
 * Backward compatibility stub mapping execution requests directly to ExecutionService.
 */
export const executeInContainer = async (session, payload, options = {}) => {
  return await executeCode(session, payload, options);
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

  const execRes = await executeInContainer(session, {
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
  const b64 = Buffer.from(content || "").toString("base64");

  const shellScript = `#!/bin/sh
mkdir -p "$(dirname "${containerPath}")"
echo "${b64}" | base64 -d > "${containerPath}"
echo "SUCCESS"
`;

  const execRes = await executeInContainer(session, {
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
  const cleanPath = filePath.replace(/^\/workspace\//, "").replace(/^\/+/, "");
  const containerPath = `/tmp/workspace/workspace/${cleanPath}`;
  const shellScript = `#!/bin/sh\nrm -f "${containerPath}"\necho "SUCCESS"`;

  const execRes = await executeInContainer(session, {
    action: "run",
    path: "/tmp/delete_file.sh",
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
  const cleanPath = filePath.replace(/^\/workspace\//, "").replace(/^\/+/, "");
  const containerPath = `/tmp/workspace/workspace/${cleanPath}`;
  
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

  const execRes = await executeInContainer(session, {
    action: "run",
    path: "/tmp/read_file.sh",
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
      return Buffer.from(b64, "base64").toString("utf-8");
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
  if (baseUrl) {
    try {
      console.log(`[containerClient] Sending POST request to: ${baseUrl}/save`);
      const response = await fetch(`${baseUrl}/save`, {
        method: "POST",
        headers: buildHeaders(session),
        body: JSON.stringify({
          path: filePath,
          content: content !== undefined && content !== null ? String(content) : "",
        }),
      });

      if (response.status === 404) {
        console.warn(`[containerClient] /save endpoint returned HTTP 404 (not implemented yet). Falling back to SSM...`);
      } else if (!response.ok) {
        throw new Error(`Failed to save file to container: HTTP ${response.status}`);
      } else {
        return { proxied: true };
      }
    } catch (err) {
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
  if (baseUrl) {
    try {
      console.log(`[containerClient] Sending DELETE request to: ${baseUrl}/file`);
      const url = `${baseUrl}/file?path=${encodeURIComponent(filePath)}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: buildHeaders(session),
      });

      if (response.status === 404) {
        console.warn(`[containerClient] /file DELETE endpoint returned HTTP 404 (not implemented yet). Falling back to SSM...`);
      } else if (!response.ok) {
        throw new Error(`Failed to delete file from container: HTTP ${response.status}`);
      } else {
        return;
      }
    } catch (err) {
      console.warn(`[containerClient] HTTP delete failed: ${err.message}. Checking SSM fallback...`);
    }
  }
  await deleteSsmFallback(session, filePath);
};

/**
 * Read text file content directly from the ECS container via private HTTP endpoint, or falls back to SSM.
 */
export const readFromContainer = async (session, filePath) => {
  const baseUrl = await getPrivateBaseUrl(session);
  if (baseUrl) {
    try {
      console.log(`[containerClient] Sending GET request to: ${baseUrl}/file`);
      const url = `${baseUrl}/file?path=${encodeURIComponent(filePath)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: buildHeaders(session),
      });

      if (response.status === 404) {
        console.warn(`[containerClient] /file GET endpoint returned HTTP 404 (not implemented yet). Falling back to SSM...`);
      } else if (response.ok) {
        return await response.text();
      } else {
        throw new Error(`Failed to read file from container: HTTP ${response.status}`);
      }
    } catch (err) {
      console.warn(`[containerClient] HTTP read failed: ${err.message}. Checking SSM fallback...`);
    }
  }
  return await readSsmFallback(session, filePath);
};

export const getFileContentFromContainer = readFromContainer;

/**
 * Download a binary file directly from the ECS container via private HTTP endpoint, or falls back to SSM.
 */
export const readBinaryFromContainer = async (session, filePath) => {
  const baseUrl = await getPrivateBaseUrl(session);
  if (baseUrl) {
    try {
      console.log(`[containerClient] Sending GET request to: ${baseUrl}/download`);
      const url = `${baseUrl}/download?path=${encodeURIComponent(filePath)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: buildHeaders(session),
      });

      if (response.status === 404) {
        console.warn(`[containerClient] /download endpoint returned HTTP 404 (not implemented yet). Falling back to SSM...`);
      } else if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } else {
        throw new Error(`Failed to download binary file from container: HTTP ${response.status}`);
      }
    } catch (err) {
      console.warn(`[containerClient] HTTP download failed: ${err.message}. Checking SSM fallback...`);
    }
  }
  const content = await readSsmFallback(session, filePath);
  return content ? Buffer.from(content) : null;
};

/**
 * List files directly from the ECS container via private HTTP endpoint, or falls back to SSM.
 */
export const getFilesFromContainer = async (session) => {
  const baseUrl = await getPrivateBaseUrl(session);
  if (baseUrl) {
    try {
      console.log(`[containerClient] Sending GET request to: ${baseUrl}/files`);
      const response = await fetch(`${baseUrl}/files`, {
        method: "GET",
        headers: buildHeaders(session),
      });

      if (response.status === 404) {
        console.warn(`[containerClient] /files endpoint returned HTTP 404 (not implemented yet). Falling back to SSM...`);
      } else if (response.ok) {
        const filesList = await response.json();
        return filesList || [];
      } else {
        throw new Error(`Failed to fetch files list from container: HTTP ${response.status}`);
      }
    } catch (err) {
      console.warn(`[containerClient] HTTP files request failed: ${err.message}. Checking SSM fallback...`);
    }
  }
  return await getFilesSsmFallback(session);
};

export const getContainerFiles = getFilesFromContainer;
