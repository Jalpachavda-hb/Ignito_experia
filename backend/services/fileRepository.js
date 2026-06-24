import { getSession, updateSession } from "./sessionRepository.js";
import {
  getFilesFromContainer,
  getFileContentFromContainer,
  saveToContainer,
  deleteFromContainer
} from "./containerClient.js";
import { getAllowedExtensions } from "../lib/labTypeMapper.js";

const memoryFiles = new Map();

const getFilesMap = () => memoryFiles;

export const listFiles = async (sessionId) => {
  const session = await getSession(sessionId);
  if (session?.status === "running") {
    let files = await getFilesFromContainer(session);
    if (files && files.length > 0) {
      const allowedExtensions = getAllowedExtensions(session.labId);
      files = files.filter(f => {
        const ext = f.path.split(".").pop()?.toLowerCase();
        return ext && allowedExtensions.includes(ext);
      });
      await updateSession(sessionId, { files }).catch(() => {});
    }
    return files || [];
  }
  if (session?.files) return session.files;
  return getFilesMap().get(sessionId) || [];
};

export const getFile = async (sessionId, filePath) => {
  const session = await getSession(sessionId);
  if (session?.status === "running") {
    const content = await getFileContentFromContainer(session, filePath);
    const name = filePath.split("/").pop();
    // Detect language from file extension
    const ext = name.split(".").pop() || "";
    let language = "python";
    if (["js", "jsx"].includes(ext)) language = "javascript";
    else if (ext === "java") language = "java";
    else if (ext === "sh") language = "shell";
    else if (ext === "gradle") language = "groovy";
    else if (ext === "properties") language = "properties";
    else if (ext === "xml") language = "xml";
    else if (ext === "json") language = "json";
    else if (ext === "html") language = "html";
    else if (ext === "css") language = "css";
    else if (["md", "txt", "csv", "log"].includes(ext)) language = ext === "md" ? "markdown" : "text";

    return {
      name,
      path: filePath,
      type: "file",
      content,
      language
    };
  }
  const files = await listFiles(sessionId);
  return files.find((f) => f.path === filePath) || null;
};

export const upsertFile = async (sessionId, fileData) => {
  const session = await getSession(sessionId);
  
  const record = {
    name: fileData.name || fileData.path.split("/").pop(),
    path: fileData.path,
    type: "file",
    content: fileData.content ?? "",
    language: fileData.language || "python",
  };

  if (session?.status === "running") {
    await saveToContainer(session, { path: fileData.path, content: fileData.content ?? "" });
    // Keep local session DB updated with files list without duplicating file contents
    const files = await getFilesFromContainer(session);
    await updateSession(sessionId, { files }).catch(() => {});
    return record;
  }

  const files = [...(await listFiles(sessionId))];
  const index = files.findIndex((f) => f.path === fileData.path);

  if (index >= 0) files[index] = { ...files[index], ...record };
  else files.push(record);

  getFilesMap().set(sessionId, files);
  await updateSession(sessionId, { files }).catch(() => {});
  return record;
};

export const deleteFile = async (sessionId, filePath) => {
  const session = await getSession(sessionId);
  if (session?.status === "running") {
    await deleteFromContainer(session, filePath);
    const files = await getFilesFromContainer(session);
    await updateSession(sessionId, { files }).catch(() => {});
    return;
  }
  const files = (await listFiles(sessionId)).filter((f) => f.path !== filePath);
  getFilesMap().set(sessionId, files);
  await updateSession(sessionId, { files }).catch(() => {});
};

export const clearSessionFiles = (sessionId) => {
  getFilesMap().delete(sessionId);
};
