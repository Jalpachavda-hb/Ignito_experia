import { ok } from "../lib/apigw.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { getSession } from "../services/sessionRepository.js";
import {
  listFiles,
  getFile,
  upsertFile,
  deleteFile,
} from "../services/fileRepository.js";
import { saveToContainer, deleteFromContainer } from "../services/containerClient.js";

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
    session.userId !== event.auth.userId &&
    event.auth.role !== "Super Admin"
  ) {
    throw forbidden("You do not own this session");
  }
  return { sessionId, session };
};

export const filesListHandler = async (event) => {
  const { sessionId } = await assertSessionAccess(event);
  const files = await listFiles(sessionId);
  return ok({
    files: files.map(({ content, ...meta }) => meta),
  });
};

export const filesContentHandler = async (event) => {
  const { sessionId } = await assertSessionAccess(event);
  const filePath = event.queryStringParameters?.path;
  const file = await getFile(sessionId, filePath);
  if (!file) throw notFound("File not found");
  return ok({
    path: file.path,
    content: file.content,
    language: file.language,
  });
};

export const filesSaveHandler = async (event) => {
  const { sessionId, session } = await assertSessionAccess(event);
  const { path: filePath, content, name, language } = event.body || {};
  if (!filePath) throw badRequest("path is required");

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
