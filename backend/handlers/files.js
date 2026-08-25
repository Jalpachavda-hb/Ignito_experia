import path from "path";
import { ok } from "../lib/apigw.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { getSession } from "../services/sessionRepository.js";
import {
  listFiles,
  getFile,
  upsertFile,
  deleteFile,
  cacheFileContent,
} from "../services/fileRepository.js";
import { saveToContainer, deleteFromContainer, readFromContainer, readBinaryFromContainer, renameInContainer } from "../services/containerClient.js";
import { validateFile } from "../utils/validation.js";
import { updateSession } from "../services/sessionRepository.js";

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
  if (!sessionId) throw badRequest("Session ID required (x-session-id header)");
  const session = await getSession(sessionId);
  if (!session) throw notFound("Session not found");
  if (
    event.auth &&
    String(session.userId) !== String(event.auth.userId) &&
    event.auth.role !== "Super Admin"
  ) {
    throw forbidden("You do not own this session");
  }
  return { sessionId, session };
};

export const filesListHandler = async (event) => {
  console.log("[filesListHandler] Request received for session verification and file listing.");
  try {
    const { sessionId } = await assertSessionAccess(event);
    console.log(`[filesListHandler] Session authorized successfully. sessionId: ${sessionId}`);
    const files = await listFiles(sessionId);
    console.log(`[filesListHandler] File list retrieved successfully for sessionId: ${sessionId}. Count: ${files?.length || 0}`);
    // Omit bodies from the tree payload; content is served via /files/content (session-cached)
    const tree = (files || []).map(({ content, ...rest }) => rest);
    return ok({
      files: tree,
    });
  } catch (err) {
    console.error("[filesListHandler] FATAL ERROR:", err.message, err.stack);
    throw err;
  }
};

export const filesContentHandler = async (event) => {
  const { sessionId, session } = await assertSessionAccess(event);
  const filePath = event.queryStringParameters?.path;
  if (!filePath) throw badRequest("path is required");
  const forceFresh = event.queryStringParameters?.fresh === "1" || event.queryStringParameters?.fresh === "true";

  // Serve cached body immediately — container HTTP often fails in local/dev and SSM is slow
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
    });
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
        });
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
  });
};

export const filesSaveHandler = async (event) => {
  const { sessionId, session } = await assertSessionAccess(event);
  const { path: filePath, content, name, language } = event.body || {};
  if (!filePath) throw badRequest("path is required");
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

  if (session?.status === "running") {
    try {
      await saveToContainer(session, { path: filePath, content });
    } catch (err) {
      console.warn("[filesSave] container proxy skipped:", err.message);
    }
  }

  return ok({ message: "File saved successfully" });
};

export const filesDeleteHandler = async (event) => {
  const { sessionId, session } = await assertSessionAccess(event);
  const filePath = event.queryStringParameters?.path;

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
  if (oldPath === newPath) return ok({ message: "No change", oldPath, newPath });

  const sanitize = (p) => String(p).replace(/\\/g, "/");
  const from = sanitize(oldPath);
  const to = sanitize(newPath);

  if (!from.startsWith("/workspace/") || !to.startsWith("/workspace/")) {
    throw badRequest("Paths must be under /workspace/");
  }
  if (to.includes("..") || /\/\/|\/\.|\.$/.test(to)) {
    throw badRequest("Invalid destination path");
  }
  const newName = to.split("/").pop();
  if (!newName || /[<>:"|?*\u0000-\u001f]/.test(newName)) {
    throw badRequest("Invalid file or folder name");
  }

  if (session?.status === "running") {
    await renameInContainer(session, from, to);
  } else {
    throw badRequest("Session is not running");
  }

  // Update cached file paths (files under renamed folder, or the file itself)
  if (session.files?.length) {
    const prefix = from.endsWith("/") ? from : `${from}/`;
    const updated = session.files.map((f) => {
      if (f.path === from) {
        return { ...f, path: to, name: newName };
      }
      if (f.path.startsWith(prefix)) {
        const nextPath = to + f.path.slice(from.length);
        return { ...f, path: nextPath, name: nextPath.split("/").pop() };
      }
      return f;
    });
    await updateSession(sessionId, { files: updated }).catch(() => {});
  }

  return ok({ message: "Renamed successfully", oldPath: from, newPath: to });
};

export const filesDownloadHandler = async (event) => {
  const { sessionId, session } = await assertSessionAccess(event);
  const filePath = event.queryStringParameters?.path;

  if (!filePath) throw badRequest("path query parameter is required");

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
