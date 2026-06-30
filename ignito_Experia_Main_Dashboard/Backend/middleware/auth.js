import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import { unauthorized } from "../lib/apigw.js";

/**
 * JWT verification middleware.
 * Attaches decoded payload to req.auth
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const resp = unauthorized("Missing or invalid Authorization header");
    return res.status(resp.statusCode).json(resp.body);
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, ENV.jwtSecret);
    req.auth = decoded;
    next();
  } catch (err) {
    const resp = unauthorized("Token is invalid or expired");
    return res.status(resp.statusCode).json(resp.body);
  }
}
