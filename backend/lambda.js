/**
 * Single Lambda entry for API Gateway HTTP API (payload format 2.0).
 * Deploy this file as handler: lambda.handler
 *
 * For per-route Lambdas (matching vlab/terraform), import individual handlers:
 *   export { handler } from './handlers/wrapped/sessionsStart.js';
 */
import { matchRoute, lambdaHandlers } from "./router.js";
import { jsonResponse, parseApiEvent } from "./lib/apigw.js";
import { requireAuth } from "./lib/jwt.js";

export const handler = async (event, context) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const path = event.rawPath || event.path || "/";

  if (method === "OPTIONS") {
    return jsonResponse(204, {});
  }

  const matched = matchRoute(method, path);
  if (!matched) {
    return jsonResponse(404, {
      success: false,
      message: `Route not found: ${method} ${path}`,
    });
  }

  const routeKey = `${matched.route.method} ${matched.route.path}`;
  const fn = lambdaHandlers[routeKey];

  const enrichedEvent = {
    ...event,
    pathParameters: {
      ...(event.pathParameters || {}),
      ...matched.pathParameters,
    },
  };

  const parsed = parseApiEvent(enrichedEvent);

  if (matched.route.auth) {
    parsed.auth = requireAuth({ ...enrichedEvent, headers: parsed.headers });
    enrichedEvent.auth = parsed.auth;
  }

  return fn({ ...enrichedEvent, ...parsed }, context);
};
