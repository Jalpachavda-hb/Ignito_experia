import { getSession, updateSession } from "./sessionRepository.js";

const memoryFiles = new Map();

const getFilesMap = () => memoryFiles;

export const listFiles = async (sessionId) => {
  const session = await getSession(sessionId);
  if (session?.files) return session.files;
  return getFilesMap().get(sessionId) || [];
};

export const getFile = async (sessionId, filePath) => {
  const files = await listFiles(sessionId);
  return files.find((f) => f.path === filePath) || null;
};

export const upsertFile = async (sessionId, fileData) => {
  const files = [...(await listFiles(sessionId))];
  const index = files.findIndex((f) => f.path === fileData.path);

  const record = {
    name: fileData.name || fileData.path.split("/").pop(),
    path: fileData.path,
    type: "file",
    content: fileData.content ?? "",
    language: fileData.language || "python",
  };

  if (index >= 0) files[index] = { ...files[index], ...record };
  else files.push(record);

  getFilesMap().set(sessionId, files);
  await updateSession(sessionId, { files }).catch(() => {});
  return record;
};

export const deleteFile = async (sessionId, filePath) => {
  const files = (await listFiles(sessionId)).filter((f) => f.path !== filePath);
  getFilesMap().set(sessionId, files);
  await updateSession(sessionId, { files }).catch(() => {});
};

export const clearSessionFiles = (sessionId) => {
  getFilesMap().delete(sessionId);
};
