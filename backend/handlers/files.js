import path from "path";
import { ok } from "../lib/apigw.js";
import { badRequest, notFound } from "../lib/errors.js";
import { authorizeLabSession } from "../lib/sessionAccess.js";
import { toWorkspacePath } from "../lib/workspacePath.js";
import {
  listFiles,
  listFilesShared,
  getFile,
  upsertFile,
  deleteFile,
  renameFile,
  cacheFileContent,
} from "../services/fileRepository.js";
import { saveToContainer, deleteFromContainer, readFromContainer, readBinaryFromContainer, renameInContainer } from "../services/containerClient.js";
import { validateFile } from "../utils/validation.js";
import { updateSession } from "../services/sessionRepository.js";
import userWorkspaceService from "../services/UserWorkspaceService.js";

const languageFromPath = (filePath) => {
  if (filePath.endsWith(".py")) return "python";
  if (filePath.endsWith(".js") || filePath.endsWith(".jsx")) return "javascript";
  if (filePath.endsWith(".java")) return "java";
  if (filePath.endsWith(".cshtml") || filePath.endsWith(".razor")) return "razor";
  if (filePath.endsWith(".cs")) return "csharp";
  if (filePath.endsWith(".html")) return "html";
  if (filePath.endsWith(".css")) return "css";
  if (filePath.endsWith(".json")) return "json";
  if (filePath.endsWith(".xml")) return "xml";
  if (filePath.endsWith(".sh")) return "shell";
  return "plaintext";
};

const getSessionId = (event) =>
  event.headers?.["x-session-id"] ||
  event.queryStringParameters?.sessionId ||
  event.body?.sessionId;

const assertSessionAccess = async (event) => {
  const sessionId = getSessionId(event);
  const { session } = await authorizeLabSession(event.auth, sessionId);
  if (!session) throw notFound("Session not found");
  return { sessionId, session };
};

const requireWorkspacePath = (filePath) => toWorkspacePath(filePath).workspacePath;

const FILES_LIST_TIMEOUT_MS = Number(process.env.FILES_LIST_TIMEOUT_MS || 20000);
const LIST_TIMED_OUT = Symbol("list-timed-out");

export const filesListHandler = async (event) => {
  const NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  };
  const { sessionId, session } = await assertSessionAccess(event);
  const bootstrapState = String(session?.bootstrapState || (session?.taskArn ? "NOT_STARTED" : "READY")).toUpperCase();

  // Bounded wait: the container/SSM listing can take minutes when the runtime is slow. The
  // lookup keeps running in the background (and fills the cache); the request returns in time.
  let timer;
  const shared = listFilesShared(sessionId);
  const outcome = await Promise.race([
    shared,
    new Promise((resolve) => { timer = setTimeout(() => resolve(LIST_TIMED_OUT), FILES_LIST_TIMEOUT_MS); }),
  ]).catch((err) => ({ error: err })).finally(() => clearTimeout(timer));
  if (outcome === LIST_TIMED_OUT) shared.catch(() => {});

  const strip = (list) => (list || []).map(({ content, ...rest }) => rest);

  if (outcome === LIST_TIMED_OUT || outcome?.error) {
    const cached = session?.files;
    if (cached?.length) {
      return ok({ files: strip(cached), stale: true, ready: bootstrapState === "READY", bootstrapState }, 200, NO_CACHE_HEADERS);
    }
    const reason = outcome === LIST_TIMED_OUT ? "The lab workspace is still loading." : (outcome.error?.message || "Could not read the lab workspace.");
    console.warn(`[filesListHandler] list ${outcome === LIST_TIMED_OUT ? "timed out" : "failed"} for session ${sessionId}: ${reason}`);
    return {
      statusCode: 503,
      headers: { ...NO_CACHE_HEADERS, "Retry-After": "3" },
      body: { success: false, retryable: true, code: outcome === LIST_TIMED_OUT ? "WORKSPACE_LOADING" : "WORKSPACE_LIST_FAILED", message: reason, bootstrapState },
    };
  }

  // Omit bodies from the tree payload; content is served via /files/content
  return ok({
    files: strip(outcome),
    ready: bootstrapState === "READY",
    bootstrapState,
  }, 200, NO_CACHE_HEADERS);
};

export const filesContentHandler = async (event) => {
  const { sessionId, session } = await assertSessionAccess(event);
  const filePath = requireWorkspacePath(event.queryStringParameters?.path);
  const forceFresh = event.queryStringParameters?.fresh === "1" || event.queryStringParameters?.fresh === "true";

  const NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  };

  const labId = (session?.labId || "").toLowerCase();
  const labType = (session?.labType || "").toLowerCase();
  const isDotnet = labType === "dotnet" || labId === "dotnet-lab" || labId.includes("dotnet");

  // Serve cached body immediately only if fresh was not explicitly requested
  const cached = session?.files?.find((f) => f.path === filePath);
  const suspiciousEmptyXml =
    typeof cached?.content === "string" &&
    cached.content.trim() === "" &&
    /\/res\/.+\.xml$/i.test(filePath || "");
  if (!forceFresh && cached && typeof cached.content === "string" && !suspiciousEmptyXml) {
    return ok({
      path: filePath,
      content: cached.content,
      language: cached.language || languageFromPath(filePath),
    }, 200, NO_CACHE_HEADERS);
  }

  if (session?.status === "running") {
    try {
      const containerContent = await readFromContainer(session, filePath);
      if (containerContent !== null) {
        const language = languageFromPath(filePath);
        cacheFileContent(sessionId, {
          path: filePath,
          content: containerContent,
          language,
        }).catch(() => {});
        return ok({
          path: filePath,
          content: containerContent,
          language,
        }, 200, NO_CACHE_HEADERS);
      }
    } catch (err) {
      console.warn("[filesContentHandler] Failed to read container file content:", err.message);
    }
  }

  // Use fileRepository getFile which utilizes fast in-memory fileContentCache (< 1ms)!
  const file = await getFile(sessionId, filePath);
  if (!file) throw notFound("File not found");

  return ok({
    path: file.path,
    content: file.content ?? "",
    language: file.language,
  }, 200, NO_CACHE_HEADERS);
};

export const filesSaveHandler = async (event) => {
  const { sessionId, session } = await assertSessionAccess(event);
  const { path: rawPath, content, name, language } = event.body || {};
  const filePath = requireWorkspacePath(rawPath);
  if (content === undefined || content === null) {
    throw badRequest("content is required (refusing to overwrite with undefined)");
  }
  // Empty Android resource XML breaks Gradle with "Premature end of file"
  if (
    typeof content === "string" &&
    content.trim() === "" &&
    /\/res\/.+\.xml$/i.test(filePath)
  ) {
    throw badRequest(
      "Refusing to save empty Android resource XML (this breaks the build). Open the file, restore its content, then save."
    );
  }

  // Enforce runtime-specific validation before saving/uploading
  const validation = validateFile(filePath, content, session?.labType || session?.labId);
  if (!validation.valid) {
    throw badRequest(validation.error);
  }

  await upsertFile(sessionId, { path: filePath, content, name, language });
  return ok({ message: "File saved successfully" });
};

export const filesDeleteHandler = async (event) => {
  const { sessionId, session } = await assertSessionAccess(event);
  const filePath = requireWorkspacePath(event.queryStringParameters?.path);

  console.log(`[filesDeleteHandler] Deleting file: sessionId=${sessionId}, filePath=${filePath}`);

  try {
    await deleteFile(sessionId, filePath);
  } catch (e) {
    console.warn("deleteFile error (ignoring):", e.message);
  }

  if (session?.status === "running") {
    try {
      await deleteFromContainer(session, filePath);
    } catch (err) {
      console.warn("[filesDelete] container proxy skipped:", err.message);
    }
  }

  return ok({ message: "File deleted successfully" });
};

export const filesRenameHandler = async (event) => {
  const { sessionId, session } = await assertSessionAccess(event);
  const { oldPath, newPath } = event.body || {};

  if (!oldPath || !newPath) throw badRequest("oldPath and newPath are required");
  const from = requireWorkspacePath(oldPath);
  const to = requireWorkspacePath(newPath);
  if (from === to) return ok({ message: "No change", oldPath: from, newPath: to });
  const newName = to.split("/").pop();
  if (!newName || /[<>:"|?*\u0000-\u001f]/.test(newName)) {
    throw badRequest("Invalid file or folder name");
  }

  if (session?.status !== "running") {
    throw badRequest("Session is not running");
  }

  const updatedFiles = await renameFile(sessionId, from, to);

  return ok({ message: "Renamed successfully", oldPath: from, newPath: to, files: updatedFiles });
};

export const filesDownloadHandler = async (event) => {
  const { sessionId, session } = await assertSessionAccess(event);
  const filePath = requireWorkspacePath(event.queryStringParameters?.path);

  if (session?.status === "running") {
    try {
      const buffer = await readBinaryFromContainer(session, filePath);
      if (buffer) {
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${path.basename(filePath)}"`,
            "Content-Length": buffer.length.toString(),
            "Access-Control-Allow-Origin": "*",
          },
          body: buffer,
        };
      }
    } catch (err) {
      console.warn("[filesDownloadHandler] Failed to download container file:", err.message);
    }
  }
  throw notFound("File not found or session not running");
};
