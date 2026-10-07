import fs from "fs";
import path from "path";
import zlib from "zlib";
import { getSession, updateSession } from "./sessionRepository.js";
import {
  getFilesFromContainer,
  getFileContentFromContainer,
  saveToContainer,
  deleteFromContainer,
  getPresignedUrl,
  getStarterAssetKey,
} from "./containerClient.js";
import labSessionRepository from "../repositories/LabSessionRepository.js";
import { ENV } from "../config/env.js";
import userWorkspaceService from "./UserWorkspaceService.js";

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
    "sitecustomize.py",
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

const detectLanguageFromPath = (filePath) => {
  const ext = (filePath.split("/").pop() || "").split(".").pop() || "";
  if (["js", "jsx"].includes(ext)) return "javascript";
  if (ext === "java") return "java";
  if (ext === "cs") return "csharp";
  if (ext === "cshtml") return "razor";
  if (ext === "sh") return "shell";
  if (ext === "gradle") return "groovy";
  if (ext === "properties") return "properties";
  if (ext === "xml") return "xml";
  if (ext === "json") return "json";
  if (ext === "html") return "html";
  if (ext === "css") return "css";
  if (ext === "md") return "markdown";
  if (["txt", "csv", "log"].includes(ext)) return "text";
  if (ext === "py") return "python";
  if (ext === "ipynb") return "json";
  return "plaintext";
};

const isBinaryExt = (name) => {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "ico", "pdf", "jar", "zip", "tar", "gz", "exe", "dll"].includes(ext);
};

// In-memory S3 starter files cache: key -> Array of { name, path, type, language, content, size }
const s3StarterCache = new Map();

const cloneFileRecord = (f) => ({
  name: f.name,
  path: f.path,
  type: f.type,
  language: f.language,
  content: typeof f.content === "string" ? f.content : "",
  size: f.size ?? (typeof f.content === "string" ? Buffer.byteLength(f.content) : 0),
});

export const fetchStarterFilesFromS3 = async (session) => {
  if (session && !session.dotnetSubtype && session.sessionId) {
    try {
      const dbSess = await labSessionRepository.getSessionById(session.sessionId);
      if (dbSess?.Subtype) {
        session.dotnetSubtype = dbSess.Subtype;
      }
    } catch (_) {}
  }
  const key = getStarterAssetKey(session);
  if (!key) return [];

  if (s3StarterCache.has(key)) {
    return s3StarterCache.get(key).map(cloneFileRecord);
  }

  const bucket = ENV.testCasesBucket || "vlab-dev-lab-files-0kdrg0q8";
  console.log(`[fileRepository] Fetching starter files directly from S3: s3://${bucket}/${key}`);
  try {
    const presignedUrl = await getPresignedUrl(bucket, key, 3600);
    const res = await fetch(presignedUrl);
    if (!res.ok) {
      console.warn(`[fileRepository] Failed to download starter tarball from S3: HTTP ${res.status}`);
      return [];
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const tar = zlib.gunzipSync(buf);

    let offset = 0;
    const files = [];
    while (offset + 512 <= tar.length) {
      const header = tar.subarray(offset, offset + 512);
      if (header.every((b) => b === 0)) break;
      let name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "").trim();
      const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "").trim();
      if (prefix) name = prefix + "/" + name;
      const sizeStr = header.subarray(124, 136).toString("utf8").replace(/\0.*$/, "").trim();
      const size = parseInt(sizeStr, 8) || 0;
      const typeflag = String.fromCharCode(header[156]);
      offset += 512;
      if (typeflag === "0" || typeflag === "\0") {
        const rawName = name.replace(/^\.\//, "");
        const fileName = rawName.split("/").pop();
        const filePath = "/workspace/" + rawName;
        let content = "";
        if (!isBinaryExt(fileName) && size < 500 * 1024) {
          content = tar.subarray(offset, offset + size).toString("utf8");
        }
        files.push({
          name: fileName,
          path: filePath,
          type: "file",
          language: detectLanguageFromPath(filePath),
          content,
          size,
        });
      }
      offset += Math.ceil(size / 512) * 512;
    }

    if (files.length > 0) {
      s3StarterCache.set(key, files.map(cloneFileRecord));
    }
    return files.map(cloneFileRecord);
  } catch (err) {
    console.error(`[fileRepository] Failed to read starter files from S3:`, err.message);
    return [];
  }
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
  if (session && !session.dotnetSubtype) {
    try {
      const dbSess = await labSessionRepository.getSessionById(sessionId);
      if (dbSess?.Subtype) {
        session.dotnetSubtype = dbSess.Subtype;
      }
    } catch (_) {}
  }

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
        console.log(`[listFiles] Live container returned ${containerFiles.length} files. Updating session cache...`);
        const isReady = session?.bootstrapState === "READY" || session?.isBootstrapped === true;
        if (containerFiles.length > 0 && isReady) {
          // Keep previously cached file bodies so reopen stays fast when HTTP→SSM is slow
          const prevByPath = new Map((session.files || []).map((f) => [f.path, f]));
          const dbFiles = containerFiles.map((file) => {
            const { content, ...rest } = file;
            const prev = prevByPath.get(rest.path);
            if (prev && typeof prev.content === "string") {
              return { ...rest, content: prev.content };
            }
            if (content && content.length < 100000) {
              return file;
            }
            return rest;
          });
          await updateSession(sessionId, { files: dbFiles }).catch((e) => {
            console.warn(`[listFiles] Failed to update session files cache in DB: ${e.message}`);
          });
        }
        return containerFiles;
      } catch (err) {
        console.error("[listFiles] Container list failed:", err.message);
        return session?.files || [];
      }
    }

    const labId = (session?.labId || "").toLowerCase();
    const labType = (session?.labType || "").toLowerCase();
    const isDotnet = labType === "dotnet" || labId === "dotnet-lab" || labId.includes("dotnet");

    if (!session?.taskArn && !isDotnet) {
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
    file.name !== 'sitecustomize.py' &&
    !file.path.endsWith('/sitecustomize.py') &&
    !file.path.includes('.vlab_tmp') &&
    !file.path.includes('.tmp') &&
    !file.path.includes('/build/') &&
    !file.path.includes('/.gradle/') &&
    !file.path.includes('/intermediates/') &&
    !file.path.includes('/generated/')
  );
  
  let finalTree = filterDotnetFiles(result, session);

  const labId = (session?.labId || "").toLowerCase();
  const labType = (session?.labType || "").toLowerCase();
  const isDotnet = labType === "dotnet" || labId === "dotnet-lab" || labId.includes("dotnet");
  const isPython = labType === "python" || labId === "python-lab" || labId.includes("python");

  // 1. If workspace is empty, check for persisted student files from current session!
  // (NOTE: For .NET lab, all changes are discarded on stop; starter files come from S3)
  if (!isDotnet && finalTree.length === 0 && session?.userId && session?.labId) {
    try {
      const savedUserFiles = await userWorkspaceService.getUserWorkspaceFiles(session.userId, session.labId);
      if (savedUserFiles && savedUserFiles.length > 0) {
        console.log(`[listFiles] Restoring ${savedUserFiles.length} persistent workspace file(s) for user ${session.userId}, lab ${session.labId}`);
        finalTree = filterDotnetFiles(savedUserFiles, session);
        await updateSession(sessionId, { files: finalTree }).catch(e => {
          console.warn(`[listFiles] Failed to cache restored user files in DB: ${e.message}`);
        });
      }
    } catch (restoreErr) {
      console.warn("[listFiles] Error restoring user files:", restoreErr.message);
    }
  }

  // 2. If workspace is empty or container not ready yet, load starter files directly from S3!
  // For .NET lab: always ensure fresh starter files from S3 if session is new or files not yet populated.
  // Python lab starts 100% clean and fresh with 0 files (no starter files).
  if (!isPython && (finalTree.length === 0 || (isDotnet && (!session?.files || session.files.length === 0)))) {
    const s3StarterFiles = await fetchStarterFilesFromS3(session);
    if (s3StarterFiles && s3StarterFiles.length > 0) {
      console.log(`[listFiles] Populating workspace from S3 starter template (${s3StarterFiles.length} files) for session ${sessionId}`);
      const filteredS3 = filterDotnetFiles(
        s3StarterFiles.filter(file =>
          file.name !== 'run_android_build.sh' &&
          !file.path.includes('.vlab_tmp') &&
          !file.path.includes('.tmp') &&
          !file.path.includes('/build/') &&
          !file.path.includes('/.gradle/') &&
          !file.path.includes('/intermediates/') &&
          !file.path.includes('/generated/')
        ),
        session
      );
      if (filteredS3.length > 0) {
        finalTree = filteredS3.map(cloneFileRecord);
        await updateSession(sessionId, { files: finalTree }).catch(e => {
          console.warn(`[listFiles] Failed to cache S3 starter files in DB: ${e.message}`);
        });

        // Also sync fresh files to local workspace root on disk, overwriting any previous disk leftovers
        if (!session?.taskArn) {
          try {
            const root = getLocalWorkspaceRoot();
            if (fs.existsSync(root)) {
              for (const f of finalTree) {
                const cleanRel = f.path.replace(/^\/workspace\//, "").replace(/^\/+/, "");
                const localFilePath = path.join(root, cleanRel);
                fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
                if (typeof f.content === "string") {
                  fs.writeFileSync(localFilePath, f.content, "utf8");
                }
              }
            }
          } catch (syncErr) {
            console.warn("[listFiles] Failed to sync S3 starter files to local disk:", syncErr.message);
          }
        }
      }
    }
  }

  // 3. If still empty, load default starter files (not for Python lab)
  if (!isPython && finalTree.length === 0 && session?.labId) {
    const defaultStarters = userWorkspaceService.getDefaultStarterFiles(session.labId);
    if (defaultStarters && defaultStarters.length > 0) {
      console.log(`[listFiles] Providing default starter files (${defaultStarters.length}) for lab ${session.labId}`);
      finalTree = defaultStarters;
      await updateSession(sessionId, { files: defaultStarters }).catch(() => {});
      if (session?.userId) {
        for (const f of defaultStarters) {
          userWorkspaceService.saveUserWorkspaceFile(session.userId, session.labId, f).catch(() => {});
        }
      }
    }
  }

  if (finalTree.length > 0) {
    console.log(`[listFiles] Caching complete workspace tree (${finalTree.length} files) for session: ${sessionId}`);
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
  if (session && !session.dotnetSubtype) {
    try {
      const dbSess = await labSessionRepository.getSessionById(sessionId);
      if (dbSess?.Subtype) {
        session.dotnetSubtype = dbSess.Subtype;
      }
    } catch (_) {}
  }

  // Prefer session content cache for instant opens (avoids hanging on unreachable container HTTP)
  const cached = session?.files?.find((f) => f.path === filePath);
  const suspiciousEmptyXml =
    typeof cached?.content === "string" &&
    cached.content.trim() === "" &&
    /\/res\/.+\.xml$/i.test(filePath || "");
  if (cached && typeof cached.content === "string" && !suspiciousEmptyXml) {
    return {
      name: cached.name || filePath.split("/").pop(),
      path: filePath,
      type: "file",
      content: cached.content,
      language: cached.language || detectLanguageFromPath(filePath),
    };
  }

  if (session?.status === "running") {
    try {
      const content = await getFileContentFromContainer(session, filePath);
      if (content !== null) {
        const name = filePath.split("/").pop();
        const language = detectLanguageFromPath(filePath);
        const record = {
          name,
          path: filePath,
          type: "file",
          content,
          language,
        };
        fileContentCache.set(cacheKey, record);
        await cacheFileContent(sessionId, record).catch(() => {});
        return record;
      }
    } catch (err) {
      console.warn("[getFile] Failed to read container file content:", err.message);
    }
  }

  // Direct S3 starter file content fallback
  const s3Files = await fetchStarterFilesFromS3(session);
  const foundInS3 = s3Files.find((f) => f.path === filePath);
  if (foundInS3) {
    fileContentCache.set(cacheKey, foundInS3);
    await cacheFileContent(sessionId, foundInS3).catch(() => {});
    return foundInS3;
  }

  const files = await listFiles(sessionId);
  return files.find((f) => f.path === filePath) || null;
};

export const cacheFileContent = async (sessionId, fileData) => {
  const session = await getSession(sessionId);
  if (!session) return;
  const record = {
    name: fileData.name || fileData.path.split("/").pop(),
    path: fileData.path,
    type: "file",
    content: fileData.content ?? "",
    language: fileData.language || detectLanguageFromPath(fileData.path),
  };
  const files = session.files ? [...session.files] : [];
  const index = files.findIndex((f) => f.path === fileData.path);
  if (index >= 0) files[index] = { ...files[index], ...record };
  else files.push(record);
  await updateSession(sessionId, { files });
  const labId = (session?.labId || "").toLowerCase();
  const labType = (session?.labType || "").toLowerCase();
  const isDotnet = labType === "dotnet" || labId === "dotnet-lab" || labId.includes("dotnet");

  // Do not persist .NET lab files to long-term MySQL storage
  if (!isDotnet && session?.userId && session?.labId) {
    userWorkspaceService.saveUserWorkspaceFile(session.userId, session.labId, record).catch(() => {});
  }
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

  const labId = (session?.labId || "").toLowerCase();
  const labType = (session?.labType || "").toLowerCase();
  const isDotnet = labType === "dotnet" || labId === "dotnet-lab" || labId.includes("dotnet");

  // Persist file into persistent database for non-dotnet labs
  if (!isDotnet && session?.userId && session?.labId) {
    userWorkspaceService.saveUserWorkspaceFile(session.userId, session.labId, record).catch(err => {
      console.warn("[upsertFile] Failed to persist file to MySQL:", err.message);
    });
  }

  // Update session.files synchronously so subsequent listFiles requests always include this file
  const currentFiles = session?.files ? [...session.files] : [];
  const index = currentFiles.findIndex((f) => f.path === fileData.path);
  if (index >= 0) {
    currentFiles[index] = { ...currentFiles[index], ...record };
  } else {
    currentFiles.push(record);
  }

  // Update in-memory workspace index cache and session repository
  workspaceIndexCache.set(sessionId, currentFiles);
  await updateSession(sessionId, { files: currentFiles }).catch(() => {});

  if (session?.status === "running") {
    try {
      await saveToContainer(session, { path: fileData.path, content: fileData.content ?? "" });
    } catch (err) {
      console.warn("[upsertFile] Failed to save to container:", err.message);
    }
  }

  return record;
};

export const deleteFile = async (sessionId, filePath) => {
  const cacheKey = getCacheKey(sessionId, filePath);
  fileContentCache.delete(cacheKey);

  const session = await getSession(sessionId);
  if (session?.userId && session?.labId) {
    userWorkspaceService.deleteUserWorkspaceFile(session.userId, session.labId, filePath).catch(err => {
      console.warn("[deleteFile] Failed to delete from persistent storage:", err.message);
    });
  }

  const currentFiles = session?.files ? session.files.filter((f) => f.path !== filePath) : [];
  workspaceIndexCache.set(sessionId, currentFiles);
  await updateSession(sessionId, { files: currentFiles }).catch(() => {});

  if (session?.status === "running") {
    try {
      await deleteFromContainer(session, filePath);
    } catch (err) {
      console.warn("[deleteFile] Failed to delete from container:", err.message);
    }
  }
};

export const clearDiskWorkspace = () => {
  try {
    const root = getLocalWorkspaceRoot();
    if (fs.existsSync(root)) {
      const items = fs.readdirSync(root);
      for (const item of items) {
        if ([".git", "node_modules", "backend", "vlab_admin", "ignito_Experia_Main_Dashboard"].includes(item)) {
          continue;
        }
        const itemPath = path.join(root, item);
        try {
          fs.rmSync(itemPath, { recursive: true, force: true });
        } catch (e) {
          console.warn(`[clearDiskWorkspace] Failed to remove ${itemPath}:`, e.message);
        }
      }
      console.log(`[clearDiskWorkspace] Workspace at ${root} cleared`);
    }
  } catch (err) {
    console.warn(`[clearDiskWorkspace] Error clearing local workspace:`, err.message);
  }
};

export const clearSessionFiles = (sessionId, session = null) => {
  if (sessionId) {
    workspaceIndexCache.delete(sessionId);
    for (const key of fileContentCache.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        fileContentCache.delete(key);
      }
    }
  }

  // Clear disk workspace files so modified files do not persist between sessions
  clearDiskWorkspace();

  // Discard lab changes from persistent storage on lab stop so new session starts fresh
  const labId = (session?.labId || session?.LabId || "").toLowerCase();
  const userId = session?.userId || session?.UserId;
  if (userId && labId) {
    userWorkspaceService.clearUserWorkspace(userId, labId).catch(() => {});
  }
};

