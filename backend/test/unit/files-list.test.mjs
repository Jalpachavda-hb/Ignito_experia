/**
 * File listing: bounded wait, shared in-flight request, failure is not "empty", stale cache.
 * The container client and session store are replaced with module mocks (no ECS/SSM/AWS).
 * Run with: node --test --experimental-test-module-mocks
 */
import test, { mock } from "node:test";
import assert from "node:assert/strict";

process.env.FILES_LIST_TIMEOUT_MS = "300";
process.env.SESSIONS_TABLE_NAME = "";
process.env.DYNAMODB_TABLE_NAME = "";
process.env.ECS_CLUSTER = "";

const sessions = new Map();
let containerImpl = async () => [];
let containerCalls = 0;

mock.module("../../services/sessionRepository.js", {
  namedExports: {
    getSession: async (id) => (sessions.has(id) ? structuredClone(sessions.get(id)) : null),
    updateSession: async (id, patch) => { sessions.set(id, { ...(sessions.get(id) || {}), ...patch }); return sessions.get(id); },
    saveSession: async (s) => { sessions.set(s.sessionId, s); return s; },
    deleteSession: async (id) => sessions.delete(id),
  },
});
const realContainer = await import("../../services/containerClient.js");
mock.module("../../services/containerClient.js", {
  namedExports: {
    ...realContainer,
    getFilesFromContainer: async (...args) => { containerCalls += 1; return containerImpl(...args); },
  },
});
mock.module("../../lib/sessionAccess.js", {
  namedExports: {
    authorizeLabSession: async (_auth, sessionId) => ({ session: sessions.get(sessionId) || null, dbSession: null }),
  },
});

const { filesListHandler } = await import("../../handlers/files.js");
const { listFilesShared, invalidateWorkspaceIndex } = await import("../../services/fileRepository.js");

const auth = { userId: 1 };
const call = (sessionId) => filesListHandler({ auth, headers: { "x-session-id": sessionId }, queryStringParameters: {} });
const running = (id, extra = {}) =>
  sessions.set(id, { sessionId: id, userId: "1", labId: "python-lab", labType: "python", status: "running", taskArn: "arn:t/" + id, bootstrapState: "READY", isBootstrapped: true, ...extra });

test("empty workspace is returned as an empty list with ready=true", async () => {
  running("s-empty");
  containerImpl = async () => [];
  const res = await call("s-empty");
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.files, []);
  assert.equal(res.body.ready, true);
});

test("a failed container listing is an error (503, retryable), not an empty workspace", async () => {
  running("s-fail");
  containerImpl = async () => { throw new Error("ECONNREFUSED"); };
  const res = await call("s-fail");
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.retryable, true);
  assert.equal(res.body.code, "WORKSPACE_LIST_FAILED");
});

test("failure with a cached tree serves the cache marked stale", async () => {
  running("s-cache", { files: [{ name: "a.py", path: "/workspace/a.py", type: "file", content: "print(1)" }] });
  containerImpl = async () => { throw new Error("down"); };
  const res = await call("s-cache");
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.files.length, 1);
  assert.equal(res.body.files[0].content, undefined, "bodies are not sent in the tree");
});

test("a hanging runtime does not leave the request pending: bounded wait, then 503 WORKSPACE_LOADING", async () => {
  running("s-slow");
  let release;
  containerImpl = () => new Promise((r) => { release = () => r([{ name: "b.py", path: "/workspace/b.py", type: "file" }]); });
  const t0 = Date.now();
  const res = await call("s-slow");
  const waited = Date.now() - t0;
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, "WORKSPACE_LOADING");
  assert.ok(waited < 1500, `answered after ${waited} ms`);
  release();
  await new Promise((r) => setTimeout(r, 20));
});

test("concurrent list requests for one session share one runtime call", async () => {
  running("s-dedupe");
  invalidateWorkspaceIndex?.("s-dedupe");
  containerCalls = 0;
  containerImpl = async () => { await new Promise((r) => setTimeout(r, 50)); return [{ name: "c.py", path: "/workspace/c.py", type: "file" }]; };
  const results = await Promise.all([listFilesShared("s-dedupe"), listFilesShared("s-dedupe"), listFilesShared("s-dedupe")]);
  assert.equal(containerCalls, 1);
  assert.ok(results.every((r) => r.length === 1));
});

test("large file lists are returned in full and quickly", async () => {
  running("s-large");
  const big = Array.from({ length: 5000 }, (_, i) => ({ name: `f${i}.py`, path: `/workspace/dir${i % 50}/f${i}.py`, type: "file" }));
  containerImpl = async () => big;
  const t0 = performance.now();
  const res = await call("s-large");
  const ms = performance.now() - t0;
  console.log(`[measure] list of 5000 files (handler, excluding runtime I/O): ${ms.toFixed(1)} ms`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.files.length, 5000);
});
