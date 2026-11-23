import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const { verifyLmsSsoToken, clearJwksCache } = await import("../../lib/lmsSsoVerifier.js");

const SECRET = "test-lms-secret-value";
const ISSUER = "https://lms-tenant.example-auth.test/";
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", use: "sig", alg: "RS256" };
const fetchJwks = async (url) => {
  assert.equal(url, `${ISSUER}.well-known/jwks.json`);
  return { ok: true, status: 200, json: async () => ({ keys: [jwk] }) };
};
const baseEnv = { LMS_JWT_SECRET: SECRET, LMS_SSO_ISSUERS: ISSUER };

test("HS256 token signed with LMS_JWT_SECRET is accepted", async () => {
  const token = jwt.sign({ sub: "s-1", studentId: "77" }, SECRET, { expiresIn: 60 });
  const payload = await verifyLmsSsoToken(token, { env: baseEnv });
  assert.equal(payload.sub, "s-1");
});

test("forged HS256 token is rejected (was accepted by the decode-only fallback)", async () => {
  const forged = jwt.sign({ sub: "victim", studentId: "1" }, "attacker-secret");
  await assert.rejects(verifyLmsSsoToken(forged, { env: baseEnv }), { statusCode: 401 });
});

test("unsigned alg=none token is rejected", async () => {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ sub: "victim" })).toString("base64url");
  await assert.rejects(verifyLmsSsoToken(`${header}.${body}.`, { env: baseEnv }), { statusCode: 401 });
});

test("expired token is rejected", async () => {
  const token = jwt.sign({ sub: "s-1", exp: Math.floor(Date.now() / 1000) - 3600 }, SECRET);
  await assert.rejects(verifyLmsSsoToken(token, { env: baseEnv }), { statusCode: 401 });
});

test("HS token is rejected when no secret is configured (no hard-coded fallback)", async () => {
  const token = jwt.sign({ sub: "s-1" }, "default_lms_secret");
  await assert.rejects(verifyLmsSsoToken(token, { env: { LMS_SSO_ISSUERS: ISSUER } }), { statusCode: 401 });
});

test("RS256 token verified against the trusted issuer's JWKS", async () => {
  clearJwksCache();
  const token = jwt.sign({ sub: "auth0|abc", email: "s@uni.test" }, privateKey, { algorithm: "RS256", keyid: "k1", issuer: ISSUER, expiresIn: 60 });
  const payload = await verifyLmsSsoToken(token, { env: baseEnv, fetchImpl: fetchJwks });
  assert.equal(payload.sub, "auth0|abc");
});

test("RS256 token from an untrusted issuer is rejected", async () => {
  clearJwksCache();
  const token = jwt.sign({ sub: "x" }, privateKey, { algorithm: "RS256", keyid: "k1", issuer: "https://evil.test/", expiresIn: 60 });
  await assert.rejects(verifyLmsSsoToken(token, { env: baseEnv, fetchImpl: fetchJwks }), { statusCode: 401 });
});

test("RS256 token signed by another key is rejected", async () => {
  clearJwksCache();
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  const token = jwt.sign({ sub: "x" }, other, { algorithm: "RS256", keyid: "k1", issuer: ISSUER, expiresIn: 60 });
  await assert.rejects(verifyLmsSsoToken(token, { env: baseEnv, fetchImpl: fetchJwks }), { statusCode: 401 });
});

test("JWKS outage answers 503 (retryable), not 'accepted'", async () => {
  clearJwksCache();
  const token = jwt.sign({ sub: "x" }, privateKey, { algorithm: "RS256", keyid: "k1", issuer: ISSUER, expiresIn: 60 });
  const down = async () => { throw new Error("ECONNREFUSED"); };
  await assert.rejects(verifyLmsSsoToken(token, { env: baseEnv, fetchImpl: down }), { statusCode: 503 });
});

test("issuer derived from LMS_AUTH0_DOMAIN when LMS_SSO_ISSUERS is unset", async () => {
  clearJwksCache();
  const token = jwt.sign({ sub: "auth0|d" }, privateKey, { algorithm: "RS256", keyid: "k1", issuer: ISSUER, expiresIn: 60 });
  const payload = await verifyLmsSsoToken(token, { env: { LMS_AUTH0_DOMAIN: "lms-tenant.example-auth.test" }, fetchImpl: fetchJwks });
  assert.equal(payload.sub, "auth0|d");
});
