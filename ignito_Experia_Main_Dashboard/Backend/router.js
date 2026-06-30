import express from "express";
import { authMiddleware } from "./middleware/auth.js";
import { loginHandler, meHandler } from "./handlers/auth.js";
import {
  labsAdminListHandler,
  labsListHandler,
  labsGetHandler,
  createLabHandler,
  updateLabHandler,
  updateLabStatusHandler,
  deleteLabHandler,
} from "./handlers/labs.js";
import { runtimeTypesListHandler } from "./handlers/runtimeTypes.js";

export function setupRoutes(app, apiPrefix) {
  const router = express.Router();

  // ── Health ──────────────────────────────────────────────────
  router.get("/health", (req, res) =>
    res.json({ success: true, service: "ignito-experia-owner-backend", status: "ok" })
  );

  // ── Auth ─────────────────────────────────────────────────────
  router.post("/auth/login", loginHandler);
  router.get("/auth/me", authMiddleware, meHandler);

  // ── Labs (Owner — full CRUD) ─────────────────────────────────
  router.get("/admin/labs", authMiddleware, labsAdminListHandler);
  router.post("/admin/labs", authMiddleware, createLabHandler);
  router.get("/admin/labs/:labId", authMiddleware, labsGetHandler);
  router.put("/admin/labs/:labId", authMiddleware, updateLabHandler);
  router.patch("/admin/labs/:labId/status", authMiddleware, updateLabStatusHandler);
  router.delete("/admin/labs/:labId", authMiddleware, deleteLabHandler);

  // Public labs (for university catalog browsing — no auth required)
  router.get("/labs", labsListHandler);
  router.get("/labs/:labId", labsGetHandler);

  // ── Runtime Types ────────────────────────────────────────────
  router.get("/admin/runtime-types", authMiddleware, runtimeTypesListHandler);

  app.use(apiPrefix, router);
}
