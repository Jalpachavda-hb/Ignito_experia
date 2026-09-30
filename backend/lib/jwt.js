import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import { unauthorized } from "./errors.js";

export const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id || user.userId,
      userId: user.userId || user.id,
      profileId: user.profileId,
      email: user.email,
      role: user.role,
      name: user.name,
      roleId: user.roleId,
      source: user.source,
      tenantId: user.tenantId || user.universityId || null,
      tenantSlug: user.tenantSlug || null,
      tenantName: user.tenantName || null,
    },
    ENV.jwtSecret,
    { expiresIn: ENV.jwtExpiresIn },
  );

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, ENV.jwtSecret);
  } catch {
    throw unauthorized("Invalid or expired token");
  }
};

/** Short-lived token so Jupyter iframe can load via API proxy without Bearer headers. */
export const signJupyterEmbedToken = (sessionId, userId) =>
  jwt.sign(
    { sub: userId, sessionId, scope: "jupyter-embed" },
    ENV.jwtSecret,
    { expiresIn: "4h" },
  );

export const verifyJupyterEmbedToken = (token) => {
  try {
    const claims = jwt.verify(token, ENV.jwtSecret);
    if (claims.scope !== "jupyter-embed" || !claims.sessionId) {
      throw unauthorized("Invalid embed token");
    }
    return claims;
  } catch (err) {
    if (err.statusCode === 401) throw err;
    throw unauthorized("Invalid or expired embed token");
  }
};

export const getBearerToken = (headers = {}) => {
  const auth =
    headers.authorization ||
    headers.Authorization ||
    headers.AUTHORIZATION ||
    "";
  if (!auth) return null;
  const match = String(auth).replace(/^(?:Bearer\s+)+/i, "").trim();
  return match || null;
};

export const authFromAuthorizerContext = (event) => {
  const ctx =
    event.requestContext?.authorizer?.lambda ||
    event.requestContext?.authorizer?.jwt ||
    event.requestContext?.authorizer;

  if (!ctx?.userId) return null;

  return {
    userId: ctx.userId,
    email: ctx.email || "",
    role: ctx.role || "Tenant User",
    name: ctx.name || "",
    roleId: ctx.roleId ? parseInt(ctx.roleId, 10) : null,
    claims: ctx,
  };
};

export const requireAuth = (event) => {
  const fromAuthorizer = authFromAuthorizerContext(event);
  if (fromAuthorizer) {
    if (!fromAuthorizer.tenantId) {
      fromAuthorizer.tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'] || null;
    }
    return fromAuthorizer;
  }

  const token = getBearerToken(event.headers || {}) || event.queryStringParameters?.token;
  if (!token) throw unauthorized("Missing Authorization Bearer token");
  const claims = verifyAccessToken(token);
  const headerTenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'] || null;
  return {
    userId: claims.sub || claims.userId,
    profileId: claims.profileId,
    email: claims.email,
    role: claims.role,
    name: claims.name,
    roleId: claims.roleId,
    source: claims.source,
    tenantId: claims.tenantId || claims.tenant_id || claims.universityId || headerTenantId || null,
    tenantSlug: claims.tenantSlug || null,
    tenantName: claims.tenantName || null,
    claims,
  };
};
