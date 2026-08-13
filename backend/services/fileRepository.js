import fs from "fs";
import path from "path";
import { getSession, updateSession } from "./sessionRepository.js";
import {
  getFilesFromContainer,
  getFileContentFromContainer,
  saveToContainer,
  deleteFromContainer,
} from "./containerClient.js";
import { ENV } from "../config/env.js";

// Dynamically resolve the parent directory of backend as the local workspace root
const getLocalWorkspaceRoot = () => {
  if (process.env.LAB_WORKSPACE) {
    return path.join(process.env.LAB_WORKSPACE, "workspace");
  }
  return path.join(path.resolve(process.cwd(), ".."), "workspace");
};

const getLocalFilePath = (filePath) => {
  const cleanPath = filePath.replace(/^\/workspace\//, "").replace(/^\/+/, "");
  return path.join(getLocalWorkspaceRoot(), cleanPath);
};


// downloadFile, extractTar, and bootstrapLocalWorkspace helper functions were refactored and moved to WorkspaceBootstrapService.

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

      let content = "";
      if (stat.size < 500 * 1024) {
        try {
          content = fs.readFileSync(fullPath, "utf8");
        } catch (_) {}
      }

      results.push({
        name: file,
        path: relPath, // e.g. /workspace/filename.py
        type: "file",
        language,
        content,
      });
    }
  }
  return results;
};

const filterDotnetFiles = (files, session) => {
  const labId = (session?.labId || "").toLowerCase();
  const labType = (session?.labType || "").toLowerCase();
  const isDotnet = labType === "dotnet" || labId === "dotnet-lab" || labId.includes("dotnet");

  if (!isDotnet) return files;

  return files.filter(file => {
    const pathLower = (file.path || "").toLowerCase();
    const nameLower = (file.name || "").toLowerCase();

    // 1. Hide build artifacts, binary outputs and IDE metadata
    if (
      pathLower.includes("/obj/") ||
      pathLower.includes("/bin/") ||
      pathLower.includes("/properties/") ||
      pathLower.includes("/.vs/") ||
      pathLower.includes("/.idea/")
    ) {
      return false;
    }

    // 2. Hide static libraries and assets in wwwroot (bootstrap, jquery, etc.)
    if (
      pathLower.includes("/wwwroot/lib/") ||
      pathLower.includes("/wwwroot/favicon.ico")
    ) {
      return false;
    }

    // 3. Hide project files and build configurations
    if (
      nameLower.endsWith(".csproj") ||
      nameLower.endsWith(".sln") ||
      nameLower.endsWith(".suo") ||
      nameLower.endsWith(".user")
    ) {
      return false;
    }

    // 4. Hide package restore/build manifests
    if (
      nameLower === "appsettings.json" ||
      nameLower === "appsettings.development.json" ||
      nameLower === "project.assets.json" ||
      nameLower.endsWith(".nuget.g.props") ||
      nameLower.endsWith(".nuget.g.targets") ||
      nameLower === "project.nuget.cache"
    ) {
      return false;
    }

    // 5. Hide map files
    if (nameLower.endsWith(".map")) {
      return false;
    }

    // 6. Hide licenses and readmes
    if (
      nameLower === "license" ||
      nameLower === "license.txt" ||
      nameLower === "readme.md"
    ) {
      return false;
    }

    // 7. Hide boilerplate MVC helpers that students do not edit
    if (
      nameLower === "_viewimports.cshtml" ||
      nameLower === "_viewstart.cshtml" ||
      nameLower === "_validationscriptspartial.cshtml"
    ) {
      return false;
    }

    return true;
  });
};

// In-memory Workspace Index and File Content Cache (LRU)
const workspaceIndexCache = new Map();
const fileContentCache = new Map();

export const invalidateWorkspaceIndex = (sessionId) => {
  workspaceIndexCache.delete(sessionId);
};

const getCacheKey = (sessionId, filePath) => `${sessionId}:${filePath}`;

export const listFiles = async (sessionId) => {
  console.log(`[listFiles] Fetching session details for sessionId: ${sessionId}`);
  const session = await getSession(sessionId);

  // Phase 2: In-memory index hit
  if (workspaceIndexCache.has(sessionId)) {
    console.log(`[listFiles] Index hit. Returning cached file tree for session: ${sessionId}`);
    return workspaceIndexCache.get(sessionId);
  }

  let result = [];

  const getUnfilteredList = async () => {
    if (session?.files && session.files.length > 0) {
      console.log(`[listFiles] DB Cache hit. Returning ${session.files.length} files from session DB cache.`);
      return session.files;
    }

    const hasLiveContainer =
      session?.status === "running" &&
      Boolean(session.taskArn || session.apiBaseUrl);

    if (hasLiveContainer) {
      try {
        console.log(`[listFiles] Listing files from live container runtime for session: ${sessionId}`);
        const files = await getFilesFromContainer(session);
        const containerFiles = files || [];
        const isReady = session?.bootstrapState === "READY" || session?.isBootstrapped === true;
        if (containerFiles.length > 0 && isReady) {
          const dbFiles = containerFiles.map(file => {
            if (file.content && file.content.length < 100000) {
              return file;
            }
            const { content, ...rest } = file;
            return rest;
          });
          await updateSession(sessionId, { files: dbFiles }).catch(() => {});
        }
        return containerFiles;
      } catch (err) {
        console.error("[listFiles] Container list failed:", err.message);
        return session?.files || [];
      }
    }

    if (!session?.taskArn) {
      const root = getLocalWorkspaceRoot();
      if (fs.existsSync(root)) {
        try {
          const scanned = scanLocalFiles(root);
          if (scanned?.length > 0) return scanned;
        } catch (err) {
          console.error("[listFiles] Local scan error:", err.message);
        }
      }
    }

    return session?.files || [];
  };

  result = await getUnfilteredList();
  result = result.filter(file => 
    file.name !== 'run_android_build.sh' &&
    !file.path.includes('.vlab_tmp') &&
    !file.path.includes('.tmp') &&
    !file.path.includes('/build/') &&
    !file.path.includes('/.gradle/') &&
    !file.path.includes('/intermediates/') &&
    !file.path.includes('/generated/')
  );
  
  const finalTree = filterDotnetFiles(result, session);
  const isReady = session?.bootstrapState === "READY" || session?.isBootstrapped === true;
  if (finalTree.length > 0 && isReady) {
    console.log(`[listFiles] Caching complete workspace tree (${finalTree.length} files) for ready session: ${sessionId}`);
    workspaceIndexCache.set(sessionId, finalTree);
    finalTree.forEach(file => {
      if (file.path && file.content !== undefined) {
        const cacheKey = getCacheKey(sessionId, file.path);
        fileContentCache.set(cacheKey, file);
      }
    });
  }
  return finalTree;
};

export const getFile = async (sessionId, filePath) => {
  const cacheKey = getCacheKey(sessionId, filePath);
  // Phase 4: Fast in-memory cache return (< 50 ms)
  if (fileContentCache.has(cacheKey)) {
    return fileContentCache.get(cacheKey);
  }

  const session = await getSession(sessionId);
  if (session?.status === "running") {
    try {
      const content = await getFileContentFromContainer(session, filePath);
      const name = filePath.split("/").pop();
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

      const fileObj = {
        name,
        path: filePath,
        type: "file",
        content,
        language
      };
      fileContentCache.set(cacheKey, fileObj);
      return fileObj;
    } catch (err) {
      console.warn("[getFile] Failed to read container file content:", err.message);
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

  const cacheKey = getCacheKey(sessionId, fileData.path);
  fileContentCache.set(cacheKey, record);
  invalidateWorkspaceIndex(sessionId);

  if (session?.status === "running") {
    try {
      await saveToContainer(session, { path: fileData.path, content: fileData.content ?? "" });
    } catch (err) {
      console.warn("[upsertFile] Failed to save to container:", err.message);
    }
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
  const cacheKey = getCacheKey(sessionId, filePath);
  fileContentCache.delete(cacheKey);
  invalidateWorkspaceIndex(sessionId);

  const session = await getSession(sessionId);
  if (session?.status === "running") {
    try {
      await deleteFromContainer(session, filePath);
    } catch (err) {
      console.warn("[deleteFile] Failed to delete from container:", err.message);
    }
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

