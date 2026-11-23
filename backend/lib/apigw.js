import crypto from "crypto";
import { HttpError } from "./errors.js";

/**
 * Structured request timing. One JSON line per request:
 *   {"type":"api","requestId","method","route","status","ms"}
 * Route is the route TEMPLATE (/lab-sessions/:sessionId), so no ids, tokens or personal data
 * are logged. PERF_LOG=1 logs every request; otherwise only requests slower than
 * PERF_LOG_SLOW_MS (default 1000 ms) and 5xx responses are logged.
 */
const PERF_LOG_ALL = ["1", "true", "yes"].includes(String(process.env.PERF_LOG || "").toLowerCase());
const PERF_LOG_SLOW_MS = Number(process.env.PERF_LOG_SLOW_MS || 1000);

export const elapsedMs = (startedAt) => Number(process.hrtime.bigint() - startedAt) / 1e6;

function cleanRequestId(value) {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9._:-]{8,100}$/.test(text) ? text : "";
}

export function logRequestTiming({ requestId, method, route, status, startedAt }) {
  const ms = elapsedMs(startedAt);
  if (!PERF_LOG_ALL && ms < PERF_LOG_SLOW_MS && status < 500) return;
  console.log(JSON.stringify({ type: "api", requestId, method, route, status, ms: Math.round(ms) }));
}

export const jsonResponse = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

export const parseApiEvent = (event) => {
  const method =
    event.requestContext?.http?.method || event.httpMethod || "GET";
  const rawPath = event.rawPath || event.path || "/";
  const pathParameters = event.pathParameters || {};
  const queryStringParameters = event.queryStringParameters || {};

  let body = event.body ?? {};
  if (typeof body === "string") {
    if (event.isBase64Encoded) {
      body = JSON.parse(Buffer.from(body, "base64").toString("utf-8"));
    } else {
      body = body ? JSON.parse(body) : {};
    }
  }

  const headers = {};
  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      headers[key.toLowerCase()] = value;
    }
  }

  return {
    method,
    path: rawPath.split("?")[0],
    pathParameters,
    queryStringParameters,
    body,
    files: event.files || [],
    headers,
    raw: event,
  };
};

async function withStudentLmsContext(parsed, fn) {
  const { runWithStudentLmsToken, loadRememberedStudentLmsToken } = await import("../services/lms/studentLmsToken.js");
  const { getBearerToken } = await import("./jwt.js");
  const raw = parsed.headers?.["x-lms-token"] || parsed.headers?.["x-student-token"] || "";
  let lmsToken = String(raw).replace(/^(?:Bearer\s+)+/i, "").trim();
  const userId = parsed.auth?.userId || null;
  if (!lmsToken && userId) {
    lmsToken = await loadRememberedStudentLmsToken(userId);
  }
  if (!lmsToken) {
    lmsToken = getBearerToken(parsed.headers);
  }
  return runWithStudentLmsToken(
    { userId, lmsToken },
    () => fn(parsed)
  );
}

export const createHandler = (fn, { auth = false } = {}) => {
  return async (event) => {
    try {
      const parsed = parseApiEvent(event);
      if (auth) {
        const { requireAuth } = await import("./jwt.js");
        parsed.auth = requireAuth(parsed);
      }
      const result = await withStudentLmsContext(parsed, fn);
      if (result?.statusCode) return result;
      return jsonResponse(result?.statusCode ?? 200, result?.body ?? result);
    } catch (err) {
      if (err instanceof HttpError) {
        return jsonResponse(err.statusCode, {
          success: false,
          message: err.message,
          ...err.extra,
        });
      }
      console.error("[Handler Error]", err);
      return jsonResponse(500, {
        success: false,
        message: err.message || "Internal server error",
      });
    }
  };
};

export const ok = (data, statusCode = 200, headers = {}) => ({ statusCode, headers, body: { success: true, ...data } });
export const serverError = (data, statusCode = 500, headers = {}) => ({ statusCode, headers, body: { success: false, ...data } });
export const notFound = (message = "Not found", headers = {}) => ({ statusCode: 404, headers, body: { success: false, message } });

export const expressRoute = (app, route, apiPrefix) => {
  const fullPath = `${apiPrefix}${route.path}`;
  const method = route.method.toLowerCase();

  app[method](fullPath, async (req, res) => {
    const startedAt = process.hrtime.bigint();
    const requestId = cleanRequestId(req.headers["x-request-id"]) || crypto.randomUUID();
    res.setHeader("X-Request-Id", requestId);
    res.on("finish", () => logRequestTiming({ requestId, method: route.method, route: route.path, status: res.statusCode, startedAt }));

    const event = {
      requestContext: { http: { method: req.method }, requestId },
      rawPath: req.path.replace(apiPrefix, "") || "/",
      path: req.path,
      pathParameters: req.params,
      queryStringParameters: req.query,
      body: req.body,
      rawBody: req.rawBody,
      files: req.files || [],
      headers: req.headers,
    };

    try {
      if (route.auth) {
        const { requireAuth } = await import("./jwt.js");
        event.auth = requireAuth({ headers: req.headers, queryStringParameters: req.query });
      }
      const parsed = parseApiEvent(event);
      if (route.auth) parsed.auth = event.auth;
      const result = await withStudentLmsContext(parsed, route.handler);
      const response =
        result?.statusCode && result?.body
          ? result
          : jsonResponse(result?.statusCode ?? 200, result?.body ?? result, result?.headers || {});

      const headers = { ...response.headers, ...(result?.headers || {}) };
      const reqOrigin = req.headers.origin;
      if (reqOrigin) {
        headers["Access-Control-Allow-Origin"] = reqOrigin;
        headers["Access-Control-Allow-Credentials"] = "true";
      }
      headers["Server-Timing"] = `app;dur=${elapsedMs(startedAt).toFixed(1)}`;

      res.status(response.statusCode).set(headers).send(response.body);
    } catch (err) {
      const origin = req.headers.origin || "*";
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");

      if (err instanceof HttpError) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  for (const alias of route.aliases || []) {
    expressRoute(app, { ...route, path: alias, aliases: [] }, apiPrefix);
  }
};
