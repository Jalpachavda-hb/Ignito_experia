import { ok } from "../lib/apigw.js";
import { unauthorized } from "../lib/errors.js";
import {
  listAwsLabs,
  startAwsLab,
  getAwsLab,
  createConsoleUrl,
  validateAwsLab,
  extendAwsLab,
  endAwsLab,
} from "../services/awsLabs/awsLabService.js";
import { awsLabsInfra } from "../config/awsLabs.js";

// studentId always comes from the auth token, never from the request body.
const studentIdFrom = (auth) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  return String(auth.userId);
};

export const awsLabsListHandler = async ({ auth }) => {
  studentIdFrom(auth);
  return ok({ enabled: awsLabsInfra.enabled, labs: awsLabsInfra.enabled ? listAwsLabs() : [] });
};

export const awsLabsStartHandler = async ({ body, auth }) =>
  ok(await startAwsLab({ studentId: studentIdFrom(auth), labType: body?.labType }), 201);

export const awsLabsGetHandler = async ({ pathParameters, auth }) =>
  ok(await getAwsLab({ studentId: studentIdFrom(auth), sessionId: pathParameters?.sessionId }));

export const awsLabsConsoleUrlHandler = async ({ pathParameters, auth }) =>
  ok(await createConsoleUrl({ studentId: studentIdFrom(auth), sessionId: pathParameters?.sessionId }));

export const awsLabsValidateHandler = async ({ pathParameters, auth }) =>
  ok(await validateAwsLab({ studentId: studentIdFrom(auth), sessionId: pathParameters?.sessionId }));

export const awsLabsExtendHandler = async ({ pathParameters, auth }) =>
  ok(await extendAwsLab({ studentId: studentIdFrom(auth), sessionId: pathParameters?.sessionId }));

export const awsLabsEndHandler = async ({ pathParameters, auth }) =>
  ok(await endAwsLab({ studentId: studentIdFrom(auth), sessionId: pathParameters?.sessionId }), 202);
