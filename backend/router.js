import { createHandler } from "./lib/apigw.js";
import { healthHandler, databaseHealthHandler } from "./handlers/health.js";
import {
  authRegisterHandler,
  authLoginHandler,
  authRefreshHandler,
  authLogoutHandler,
  authMeHandler,
  ssoLoginHandler,
} from "./handlers/auth.js";
import {
  labsListHandler,
  labsGetHandler,
  subLabsHandler,
  labsAdminListHandler,
  labsCreateHandler,
  labsUpdateHandler,
  labsDeleteHandler,
  labsUpdateStatusHandler,
} from "./handlers/labs.js";
import {
  sessionsStartHandler,
  sessionsGetHandler,
  sessionsStopHandler,
  sessionsListByUserHandler,
} from "./handlers/sessions.js";
import { runsCreateHandler, runsGetHandler, runLegacyHandler } from "./handlers/runs.js";
import {
  filesListHandler,
  filesContentHandler,
  filesSaveHandler,
  filesDeleteHandler,
} from "./handlers/files.js";
import { submitHandler } from "./handlers/submit.js";
import { jupyterHealthHandler } from "./handlers/jupyterHealth.js";
import {
  usersListHandler,
  usersGetByIdHandler,
  usersCreateHandler,
  usersUpdateHandler,
  usersUpdateStatusHandler,
  usersDeleteHandler,
  usersResetPasswordHandler,
  usersImportHandler,
  usersAddCreditsHandler,
} from "./handlers/users.js";
import { runtimeTypesListHandler } from "./handlers/runtimeTypes.js";
import {
  rolesListHandler,
  rolesGetHandler,
  rolesCreateHandler,
  rolesUpdateHandler,
  rolesDeleteHandler,
} from "./handlers/roles.js";

/**
 * Route table — paths match AWS API Gateway (no /api prefix).
 * Local Express mounts these under API_PREFIX (/api by default).
 * Each handler is Lambda-ready via createHandler().
 */
export const ROUTES = [
  { method: "GET", path: "/health", handler: healthHandler, auth: false },
  { method: "GET", path: "/health/database", handler: databaseHealthHandler, auth: false },

  { method: "POST", path: "/auth/register", handler: authRegisterHandler, auth: false },
  { method: "POST", path: "/auth/login", handler: authLoginHandler, auth: false },
  { method: "POST", path: "/auth/refresh", handler: authRefreshHandler, auth: false },
  { method: "POST", path: "/auth/logout", handler: authLogoutHandler, auth: false },
  { method: "POST", path: "/auth/sso-login", handler: ssoLoginHandler, auth: false },
  { method: "GET", path: "/auth/me", handler: authMeHandler, auth: true },

  // Phase 7: App Bootstrap
  { method: "GET", path: "/app/bootstrap", handler: (event) => import("./handlers/bootstrap.js").then(m => m.appBootstrapHandler(event)), auth: true },

  // Admin Student Management
  { method: "GET", path: "/admin/students", handler: (event) => import("./handlers/students.js").then(m => m.studentsListHandler(event)), auth: true },
  { method: "GET", path: "/admin/students/statistics", handler: (event) => import("./handlers/students.js").then(m => m.studentsStatisticsHandler(event)), auth: true },
  { method: "GET", path: "/admin/students/:id", handler: (event) => import("./handlers/students.js").then(m => m.studentsDetailHandler(event)), auth: true },
  { method: "PUT", path: "/admin/students/:id", handler: (event) => import("./handlers/students.js").then(m => m.studentsUpdateHandler(event)), auth: true },
  { method: "PATCH", path: "/admin/students/:id/status", handler: (event) => import("./handlers/students.js").then(m => m.studentsStatusHandler(event)), auth: true },

  // Auth Session Management (Phase 4)
  { method: "GET", path: "/auth/session/current", handler: (event) => import("./handlers/authSessions.js").then(m => m.currentAuthSessionHandler(event)), auth: true },
  { method: "GET", path: "/auth/sessions", handler: (event) => import("./handlers/authSessions.js").then(m => m.userAuthSessionsHandler(event)), auth: true },
  { method: "DELETE", path: "/auth/sessions", handler: (event) => import("./handlers/authSessions.js").then(m => m.revokeAllMyOtherSessionsHandler(event)), auth: true },
  { method: "DELETE", path: "/auth/sessions/:id", handler: (event) => import("./handlers/authSessions.js").then(m => m.revokeMyAuthSessionHandler(event)), auth: true },
  { method: "GET", path: "/admin/sessions", handler: (event) => import("./handlers/authSessions.js").then(m => m.adminListSessionsHandler(event)), auth: true },
  { method: "GET", path: "/admin/sessions/statistics", handler: (event) => import("./handlers/authSessions.js").then(m => m.sessionStatisticsHandler(event)), auth: true },
  { method: "DELETE", path: "/admin/sessions/:id", handler: (event) => import("./handlers/authSessions.js").then(m => m.forceLogoutAdminHandler(event)), auth: true },

  // Enterprise Audit Logging (Phase 5)
  { method: "GET", path: "/admin/audit", handler: (event) => import("./handlers/audit.js").then(m => m.auditListHandler(event)), auth: true },
  { method: "GET", path: "/admin/audit/statistics", handler: (event) => import("./handlers/audit.js").then(m => m.auditStatisticsHandler(event)), auth: true },
  { method: "GET", path: "/admin/audit/export/csv", handler: (event) => import("./handlers/audit.js").then(m => m.auditExportCsvHandler(event)), auth: true },
  { method: "GET", path: "/admin/audit/export/excel", handler: (event) => import("./handlers/audit.js").then(m => m.auditExportExcelHandler(event)), auth: true },
  { method: "GET", path: "/admin/audit/export/pdf", handler: (event) => import("./handlers/audit.js").then(m => m.auditExportPdfHandler(event)), auth: true },



  // Phase 8 Analytics Widgets
  { method: "GET", path: "/admin/analytics/widgets/overview", handler: (event) => import("./handlers/analytics.js").then(m => m.analyticsOverviewWidgetHandler(event)), auth: true },
  { method: "GET", path: "/admin/analytics/widgets/realtime", handler: (event) => import("./handlers/analytics.js").then(m => m.analyticsRealtimeWidgetHandler(event)), auth: true },


  { method: "GET", path: "/users", handler: usersListHandler, auth: true },
  { method: "GET", path: "/users/:userId", handler: usersGetByIdHandler, auth: true },
  { method: "POST", path: "/users", handler: usersCreateHandler, auth: true },
  { method: "PUT", path: "/users/:userId", handler: usersUpdateHandler, auth: true },
  { method: "PATCH", path: "/users/:userId/status", handler: usersUpdateStatusHandler, auth: true },
  { method: "DELETE", path: "/users/:userId", handler: usersDeleteHandler, auth: true },
  { method: "POST", path: "/users/:userId/reset-password", handler: usersResetPasswordHandler, auth: true },
  { method: "POST", path: "/users/:userId/credits", handler: usersAddCreditsHandler, auth: true },
  { method: "POST", path: "/users/import", handler: usersImportHandler, auth: true },

  { method: "GET", path: "/roles", handler: rolesListHandler, auth: true },
  { method: "GET", path: "/roles/:roleId", handler: rolesGetHandler, auth: true },
  { method: "POST", path: "/roles", handler: rolesCreateHandler, auth: true },
  { method: "PATCH", path: "/roles/:roleId", handler: rolesUpdateHandler, auth: true },
  { method: "DELETE", path: "/roles/:roleId", handler: rolesDeleteHandler, auth: true },









  // Labs 
  
  { method: "GET", path: "/admin/labs", handler: labsAdminListHandler, auth: true },
  { method: "GET", path: "/admin/labs/:labId", handler: labsGetHandler, auth: true },
  { method: "POST", path: "/admin/labs", handler: labsCreateHandler, auth: true },
  { method: "PUT", path: "/admin/labs/:labId", handler: labsUpdateHandler, auth: true },
  { method: "DELETE", path: "/admin/labs/:labId", handler: labsDeleteHandler, auth: true },
  { method: "PATCH", path: "/admin/labs/:labId/status", handler: labsUpdateStatusHandler, auth: true },
  






  { method: "GET", path: "/labs", handler: labsListHandler, auth: true },
  { method: "GET", path: "/labs/:labId", handler: labsGetHandler, auth: true },
  { method: "GET", path: "/sub-labs", handler: subLabsHandler, auth: true },
  
  { method: "GET", path: "/admin/runtime-types", handler: runtimeTypesListHandler, auth: true },

  { method: "POST", path: "/lab-sessions", handler: sessionsStartHandler, auth: true },
  {
    method: "GET",
    path: "/lab-sessions/user/:userId",
    handler: sessionsListByUserHandler,
    auth: true,
  },
  {
    method: "GET",
    path: "/lab-sessions/:sessionId/jupyter-health",
    handler: jupyterHealthHandler,
    auth: true,
  },
  { method: "GET", path: "/lab-sessions/:sessionId", handler: sessionsGetHandler, auth: true },
  {
    method: "POST",
    path: "/lab-sessions/:sessionId/stop",
    handler: sessionsStopHandler,
    auth: true,
  },

  { method: "POST", path: "/runs", handler: runsCreateHandler, auth: true },
  { method: "GET", path: "/runs/:runId", handler: runsGetHandler, auth: true },
  { method: "POST", path: "/submit", handler: submitHandler, auth: true },
  { method: "POST", path: "/run", handler: runLegacyHandler, auth: true, aliases: [] },

  { method: "GET", path: "/files", handler: filesListHandler, auth: true },
  { method: "GET", path: "/files/content", handler: filesContentHandler, auth: true },
  { method: "POST", path: "/save", handler: filesSaveHandler, auth: true },
  { method: "DELETE", path: "/files", handler: filesDeleteHandler, auth: true },
];

export const lambdaHandlers = Object.fromEntries(
  ROUTES.map((route) => [
    `${route.method} ${route.path}`,
    createHandler(route.handler, { auth: route.auth }),
  ]),
);

export const matchRoute = (method, path) => {
  const normalized = path.split("?")[0].replace(/\/+$/, "") || "/";

  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const pattern = route.path.replace(/:([^/]+)/g, "([^/]+)");
    const regex = new RegExp(`^${pattern}$`);
    const match = normalized.match(regex);
    if (!match) continue;

    const keys = [...route.path.matchAll(/:([^/]+)/g)].map((m) => m[1]);
    const pathParameters = {};
    keys.forEach((key, i) => {
      pathParameters[key] = match[i + 1];
    });
    return { route, pathParameters };
  }
  return null;
};
