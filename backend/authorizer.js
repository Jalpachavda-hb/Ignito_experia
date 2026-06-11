/**
 * API Gateway HTTP API Lambda authorizer (payload format 2.0).
 * Handler: authorizer.handler
 */
import { verifyAccessToken, getBearerToken } from "./lib/jwt.js";

export const handler = async (event) => {
  const headers = {};
  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      headers[key.toLowerCase()] = value;
    }
  }

  const token = getBearerToken(headers);
  if (!token) {
    return { isAuthorized: false };
  }

  try {
    const claims = verifyAccessToken(token);
    return {
      isAuthorized: true,
      context: {
        userId: claims.sub,
        email: claims.email || "",
        role: claims.role || "Tenant User",
      },
    };
  } catch {
    return { isAuthorized: false };
  }
};
