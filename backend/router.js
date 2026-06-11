import { createHandler } from "./lib/apigw.js";
import { healthHandler } from "./handlers/health.js";
import { authLoginHandler } from "./handlers/authLogin.js";
import { labsListHandler, labsGetHandler, subLabsHandler } from "./handlers/labs.js";
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

/**
 * Route table — paths match AWS API Gateway (no /api prefix).
 * Local Express mounts these under API_PREFIX (/api by default).
 * Each handler is Lambda-ready via createHandler().
 */
export const ROUTES = [
  { method: "GET", path: "/health", handler: healthHandler, auth: false },

  { method: "POST", path: "/auth/login", handler: authLoginHandler, auth: false },

  { method: "GET", path: "/users", handler: usersListHandler, auth: true },
  { method: "POST", path: "/users", handler: usersCreateHandler, auth: true },
  { method: "PATCH", path: "/users/:userId/status", handler: usersUpdateStatusHandler, auth: true },

  { method: "GET", path: "/labs", handler: labsListHandler, auth: true },
  { method: "GET", path: "/labs/:labId", handler: labsGetHandler, auth: true },
  { method: "GET", path: "/sub-labs", handler: subLabsHandler, auth: true },

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
