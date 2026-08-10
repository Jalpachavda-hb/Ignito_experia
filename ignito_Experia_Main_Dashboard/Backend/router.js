import express from "express";
import { authMiddleware } from "./middleware/auth.js";
import { loginHandler, meHandler, getProfileHandler, updateProfileHandler } from "./handlers/auth.js";

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
import {
  universitiesListHandler,
  universitiesCreateHandler,
  universitiesStatusHandler,
  universitiesUpdateHandler,
  universitiesDeleteHandler,
} from "./handlers/universities.js";
import { uploadMiddleware, uploadFileHandler } from "./handlers/upload.js";
import {
  internalTenantBySlugHandler,
  internalTenantLoginHandler,
} from "./handlers/internal.js";

export function setupRoutes(app, apiPrefix) {
  const router = express.Router();

  // ── Health ──────────────────────────────────────────────────
  router.get("/health", (req, res) =>
    res.json({ success: true, service: "ignito-experia-owner-backend", status: "ok" })
  );

  // ── Internal Backend-to-Backend APIs ──────────────────────────
  router.get("/internal/tenants/by-slug/:slug", internalTenantBySlugHandler);
  router.post("/internal/auth/tenant-login", internalTenantLoginHandler);

  // ── Image / File Upload ─────────────────────────────────────
  router.post("/upload", uploadMiddleware, uploadFileHandler);

  // ── Auth & Profile ───────────────────────────────────────────
  router.post("/auth/login", loginHandler);
  router.get("/auth/me", authMiddleware, meHandler);
  router.get("/admin/profile", authMiddleware, getProfileHandler);
  router.put("/admin/profile", authMiddleware, updateProfileHandler);


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

  // ── University Tenants (Phase 1 Tenant Provisioning) ────────
  router.get("/admin/universities", universitiesListHandler);
  router.post("/admin/universities", universitiesCreateHandler);
  router.put("/admin/universities/:tenantId", universitiesUpdateHandler);
  router.patch("/admin/universities/:tenantId/status", universitiesStatusHandler);
  router.delete("/admin/universities/:tenantId", universitiesDeleteHandler);

  app.use(apiPrefix, router);
}
