import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { assertWorkspaceRelativePath, resolveInsideWorkspace } from "./workspacePath.js";

test("accepts nested workspace paths", () => {
  assert.equal(assertWorkspaceRelativePath("/workspace/src/Program.cs"), "src/Program.cs");
  assert.equal(assertWorkspaceRelativePath("notes/my file.txt"), "notes/my file.txt");
});

test("rejects traversal and absolute escapes", () => {
  for (const value of ["../etc/passwd", "/workspace/../../etc/passwd", "/etc/passwd", "C:/Windows/system.ini", "/workspace/foo/../../../tmp"]) {
    assert.throws(() => assertWorkspaceRelativePath(value));
  }
});

test("rejects symlink targets outside the workspace", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vlab-ws-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "vlab-out-"));
  fs.writeFileSync(path.join(outside, "secret.txt"), "nope");
  try {
    fs.symlinkSync(outside, path.join(root, "link"));
  } catch {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
    return;
  }
  try {
    assert.throws(() => resolveInsideWorkspace(root, "/workspace/link/secret.txt"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
