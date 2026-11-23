/**
 * Verifies LMS SSO tokens. A token is accepted only when its signature checks out:
 *   - HS256/384/512 with LMS_JWT_SECRET (only when that secret is configured), or
 *   - RS256/ES256 with the public keys (JWKS) of a trusted issuer.
 *
 * Trusted issuers: LMS_SSO_ISSUERS (comma separated), else https://{LMS_AUTH0_DOMAIN}/.
 * Optional: LMS_SSO_AUDIENCE (comma separated), LMS_SSO_CLOCK_TOLERANCE_SECONDS (default 60).
 *
 * LMS_SSO_VERIFICATION=legacy-insecure restores the old decode-without-verify behaviour. It exists
 * only as an emergency switch while the LMS token contract is confirmed; every use is logged.
 */
import crypto from "crypto";
import jwt from "jsonwebtoken";
import "../config/env.js";
import { unauthorized, HttpError } from "./errors.js";

const JWKS_TTL_MS = 10 * 60 * 1000;
const jwksCache = new Map(); // issuer -> { keys, expiresAt, pending }

function list(value) {
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function normaliseIssuer(value) {
  let v = String(value || "").trim();
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v.endsWith("/") ? v : `${v}/`;
}

export function ssoConfig(env = process.env) {
  const issuers = list(env.LMS_SSO_ISSUERS).map(normaliseIssuer);
  if (!issuers.length && env.LMS_AUTH0_DOMAIN) issuers.push(normaliseIssuer(env.LMS_AUTH0_DOMAIN));
  return {
    mode: String(env.LMS_SSO_VERIFICATION || "strict").trim().toLowerCase(),
    secret: env.LMS_JWT_SECRET || "",
    issuers,
    audiences: list(env.LMS_SSO_AUDIENCE),
    clockTolerance: Number(env.LMS_SSO_CLOCK_TOLERANCE_SECONDS || 60),
  };
}

async function fetchJwks(issuer, fetchImpl) {
  const now = Date.now();
  const cached = jwksCache.get(issuer);
  if (cached?.keys && cached.expiresAt > now) return cached.keys;
  if (cached?.pending) return cached.pending;

  const pending = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetchImpl(`${issuer}.well-known/jwks.json`, { signal: controller.signal });
      if (!res.ok) throw new Error(`JWKS HTTP ${res.status}`);
      const body = await res.json();
      const keys = Array.isArray(body?.keys) ? body.keys : [];
      jwksCache.set(issuer, { keys, expiresAt: Date.now() + JWKS_TTL_MS });
      return keys;
    } catch (err) {
      // Keep serving the last good key set when the issuer is briefly unreachable.
      if (cached?.keys) {
        jwksCache.set(issuer, { keys: cached.keys, expiresAt: Date.now() + 60_000 });
        return cached.keys;
      }
      jwksCache.delete(issuer);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  })();
  jwksCache.set(issuer, { ...(cached || {}), pending });
  return pending;
}

export function clearJwksCache() {
  jwksCache.clear();
}

function verifyOptions(cfg, algorithms) {
  const opts = { algorithms, clockTolerance: cfg.clockTolerance };
  if (cfg.audiences.length) opts.audience = cfg.audiences;
  return opts;
}

/**
 * @returns {Promise<object>} verified payload
 */
export async function verifyLmsSsoToken(token, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const cfg = ssoConfig(env);
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header || !decoded?.payload || typeof decoded.payload !== "object") {
    throw unauthorized("Invalid LMS token");
  }
  const alg = String(decoded.header.alg || "");

  if (cfg.mode === "legacy-insecure") {
    console.error("[LmsSso] LMS_SSO_VERIFICATION=legacy-insecure: accepting an UNVERIFIED LMS token. Configure JWKS/secret and remove this setting.");
    if (cfg.secret && alg.startsWith("HS")) {
      try {
        return jwt.verify(token, cfg.secret, verifyOptions(cfg, ["HS256", "HS384", "HS512"]));
      } catch {
        /* fall through to legacy decode */
      }
    }
    return decoded.payload;
  }

  if (alg.startsWith("HS")) {
    if (!cfg.secret) throw unauthorized("LMS token signature cannot be verified");
    try {
      return jwt.verify(token, cfg.secret, verifyOptions(cfg, ["HS256", "HS384", "HS512"]));
    } catch (err) {
      throw unauthorized(`LMS token verification failed: ${err.message}`);
    }
  }

  if (alg.startsWith("RS") || alg.startsWith("ES") || alg.startsWith("PS")) {
    const issuer = normaliseIssuer(decoded.payload.iss);
    if (!cfg.issuers.length) {
      throw new HttpError("LMS SSO is not configured on this server", 503, { code: "LMS_SSO_NOT_CONFIGURED" });
    }
    if (!issuer || !cfg.issuers.includes(issuer)) {
      throw unauthorized("LMS token issuer is not trusted");
    }
    let keys;
    try {
      keys = await fetchJwks(issuer, fetchImpl);
    } catch (err) {
      console.error(`[LmsSso] Could not load JWKS for ${issuer}: ${err.message}`);
      throw new HttpError("LMS sign-in is temporarily unavailable. Please try again.", 503, { code: "LMS_SSO_UNAVAILABLE" });
    }
    const kid = decoded.header.kid;
    const jwk = keys.find((k) => (kid ? k.kid === kid : true) && (!k.use || k.use === "sig"));
    if (!jwk) throw unauthorized("LMS token signing key is unknown");
    let publicKey;
    try {
      publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
    } catch {
      throw unauthorized("LMS token signing key is invalid");
    }
    try {
      return jwt.verify(token, publicKey, {
        ...verifyOptions(cfg, ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "PS256", "PS384", "PS512"]),
        issuer: decoded.payload.iss,
      });
    } catch (err) {
      throw unauthorized(`LMS token verification failed: ${err.message}`);
    }
  }

  throw unauthorized("LMS token algorithm is not allowed");
}
