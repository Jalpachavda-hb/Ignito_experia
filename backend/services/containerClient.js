import { getContainerPort, getContainerHost } from "../lib/labTools.js";
import { ENV } from "../config/env.js";
import { updateSession } from "./sessionRepository.js";
import { executeCode } from "./ExecutionService.js";
import crypto from "crypto";

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
 * Save file content directly to the ECS container via private HTTP endpoint.
 */
export const saveToContainer = async (session, { path: filePath, content }) => {
  const baseUrl = await getPrivateBaseUrl(session);
  if (!baseUrl) throw new Error("Container unreachable (no host IP resolved)");

  const response = await fetch(`${baseUrl}/save`, {
    method: "POST",
    headers: buildHeaders(session),
    body: JSON.stringify({
      path: filePath,
      content: content !== undefined && content !== null ? String(content) : "",
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Failed to save to container (HTTP ${response.status}): ${errText}`);
  }

  return { proxied: true, method: "http" };
};

/**
 * Delete a file directly from the ECS container via private HTTP endpoint.
 */
export const deleteFromContainer = async (session, filePath) => {
  const baseUrl = await getPrivateBaseUrl(session);
  if (!baseUrl) throw new Error("Container unreachable (no host IP resolved)");

  const url = `${baseUrl}/file?path=${encodeURIComponent(filePath)}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: buildHeaders(session),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Failed to delete from container (HTTP ${response.status}): ${errText}`);
  }
};

/**
 * Read small text file content directly from the ECS container via private HTTP endpoint.
 */
export const readFromContainer = async (session, filePath) => {
  const baseUrl = await getPrivateBaseUrl(session);
  if (!baseUrl) return null;

  try {
    const url = `${baseUrl}/file?path=${encodeURIComponent(filePath)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(session),
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (err) {
    console.warn(`[readFromContainer] Private HTTP request failed:`, err.message);
    return null;
  }
};

export const getFileContentFromContainer = readFromContainer;

/**
 * Download a binary file directly from the ECS container via private HTTP endpoint.
 */
export const readBinaryFromContainer = async (session, filePath) => {
  const baseUrl = await getPrivateBaseUrl(session);
  if (!baseUrl) return null;

  const url = `${baseUrl}/download?path=${encodeURIComponent(filePath)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(session),
  });

  if (!response.ok) {
    console.warn(`[readBinaryFromContainer] Failed to download binary file: HTTP ${response.status}`);
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

/**
 * List files directly from the ECS container via private HTTP endpoint.
 */
export const getFilesFromContainer = async (session) => {
  const baseUrl = await getPrivateBaseUrl(session);
  if (!baseUrl) return [];

  const isAndroid = session?.labType === 'android' || session?.labId === 'android' || session?.labId === 'mobile-app-lab';
  const isDotnet = (session?.labId || "").toLowerCase().includes("dotnet") || (session?.labType || "").toLowerCase() === "dotnet";
  const isDataScience = (session?.labType || "").toLowerCase() === 'datascience' || (session?.labId || "").toLowerCase().includes('datascience') || (session?.labId || "").toLowerCase().includes('jupyter');

  try {
    const response = await fetch(`${baseUrl}/files`, {
      method: "GET",
      headers: buildHeaders(session),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const filesList = await response.json();

    if ((isAndroid || isDotnet || isDataScience) && (!filesList || filesList.length === 0)) {
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
  } catch (err) {
    console.error("[getFilesFromContainer] Error retrieving files:", err.message);
    return [];
  }
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
  } else if (isDataScience) {
    key = "lab-assets/datascience/notebook/latest.tar.gz";
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
