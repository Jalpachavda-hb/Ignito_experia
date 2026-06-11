import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireSession, getSessionId } from "../middleware/requireSession.js";
import { ok, fail } from "../utils/apiResponse.js";
import {
  SESSIONS,
  SESSION_FILES,
  clearSessionFiles,
} from "../services/sessionStore.js";
import {
  saveToContainer,
  executeInContainer,
} from "../services/containerClient.js";
import { executeLocally } from "../services/localExecutor.js";

const router = express.Router();

export { clearSessionFiles };

const upsertFile = (sessionId, { path: filePath, content, name, language }) => {
  if (!SESSION_FILES[sessionId]) {
    SESSION_FILES[sessionId] = [];
  }

  const files = SESSION_FILES[sessionId];
  const index = files.findIndex((f) => f.path === filePath);

  const fileData = {
    name: name || filePath.split("/").pop(),
    path: filePath,
    type: "file",
    content: content ?? "",
    language: language || "python",
  };

  if (index !== -1) {
    files[index] = { ...files[index], ...fileData };
  } else {
    files.push(fileData);
  }

  return fileData;
};

// GET /api/files
router.get(
  "/files",
  asyncHandler(async (req, res) => {
    const sessionId = getSessionId(req);
    const files = SESSION_FILES[sessionId] || [];
    ok(res, {
      files: files.map(({ content, ...meta }) => meta),
    });
  }),
);

// GET /api/files/content
router.get(
  "/files/content",
  asyncHandler(async (req, res) => {
    const sessionId = getSessionId(req);
    const files = SESSION_FILES[sessionId] || [];
    const file = files.find((f) => f.path === req.query.path);

    if (!file) {
      return fail(res, "File not found", 404);
    }

    ok(res, {
      path: file.path,
      content: file.content,
      language: file.language,
    });
  }),
);

// POST /api/save
router.post(
  "/save",
  asyncHandler(async (req, res) => {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return fail(res, "Session ID required (x-session-id header)", 400);
    }

    const { path: filePath, content, name, language } = req.body;
    if (!filePath) {
      return fail(res, "File path is required", 400);
    }

    upsertFile(sessionId, { path: filePath, content, name, language });

    const session = SESSIONS[sessionId];
    if (session?.status === "running") {
      try {
        await saveToContainer(session, { path: filePath, content });
      } catch (err) {
        console.warn(`[IDE] Container save skipped: ${err.message}`);
      }
    }

    ok(res, { message: "File saved successfully" });
  }),
);

// DELETE /api/files
router.delete(
  "/files",
  asyncHandler(async (req, res) => {
    const sessionId = getSessionId(req);
    const files = SESSION_FILES[sessionId] || [];
    const filePath = req.query.path;
    const index = files.findIndex((f) => f.path === filePath);

    if (index === -1) {
      return fail(res, "File not found", 404);
    }

    files.splice(index, 1);
    ok(res, { message: "File deleted successfully" });
  }),
);

// POST /api/run — executes student code in ECS container or local fallback
router.post(
  "/run",
  requireSession,
  asyncHandler(async (req, res) => {
    const { sessionId, session } = req;
    const { path: filePath, language } = req.body;

    const files = SESSION_FILES[sessionId] || [];
    const file = files.find((f) => f.path === filePath);

    if (!file) {
      return fail(res, "File not found. Save your code before running.", 404);
    }

    const payload = {
      path: filePath,
      language: language || file.language,
      content: req.body.content !== undefined ? req.body.content : file.content,
    };

    if (session.status === "running" && session.publicIp) {
      try {
        const result = await executeInContainer(session, payload);
        if (result) {
          return ok(res, result);
        }
      } catch (err) {
        console.error("[IDE] Container execution failed:", err.message);
        return fail(res, `Container execution failed: ${err.message}`, 502);
      }
    }

    const local = await executeLocally(payload);
    ok(res, {
      ...local,
      runId: `run_${Date.now().toString(36)}`,
      message: session.publicIp
        ? "Executed locally (container unreachable)"
        : "Executed locally (mock session)",
    });
  }),
);

export default router;
