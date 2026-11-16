// AWS console labs: lease a sandbox account, hand out console sign-in links, validate work,
// extend and end (docs/aws-console-labs.md §5). Cleanup itself runs in the Step Functions
// workflow from terraform-aws-sandbox/ (no backend code).
//
// AWS credentials never leave the backend: the browser only ever receives the sign-in URL.

import crypto from "crypto";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import {
  SchedulerClient,
  CreateScheduleCommand,
  UpdateScheduleCommand,
  DeleteScheduleCommand,
} from "@aws-sdk/client-scheduler";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { QueryCommand, UpdateCommand, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getDocClient } from "../../lib/dynamodb.js";
import { HttpError, badRequest, forbidden, notFound } from "../../lib/errors.js";
import { AWS_LABS, awsLabsInfra, isAwsLabType, missingAwsLabsConfig } from "../../config/awsLabs.js";
import { runValidation } from "./validators.js";

const FEDERATION = "https://signin.aws.amazon.com/federation";
const KIND = "aws-console";

const sts = new STSClient({ region: awsLabsInfra.region });
const scheduler = new SchedulerClient({ region: awsLabsInfra.region });
const sfn = new SFNClient({ region: awsLabsInfra.region });

const nowSec = () => Math.floor(Date.now() / 1000);
const scheduleName = (sessionId) => `end-${sessionId}`;

export const assertAwsLabsAvailable = () => {
  if (!awsLabsInfra.enabled) throw new HttpError("AWS console labs are not enabled", 503, { code: "NOT_ENABLED" });
  const missing = missingAwsLabsConfig();
  if (missing.length) {
    throw new HttpError("AWS console labs are not configured", 503, { code: "NOT_CONFIGURED" });
  }
};

/** Public lab list for GET /aws-labs and the catalog (no infra details). */
export const listAwsLabs = () =>
  Object.entries(AWS_LABS).map(([id, lab]) => ({
    id,
    kind: KIND,
    title: lab.title,
    durationMinutes: lab.durationMinutes,
    maxExtensions: lab.maxExtensions,
    extensionMinutes: lab.extensionMinutes,
    instructions: lab.instructions || null,
    region: awsLabsInfra.region,
    tasks: lab.tasks.map(({ id: taskId, title }) => ({ id: taskId, title })),
  }));

const tasksFor = (labType, bucketPrefix) =>
  AWS_LABS[labType].tasks.map((t) => ({
    id: t.id,
    title: bucketPrefix ? t.title.replace("<bucketPrefix>", bucketPrefix) : t.title,
  }));

/** What the browser may see about a session (no account id, no credentials, no URLs). */
const toPublic = (s) => {
  const lab = AWS_LABS[s.labType];
  return {
    sessionId: s.sessionId,
    kind: KIND,
    labType: s.labType,
    title: lab?.title,
    status: s.status,
    endReason: s.endReason || null,
    region: awsLabsInfra.region,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    serverTime: nowSec(),
    bucketPrefix: s.bucketPrefix,
    extensionsUsed: s.extensionsUsed || 0,
    canExtend: s.status === "READY" && (s.extensionsUsed || 0) < (lab?.maxExtensions || 0),
    extensionMinutes: lab?.extensionMinutes || 0,
    instructions: lab?.instructions || null,
    tasks: tasksFor(s.labType, s.bucketPrefix),
    lastValidation: s.lastValidation || null,
  };
};

const getSessionItem = async (sessionId) => {
  const res = await getDocClient().send(new GetCommand({ TableName: awsLabsInfra.sessionsTable, Key: { sessionId } }));
  return res.Item && res.Item.kind === KIND ? res.Item : null;
};

const getOwnedSession = async (sessionId, studentId) => {
  const s = await getSessionItem(sessionId);
  if (!s) throw notFound("Session not found");
  if (String(s.studentId) !== String(studentId)) throw forbidden("You do not own this session");
  return s;
};

const findActiveSessionForStudent = async (studentId) => {
  const res = await getDocClient().send(new QueryCommand({
    TableName: awsLabsInfra.sessionsTable,
    IndexName: awsLabsInfra.sessionsByStudentIndex,
    KeyConditionExpression: "studentId = :sid",
    FilterExpression: "kind = :kind AND #s = :ready",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":sid": String(studentId), ":kind": KIND, ":ready": "READY" },
  }));
  return (res.Items || []).find((s) => Number(s.expiresAt) > nowSec()) || null;
};

/** Atomically lease one AVAILABLE account (conditional write: two students never share one). */
const leaseAccount = async (sessionId, expiresAt) => {
  const doc = getDocClient();
  const res = await doc.send(new QueryCommand({
    TableName: awsLabsInfra.poolTable,
    IndexName: awsLabsInfra.poolStatusIndex,
    KeyConditionExpression: "#s = :available",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":available": "AVAILABLE" },
    Limit: 5,
  }));
  for (const acct of res.Items || []) {
    try {
      await doc.send(new UpdateCommand({
        TableName: awsLabsInfra.poolTable,
        Key: { accountId: acct.accountId },
        UpdateExpression: "SET #s = :leased, leaseSessionId = :sid, leaseExpiresAt = :exp",
        ConditionExpression: "#s = :available",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":leased": "LEASED", ":available": "AVAILABLE", ":sid": sessionId, ":exp": expiresAt },
      }));
      return acct.accountId;
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") continue;
      throw err;
    }
  }
  return null;
};

const releaseAccount = async (accountId, sessionId) => {
  await getDocClient().send(new UpdateCommand({
    TableName: awsLabsInfra.poolTable,
    Key: { accountId },
    UpdateExpression: "SET #s = :available REMOVE leaseSessionId, leaseExpiresAt",
    ConditionExpression: "#s = :leased AND leaseSessionId = :sid",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":available": "AVAILABLE", ":leased": "LEASED", ":sid": sessionId },
  })).catch(() => {});
};

const atExpression = (epochSec) => `at(${new Date(epochSec * 1000).toISOString().slice(0, 19)})`;

const scheduleTarget = (session) => ({
  Arn: awsLabsInfra.cleanupStateMachineArn,
  RoleArn: awsLabsInfra.schedulerRoleArn,
  Input: JSON.stringify({ sessionId: session.sessionId, accountId: session.accountId, reason: "EXPIRED" }),
});

/** POST /aws-labs/sessions */
export const startAwsLab = async ({ studentId, labType }) => {
  assertAwsLabsAvailable();
  if (!isAwsLabType(labType)) throw badRequest(`Unknown AWS lab: ${labType}`);

  const existing = await findActiveSessionForStudent(studentId);
  if (existing) {
    throw new HttpError("You already have an AWS lab running", 409, { code: "ALREADY_ACTIVE", sessionId: existing.sessionId });
  }

  const lab = AWS_LABS[labType];
  const sessionId = crypto.randomUUID();
  const createdAt = nowSec();
  const expiresAt = createdAt + lab.durationMinutes * 60;

  const accountId = await leaseAccount(sessionId, expiresAt);
  if (!accountId) {
    throw new HttpError("All AWS lab slots are busy", 503, { code: "NO_CAPACITY", retryAfterSeconds: 60 });
  }

  const session = {
    sessionId,
    kind: KIND,
    labType,
    studentId: String(studentId),
    accountId,
    status: "READY",
    createdAt,
    expiresAt,
    extensionsUsed: 0,
    // S3 bucket names are global across AWS; the S3 lab asks students to use this prefix.
    bucketPrefix: `vlab-${sessionId.replace(/-/g, "").slice(0, 6)}`,
  };

  try {
    await getDocClient().send(new PutCommand({
      TableName: awsLabsInfra.sessionsTable,
      Item: session,
      ConditionExpression: "attribute_not_exists(sessionId)",
    }));
    await scheduler.send(new CreateScheduleCommand({
      Name: scheduleName(sessionId),
      GroupName: awsLabsInfra.schedulerGroup,
      ScheduleExpression: atExpression(expiresAt),
      ScheduleExpressionTimezone: "UTC",
      FlexibleTimeWindow: { Mode: "OFF" },
      ActionAfterCompletion: "DELETE",
      Target: scheduleTarget(session),
    }));
  } catch (err) {
    // Couldn't record the session or its end-of-lab schedule: give the account back.
    await releaseAccount(accountId, sessionId);
    throw err;
  }

  return toPublic(session);
};

/** GET /aws-labs/sessions/:id */
export const getAwsLab = async ({ studentId, sessionId }) => {
  assertAwsLabsAvailable();
  return toPublic(await getOwnedSession(sessionId, studentId));
};

const assertReady = (session) => {
  if (session.status !== "READY" || Number(session.expiresAt) <= nowSec()) {
    throw new HttpError("This lab has ended", 409, { code: "NOT_READY", status: session.status });
  }
};

/** POST /aws-labs/sessions/:id/console-url: a fresh one-time sign-in link (valid 15 min, single use). */
export const createConsoleUrl = async ({ studentId, sessionId }) => {
  assertAwsLabsAvailable();
  const session = await getOwnedSession(sessionId, studentId);
  assertReady(session);
  const lab = AWS_LABS[session.labType];

  const remaining = Number(session.expiresAt) - nowSec();
  const duration = Math.max(900, Math.min(3600, remaining)); // STS min 15 min; role chaining max 1 h

  const { Credentials: creds } = await sts.send(new AssumeRoleCommand({
    RoleArn: `arn:aws:iam::${session.accountId}:role/${lab.role}`,
    RoleSessionName: `vlab-${session.sessionId}`.slice(0, 64),
    SourceIdentity: `student-${session.studentId}`.replace(/[^\w+=,.@-]/g, "_").slice(0, 64),
    DurationSeconds: duration,
    Tags: [{ Key: "VlabSessionId", Value: session.sessionId }],
  }));

  const sessionJson = JSON.stringify({
    sessionId: creds.AccessKeyId,
    sessionKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken,
  });
  const tokenRes = await fetch(`${FEDERATION}?${new URLSearchParams({ Action: "getSigninToken", Session: sessionJson })}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!tokenRes.ok) throw new Error(`AWS federation returned ${tokenRes.status}`);
  const { SigninToken } = await tokenRes.json();

  const url = `${FEDERATION}?${new URLSearchParams({
    Action: "login",
    Issuer: awsLabsInfra.issuer,
    Destination: lab.consoleDestination,
    SigninToken,
  })}`;
  // Never log `url`: it is a bearer credential for 15 minutes.
  const now = nowSec();
  return { url, linkExpiresAt: now + 900, consoleSessionExpiresAt: now + duration };
};

/** POST /aws-labs/sessions/:id/validate */
export const validateAwsLab = async ({ studentId, sessionId }) => {
  assertAwsLabsAvailable();
  const session = await getOwnedSession(sessionId, studentId);
  assertReady(session);

  const last = session.lastValidation?.checkedAt || 0;
  const wait = awsLabsInfra.validateMinIntervalSeconds - (nowSec() - last);
  if (wait > 0) throw new HttpError(`Please wait ${wait} s before checking again`, 429, { code: "TOO_SOON", retryAfterSeconds: wait });

  const { Credentials: creds } = await sts.send(new AssumeRoleCommand({
    RoleArn: `arn:aws:iam::${session.accountId}:role/${awsLabsInfra.validatorRoleName}`,
    RoleSessionName: `vlab-validate-${session.sessionId}`.slice(0, 64),
    DurationSeconds: 900,
  }));
  const result = await runValidation({
    labType: session.labType,
    tasks: tasksFor(session.labType, session.bucketPrefix),
    credentials: {
      accessKeyId: creds.AccessKeyId,
      secretAccessKey: creds.SecretAccessKey,
      sessionToken: creds.SessionToken,
    },
    region: awsLabsInfra.region,
    bucketPrefix: session.bucketPrefix,
  });
  const lastValidation = { ...result, checkedAt: nowSec() };

  // Stored on the session for grading.
  await getDocClient().send(new UpdateCommand({
    TableName: awsLabsInfra.sessionsTable,
    Key: { sessionId },
    UpdateExpression: "SET lastValidation = :v",
    ExpressionAttributeValues: { ":v": lastValidation },
  }));
  return lastValidation;
};

/** POST /aws-labs/sessions/:id/extend */
export const extendAwsLab = async ({ studentId, sessionId }) => {
  assertAwsLabsAvailable();
  const session = await getOwnedSession(sessionId, studentId);
  assertReady(session);
  const lab = AWS_LABS[session.labType];
  if ((session.extensionsUsed || 0) >= lab.maxExtensions) {
    throw new HttpError("No more extensions are available for this lab", 409, { code: "NO_EXTENSIONS" });
  }
  const newExpiresAt = Number(session.expiresAt) + lab.extensionMinutes * 60;

  const res = await getDocClient().send(new UpdateCommand({
    TableName: awsLabsInfra.sessionsTable,
    Key: { sessionId },
    UpdateExpression: "SET expiresAt = :exp, extensionsUsed = extensionsUsed + :one",
    ConditionExpression: "#s = :ready AND extensionsUsed = :used",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":exp": newExpiresAt, ":one": 1, ":ready": "READY", ":used": session.extensionsUsed || 0 },
    ReturnValues: "ALL_NEW",
  })).catch((err) => {
    if (err.name === "ConditionalCheckFailedException") throw new HttpError("The lab changed; try again", 409, { code: "CONFLICT" });
    throw err;
  });
  await getDocClient().send(new UpdateCommand({
    TableName: awsLabsInfra.poolTable,
    Key: { accountId: session.accountId },
    UpdateExpression: "SET leaseExpiresAt = :exp",
    ConditionExpression: "leaseSessionId = :sid",
    ExpressionAttributeValues: { ":exp": newExpiresAt, ":sid": sessionId },
  })).catch(() => {});
  await scheduler.send(new UpdateScheduleCommand({
    Name: scheduleName(sessionId),
    GroupName: awsLabsInfra.schedulerGroup,
    ScheduleExpression: atExpression(newExpiresAt),
    ScheduleExpressionTimezone: "UTC",
    FlexibleTimeWindow: { Mode: "OFF" },
    ActionAfterCompletion: "DELETE",
    Target: scheduleTarget(session),
  }));
  return toPublic(res.Attributes);
};

/** DELETE /aws-labs/sessions/:id: end now. Cleanup (revoke console, aws-nuke) runs in Step Functions. */
export const endAwsLab = async ({ studentId, sessionId }) => {
  assertAwsLabsAvailable();
  const session = await getOwnedSession(sessionId, studentId);
  if (session.status !== "READY") {
    throw new HttpError("This lab is not running", 409, { code: "NOT_READY", status: session.status });
  }
  await scheduler.send(new DeleteScheduleCommand({
    Name: scheduleName(sessionId),
    GroupName: awsLabsInfra.schedulerGroup,
  })).catch((err) => {
    if (err.name !== "ResourceNotFoundException") throw err;
  });
  await sfn.send(new StartExecutionCommand({
    stateMachineArn: awsLabsInfra.cleanupStateMachineArn,
    name: `end-${sessionId}-user`,
    input: JSON.stringify({ sessionId, accountId: session.accountId, reason: "USER" }),
  })).catch((err) => {
    // Same execution name already started = a double click; the lab is already ending.
    if (err.name !== "ExecutionAlreadyExists") throw err;
  });
  return { sessionId, status: "ENDING" };
};
