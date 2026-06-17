import { getSession, updateSession } from "./sessionRepository.js";
import fs from "fs";
import path from "path";

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

  // System/intermediate folders to ignore to keep explorer clean and performant
  const ignored = [
    ".git",
    "node_modules",
    "backend",
    "vlab_admin",
    "__pycache__",
    ".gradle",
    "intermediates",
    "generated",
    "tmp",
    "kotlin",
    ".tanstack"
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
  const root = getLocalWorkspaceRoot();
  if (fs.existsSync(root)) {
    try {
      const scanned = scanLocalFiles(root);
      if (scanned && scanned.length > 0) {
        return scanned;
      }
    } catch (err) {
      console.error("[listFiles] Local scan error:", err.message);
    }
  }

  const session = await getSession(sessionId);
  if (session?.files) return session.files;
  return [];
};

export const getFile = async (sessionId, filePath) => {
  const localPath = getLocalFilePath(filePath);
  if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
    try {
      const content = fs.readFileSync(localPath, "utf-8");
      const name = filePath.split("/").pop();
      const ext = name.split(".").pop()?.toLowerCase();
      const detectLanguage = (ext) => {
        if (ext === "py") return "python";
        if (ext === "java") return "java";
        if (ext === "html") return "html";
        if (ext === "css") return "css";
        if (ext === "js" || ext === "jsx") return "javascript";
        if (ext === "json") return "json";
        if (ext === "sh") return "shell";
        if (ext === "xml") return "xml";
        if (ext === "gradle") return "groovy";
        if (ext === "properties") return "properties";
        return "plaintext";
      };
      return {
        name,
        path: filePath,
        type: "file",
        content,
        language: detectLanguage(ext),
      };
    } catch (err) {
      console.error(`Failed to read file: ${localPath}`, err.message);
    }
  }
  return null;
};

export const upsertFile = async (sessionId, fileData) => {
  const session = await getSession(sessionId);
  const isRemoteSession = session?.status === "running" && session.taskArn;

  if (!isRemoteSession) {
    const localPath = getLocalFilePath(fileData.path);
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(localPath, fileData.content ?? "");
  }

  const record = {
    name: fileData.name || fileData.path.split("/").pop(),
    path: fileData.path,
    type: "file",
    content: fileData.content ?? "",
    language: fileData.language || "python",
  };

  // Keep session files property updated in memory/DB for secondary tracking
  if (session) {
    const files = [...(session.files || [])];
    const index = files.findIndex((f) => f.path === fileData.path);
    if (index >= 0) files[index] = { ...files[index], ...record };
    else files.push(record);
    await updateSession(sessionId, { files }).catch(() => {});
  }

  return record;
};

export const deleteFile = async (sessionId, filePath) => {
  const localPath = getLocalFilePath(filePath);
  if (fs.existsSync(localPath)) {
    try {
      if (fs.statSync(localPath).isDirectory()) {
        fs.rmSync(localPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(localPath);
      }
    } catch (err) {
      console.error(`Failed to delete file ${localPath}:`, err.message);
    }
  }

  // Remove from session tracking
  const session = await getSession(sessionId);
  if (session?.files) {
    const files = session.files.filter((f) => f.path !== filePath);
    await updateSession(sessionId, { files }).catch(() => {});
  }
};

export const clearSessionFiles = (sessionId) => {
  // No-op as workspace is disk-bound
};

