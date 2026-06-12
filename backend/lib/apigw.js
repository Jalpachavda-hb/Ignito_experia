import { HttpError } from "./errors.js";

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
    headers,
    raw: event,
  };
};

export const createHandler = (fn, { auth = false } = {}) => {
  return async (event) => {
    try {
      const parsed = parseApiEvent(event);
      if (auth) {
        const { requireAuth } = await import("./jwt.js");
        parsed.auth = requireAuth(parsed);
      }
      const result = await fn(parsed);
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

export const ok = (data, statusCode = 200) => ({ statusCode, body: { success: true, ...data } });
export const serverError = (data, statusCode = 500) => ({ statusCode, body: { success: false, ...data } });
export const notFound = (message = "Not found") => ({ statusCode: 404, body: { success: false, message } });

export const expressRoute = (app, route, apiPrefix) => {
  const fullPath = `${apiPrefix}${route.path}`;
  const method = route.method.toLowerCase();

  app[method](fullPath, async (req, res) => {
    const event = {
      requestContext: { http: { method: req.method } },
      rawPath: req.path.replace(apiPrefix, "") || "/",
      path: req.path,
      pathParameters: req.params,
      queryStringParameters: req.query,
      body: req.body,
      headers: req.headers,
    };

    try {
      if (route.auth) {
        const { requireAuth } = await import("./jwt.js");
        event.auth = requireAuth({ headers: req.headers });
      }
      const parsed = parseApiEvent(event);
      if (route.auth) parsed.auth = event.auth;
      const result = await route.handler(parsed);
      const response =
        result?.statusCode && result?.body
          ? result
          : jsonResponse(result?.statusCode ?? 200, result?.body ?? result);
      res.status(response.statusCode).set(response.headers).send(response.body);
    } catch (err) {
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
