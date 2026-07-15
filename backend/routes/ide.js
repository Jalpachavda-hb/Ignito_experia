import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireSession, getSessionId } from "../middleware/requireSession.js";
import { ok, fail } from "../utils/apiResponse.js";
import {
  listFiles,
  getFile,
  upsertFile,
  deleteFile,
  clearSessionFiles
} from "../services/fileRepository.js";
import { executeCode } from "../services/ExecutionService.js";
import { getAllowedExtensions } from "../lib/labTypeMapper.js";

const router = express.Router();

export { clearSessionFiles };

// GET /api/files
router.get(
  "/files",
  asyncHandler(async (req, res) => {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return fail(res, "Session ID required", 400);
    }
    const files = await listFiles(sessionId);
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
    if (!sessionId) {
      return fail(res, "Session ID required", 400);
    }
    const filePath = req.query.path;
    const file = await getFile(sessionId, filePath);

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
  requireSession,
  asyncHandler(async (req, res) => {
    const { sessionId, session } = req;
    const { path: filePath, content, name, language } = req.body;
    if (!filePath) {
      return fail(res, "File path is required", 400);
    }

    // File extension validation
    const allowedExtensions = getAllowedExtensions(session.labId);
    const hasExtension = filePath.includes(".") && filePath.split(".").pop() !== "";
    const ext = hasExtension ? filePath.split(".").pop().toLowerCase() : "";
    if (!hasExtension || !allowedExtensions.includes(ext)) {
      return fail(
        res,
        `Workspace Restriction: Invalid file extension. Only the following extensions are allowed for this lab: ${allowedExtensions.map(e => `.${e}`).join(", ")}`,
        400
      );
    }

    const record = await upsertFile(sessionId, { path: filePath, content, name, language });
    ok(res, { message: "File saved successfully", file: record });
  }),
);

// DELETE /api/files
router.delete(
  "/files",
  asyncHandler(async (req, res) => {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return fail(res, "Session ID required", 400);
    }
    const filePath = req.query.path;
    await deleteFile(sessionId, filePath);
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

    // File extension validation
    const allowedExtensions = getAllowedExtensions(session.labId);
    const hasExtension = filePath.includes(".") && filePath.split(".").pop() !== "";
    const ext = hasExtension ? filePath.split(".").pop().toLowerCase() : "";
    if (!hasExtension || !allowedExtensions.includes(ext)) {
      return fail(
        res,
        `Workspace Restriction: Invalid file extension. Only the following extensions are allowed for this lab: ${allowedExtensions.map(e => `.${e}`).join(", ")}`,
        400
      );
    }

    const file = await getFile(sessionId, filePath);

    if (!file) {
      return fail(res, "File not found. Save your code before running.", 404);
    }

    const payload = {
      path: filePath,
      language: language || file.language,
      content: req.body.content !== undefined ? req.body.content : file.content,
    };

    try {
      const result = await executeCode(session, payload);
      return ok(res, result);
    } catch (err) {
      console.error("[IDE] Container execution failed:", err.message);
      return fail(res, err.message || "Execution failed", 500);
    }
  }),
);

export default router;
