import { createHandler } from "./lib/apigw.js";
import { healthHandler, databaseHealthHandler } from "./handlers/health.js";
import {
  authRegisterHandler,
  authLoginHandler,
  authRefreshHandler,
  authLogoutHandler,
  authMeHandler,
} from "./handlers/auth.js";
import {
  labsListHandler,
  labsGetHandler,
  subLabsHandler,
  labsAdminListHandler,
  createLabHandler,
  updateLabHandler,
  updateLabStatusHandler,
  deleteLabHandler,
  restoreLabHandler,
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
  usersCreateHandler,
  usersUpdateStatusHandler,
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
  { method: "GET", path: "/auth/me", handler: authMeHandler, auth: true },


  { method: "GET", path: "/users", handler: usersListHandler, auth: true },
  { method: "POST", path: "/users", handler: usersCreateHandler, auth: true },
  { method: "PATCH", path: "/users/:userId/status", handler: usersUpdateStatusHandler, auth: true },

  { method: "GET", path: "/roles", handler: rolesListHandler, auth: true },
  { method: "GET", path: "/roles/:roleId", handler: rolesGetHandler, auth: true },
  { method: "POST", path: "/roles", handler: rolesCreateHandler, auth: true },
  { method: "PATCH", path: "/roles/:roleId", handler: rolesUpdateHandler, auth: true },
  { method: "DELETE", path: "/roles/:roleId", handler: rolesDeleteHandler, auth: true },









  // Labs 
  
  { method: "GET", path: "/admin/labs", handler: labsAdminListHandler, auth: true },
  { method: "POST", path: "/admin/labs", handler: createLabHandler, auth: true },
  { method: "GET", path: "/admin/labs/:labId", handler: labsGetHandler, auth: true },
  { method: "PUT", path: "/admin/labs/:labId", handler: updateLabHandler, auth: true },
  { method: "PATCH", path: "/admin/labs/:labId/status", handler: updateLabStatusHandler, auth: true },
  { method: "DELETE", path: "/admin/labs/:labId", handler: deleteLabHandler, auth: true },
  { method: "POST", path: "/admin/labs/:labId/restore", handler: restoreLabHandler, auth: true },
  






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
