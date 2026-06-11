import { ok } from "../lib/apigw.js";
import { badRequest, notFound } from "../lib/errors.js";
import { getSession } from "../services/sessionRepository.js";
import { ddbPut } from "../lib/dynamodb.js";
import { ENV } from "../config/env.js";

export const submitHandler = async ({ body, auth }) => {
  const sessionId = body?.sessionId;
  const code = body?.content || body?.code;

  if (!sessionId || !code) {
    throw badRequest("sessionId and content are required");
  }

  const session = await getSession(sessionId);
  if (!session) throw notFound("Session not found");
  if (session.userId !== auth.userId && auth.role !== "Super Admin") {
    throw notFound("Session not found");
  }

  if (ENV.submissionsTable) {
    await ddbPut(ENV.submissionsTable, {
      sessionId,
      userId: auth.userId,
      labId: session.labId,
      submittedAt: new Date().toISOString(),
      code,
    });
  }

  return ok({
    message: "Submission received",
    sessionId,
  });
};
