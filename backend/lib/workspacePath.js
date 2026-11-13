import fs from "fs";
import path from "path";
import { badRequest } from "./errors.js";

const WORKSPACE_PREFIX = "/workspace/";

/**
 * Relative path inside the lab workspace. Rejects traversal, absolute
 * escapes, and characters that would change a quoted shell argument.
 * Spaces and Unicode names are kept so nested student files still save.
 */
export const assertWorkspaceRelativePath = (userPath) => {
  if (userPath === undefined || userPath === null) {
    throw badRequest("path is required");
  }
  let value = String(userPath).replace(/\\/g, "/").trim();
  if (!value) throw badRequest("path is required");
  if (value.includes("\0")) throw badRequest("Invalid path");

  if (/^[a-zA-Z]:/.test(value) || value.startsWith("//")) {
    throw badRequest("Absolute paths are not allowed");
  }

  if (value === "/workspace") value = "";
  else if (value.startsWith(WORKSPACE_PREFIX)) value = value.slice(WORKSPACE_PREFIX.length);
  else if (value.startsWith("/")) throw badRequest("Path must stay inside /workspace");

  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw badRequest("Path escapes the workspace");
  }
  if (segments.some((segment) => /["'`$;&|<>\r\n]/.test(segment))) {
    throw badRequest("Path contains unsupported characters");
  }

  return segments.join("/");
};

export const toWorkspacePath = (userPath) => {
  const relative = assertWorkspaceRelativePath(userPath);
  return {
    relative,
    workspacePath: `${WORKSPACE_PREFIX}${relative}`,
    containerPath: `/tmp/workspace/workspace/${relative}`,
  };
};

const isInsideRoot = (rootReal, candidate) => {
  const rel = path.relative(rootReal, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

/**
 * Resolve a student path under a local workspace root and reject symlink
 * targets that leave that root. Missing files are checked via their
 * nearest existing parent.
 */
export const resolveInsideWorkspace = (root, userPath) => {
  const relative = assertWorkspaceRelativePath(userPath);
  const rootResolved = path.resolve(root);
  const rootReal = fs.existsSync(rootResolved) ? fs.realpathSync(rootResolved) : rootResolved;
  const target = path.resolve(rootReal, relative);

  let parent = path.dirname(target);
  while (!fs.existsSync(parent)) {
    const next = path.dirname(parent);
    if (next === parent) break;
    parent = next;
  }
  const parentReal = fs.existsSync(parent) ? fs.realpathSync(parent) : parent;
  if (!isInsideRoot(rootReal, parentReal)) {
    throw badRequest("Path escapes the workspace");
  }

  const resolved = path.resolve(parentReal, path.relative(parent, target));
  if (!isInsideRoot(rootReal, resolved)) {
    throw badRequest("Path escapes the workspace");
  }

  if (fs.existsSync(resolved)) {
    const realFile = fs.realpathSync(resolved);
    if (!isInsideRoot(rootReal, realFile)) {
      throw badRequest("Path escapes the workspace");
    }
  }

  return { relative, absolute: resolved };
};
