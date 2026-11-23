/**
 * Lab start authorization and SSO identity binding, on the isolated schema vlab_session_test.
 * ECS, DynamoDB, SSM and the LMS are all disabled/unreachable here: no AWS or LMS call is made.
 * LAB_WORKSPACE points at a throwaway temp folder (lab start clears the local workspace).
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import os from "os";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { prepareTestSchema, makePoolStrict, testConnection } from "../helpers/testDb.mjs";

const SCHEMA = "vlab_session_test";
await prepareTestSchema(SCHEMA);
Object.assign(process.env, {
  SESSIONS_TABLE_NAME: "",
  DYNAMODB_TABLE_NAME: "",
  ECS_CLUSTER: "",
  DISABLE_SSM: "true",
  REDIS_URL: "redis://127.0.0.1:1",
  REDIS_RETRY_AFTER_MS: "600000",
  LMS_API_BASE_URL: "http://127.0.0.1:1",
  LMS_TOKEN_ENDPOINT: "http://127.0.0.1:1/oauth/token",
  LMS_JWT_SECRET: "session-test-lms-secret",
  LMS_SSO_ISSUERS: "",
  LMS_AUTH0_DOMAIN: "",
  OWNER_API_URL: "http://127.0.0.1:1",
  LAB_WORKSPACE: fs.mkdtempSync(path.join(os.tmpdir(), "vlab-ws-")),
});

const { default: pool } = await import("../../lib/mysql.js");
makePoolStrict(pool);
const { sessionsStartHandler } = await import("../../handlers/sessions.js");
const { ssoService } = await import("../../services/SsoService.js");

let db;
before(async () => {
  db = await testConnection(SCHEMA);
  await db.query(`INSERT INTO tenants (TenantId, Name, Slug, Status) VALUES ('TEN_A','Uni A','unia','ACTIVE')`);
  await db.query(
    `INSERT INTO Users (UserId, FullName, Email, Role, Status, CreatedFrom, AuthType, TenantId, ExternalStudentId, StudentId) VALUES
     (201,'Student A','sa@uni.test','Student','Active','LMS','LMS','TEN_A','7001','7001'),
     (202,'Direct B','db@mail.test','Student','Active','DIRECT','DIRECT','PLATFORM',NULL,NULL)`
  );
});
after(async () => {
  await db?.end();
  await pool.end();
});

test("no free tokens: an LMS student cannot self-grant course credit for an unassigned lab", async () => {
  // Before: academicCtx/practicalCredit in the body created a wallet for ANY lab.
  await assert.rejects(
    sessionsStartHandler({
      auth: { userId: 201, email: "sa@uni.test", tenantId: "TEN_A", role: "Student", authType: "LMS" },
      body: { labId: "oracle", academicCtx: { programId: "2", semesterId: "1", courseCode: "X" }, practicalCredit: 5000 },
    }),
    { statusCode: 403 }
  );
  const [w] = await db.query("SELECT * FROM student_lab_token_wallets");
  assert.equal(w.length, 0, "no wallet was created");
});

test("a student with tokens for the lab can start it (mock runtime, no ECS)", async () => {
  await db.query(
    `INSERT INTO student_lab_token_wallets (TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, RemainingTokens, Version)
     VALUES ('PLATFORM','202','postgres',60,0,60,1)`
  );
  const res = await sessionsStartHandler({ auth: { userId: 202, email: "db@mail.test", role: "Student" }, body: { labId: "postgres" } });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.sessionId);
  const [[row]] = await db.query("SELECT TenantId, UserId FROM lab_sessions WHERE SessionId = ?", [res.body.sessionId]);
  assert.equal(Number(row.UserId), 202);
});

test("body tenantId is ignored at lab start", async () => {
  const [[before]] = await db.query("SELECT COUNT(*) n FROM lab_sessions");
  await sessionsStartHandler({
    auth: { userId: 202, email: "db@mail.test", role: "Student" },
    body: { labId: "postgres", tenantId: "TEN_A" },
  }).catch(() => {});
  const [rows] = await db.query("SELECT TenantId FROM lab_sessions");
  assert.ok(rows.every((r) => r.TenantId !== "TEN_A"), "no session was written under the body's tenant");
  assert.ok(rows.length >= Number(before.n));
});

test("unknown account is refused instead of creating a placeholder student", async () => {
  await assert.rejects(
    sessionsStartHandler({ auth: { userId: 999999, email: "ghost@x.test", role: "Super Admin" }, body: { labId: "postgres" } }),
    { statusCode: 401 }
  );
  const [[u]] = await db.query("SELECT COUNT(*) n FROM Users WHERE UserId = 999999 OR Email LIKE 'student_%'");
  assert.equal(Number(u.n), 0);
});

test("SSO: a request id that contradicts the signed token is rejected (no account takeover)", async () => {
  const token = jwt.sign({ sub: "lms|7001", studentId: "7001", email: "sa@uni.test" }, process.env.LMS_JWT_SECRET, { expiresIn: 60 });
  await assert.rejects(
    ssoService.verifyLmsToken({ token, studentId: "7002", slug: "unia", host: "unia.ignitoexperia.com" }),
    { statusCode: 401 }
  );
});

test("SSO: forged token is rejected before any account work", async () => {
  const forged = jwt.sign({ sub: "lms|7001", studentId: "7001" }, "not-the-secret", { expiresIn: 60 });
  await assert.rejects(ssoService.verifyLmsToken({ token: forged, slug: "unia" }), { statusCode: 401 });
  const [[n]] = await db.query("SELECT COUNT(*) n FROM SSOReplayStore");
  assert.equal(Number(n.n), 0);
});
