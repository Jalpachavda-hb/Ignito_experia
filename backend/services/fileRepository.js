import fs from "fs";
import path from "path";
import { getSession, updateSession } from "./sessionRepository.js";
import {
  getFilesFromContainer,
  getFileContentFromContainer,
  saveToContainer,
  deleteFromContainer
} from "./containerClient.js";
import { getAllowedExtensions } from "../lib/labTypeMapper.js";

// Dynamically resolve the parent directory of backend as the local workspace root
const getLocalWorkspaceRoot = () => {
  if (process.env.LAB_WORKSPACE) {
    return path.join(process.env.LAB_WORKSPACE, "workspace");
  }
  return path.resolve(process.cwd(), "..");
};

const getLocalFilePath = (filePath) => {
  const cleanPath = filePath.replace(/^\/workspace\//, "").replace(/^\/+/, "");
  return path.join(getLocalWorkspaceRoot(), cleanPath);
};

const scanLocalFiles = (dir, baseDir = dir) => {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  
  let list;
  try {
    list = fs.readdirSync(dir);
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
    return results;
  }

  // Repo-level folders that must never appear as student lab workspace files.
  const ignored = [
    ".git",
    "node_modules",
    "backend",
    "vlab_admin",
    "ignito_Experia_Main_Dashboard",
    "ignito_experia_main_dashboard",
    "__pycache__",
    ".gradle",
    "intermediates",
    "generated",
    "tmp",
    "kotlin",
    ".tanstack",
  ];

  for (const file of list) {
    if (ignored.includes(file)) continue;
    const fullPath = path.join(dir, file);
    
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }

    if (stat.isDirectory()) {
      results = results.concat(scanLocalFiles(fullPath, baseDir));
    } else {
      const relPath = "/workspace/" + path.relative(baseDir, fullPath).replace(/\\/g, "/");
      const ext = file.split(".").pop()?.toLowerCase();
      
      let language = "plaintext";
      if (ext === "py") language = "python";
      else if (ext === "java") language = "java";
      else if (ext === "cs") language = "csharp";
      else if (ext === "cshtml") language = "razor";
      else if (ext === "sh") language = "shell";
      else if (ext === "json") language = "json";
      else if (ext === "html") language = "html";
      else if (ext === "css") language = "css";
      else if (ext === "xml") language = "xml";
      else if (ext === "gradle") language = "groovy";
      else if (ext === "properties") language = "properties";

      results.push({
        name: file,
        path: relPath, // e.g. /workspace/filename.py
        type: "file",
        language,
      });
    }
  }
  return results;
};

export const listFiles = async (sessionId) => {
  const session = await getSession(sessionId);

  // If the file tree is already cached, return it instantly!
  if (session?.files && session.files.length > 0) {
    return session.files;
  }

  const hasLiveContainer =
    session?.status === "running" &&
    Boolean(session.taskArn || session.apiBaseUrl);

  // Running ECS lab sessions must list the container workspace, not the dev machine repo.
  if (hasLiveContainer) {
    try {
      const files = await getFilesFromContainer(session);
      const result = files || [];
      if (result.length > 0) {
        const dbFiles = result.map(({ content, ...rest }) => rest);
        await updateSession(sessionId, { files: dbFiles }).catch(() => {});
      }
      return result;
    } catch (err) {
      console.error("[listFiles] Container list failed:", err.message);
      if (session.files?.length) return session.files;
      return [];
    }
  }

  // Local disk fallback only for mock/offline sessions without an ECS task.
  if (!session?.taskArn) {
    const root = getLocalWorkspaceRoot();
    if (fs.existsSync(root)) {
      try {
        const scanned = scanLocalFiles(root);
        if (scanned?.length > 0) {
          return scanned;
        }
      } catch (err) {
        console.error("[listFiles] Local scan error:", err.message);
      }
    }
  }

  if (session?.files) return session.files;
  return [];
};

export const getFile = async (sessionId, filePath) => {
  const session = await getSession(sessionId);
  if (session?.status === "running") {
    try {
      const content = await getFileContentFromContainer(session, filePath);
      const name = filePath.split("/").pop();
      // Detect language from file extension
      const ext = name.split(".").pop() || "";
      let language = "python";
      if (["js", "jsx"].includes(ext)) language = "javascript";
      else if (ext === "java") language = "java";
      else if (ext === "cs") language = "csharp";
      else if (ext === "cshtml") language = "razor";
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
    } catch (err) {
      console.warn("[getFile] Failed to read container file content, using DB cache fallback:", err.message);
    }
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
    try {
      await saveToContainer(session, { path: fileData.path, content: fileData.content ?? "" });
    } catch (err) {
      console.warn("[upsertFile] Failed to save to container:", err.message);
    }
    // Update local files cache list with full content to keep cache working
    const files = session.files ? [...session.files] : [];
    const index = files.findIndex((f) => f.path === fileData.path);
    if (index >= 0) {
      files[index] = { ...files[index], ...record };
    } else {
      files.push(record);
    }
    await updateSession(sessionId, { files }).catch(() => {});
    return record;
  }

  const files = [...(await listFiles(sessionId))];
  const index = files.findIndex((f) => f.path === fileData.path);

  if (index >= 0) files[index] = { ...files[index], ...record };
  else files.push(record);

  return record;
};

export const deleteFile = async (sessionId, filePath) => {
  const session = await getSession(sessionId);
  if (session?.status === "running") {
    try {
      await deleteFromContainer(session, filePath);
    } catch (err) {
      console.warn("[deleteFile] Failed to delete from container:", err.message);
    }
    // Update local files cache list without triggering container SSM execution
    if (session.files) {
      const files = session.files.filter((f) => f.path !== filePath);
      await updateSession(sessionId, { files }).catch(() => {});
    }
    return;
  }
  const files = (await listFiles(sessionId)).filter((f) => f.path !== filePath);
  await updateSession(sessionId, { files }).catch(() => {});
};

export const clearSessionFiles = (sessionId) => {
  // No-op as workspace is disk-bound
};

