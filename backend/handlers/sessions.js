import { ok } from "../lib/apigw.js";
import { badRequest, forbidden, notFound, unauthorized } from "../lib/errors.js";
import { canonicalLabType } from "../lib/labTypeMapper.js";
import { getLabById } from "../config/labs.js";
import {
  createSessionRecord,
  findActiveSessionForUser,
  getSession,
  saveSession,
  updateSession,
  deleteSession,
} from "../services/sessionRepository.js";
import {
  isEcsEnabled,
  startEcsTask,
  stopEcsTask,
  resolveTaskNetworking,
} from "../services/ecsService.js";
import { clearSessionFiles } from "../services/fileRepository.js";
import { bootstrap as bootstrapSession } from "../services/workspaceBootstrapService.js";
import { saveToContainer } from "../services/containerClient.js";

export const sessionsStartHandler = async ({ body, auth }) => {
  const labId = body?.labId;
  if (!auth?.userId) throw unauthorized("Authentication required");
  const userId = auth.userId;

  if (!labId) throw badRequest("labId is required");
  const lab = await getLabById(labId);
  if (!lab) throw notFound("Lab not found");

  const durationMinutes = Number(lab.durationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw badRequest("Lab session duration is not configured");
  }

  const runtimeType = (lab.runtime?.type || lab.RuntimeType || lab.runtimeType || "ide").toLowerCase();
  const SUPPORTED_RUNTIMES = ["ide", "terminal", "jupyter", "emulator"];
  if (!SUPPORTED_RUNTIMES.includes(runtimeType)) {
    throw badRequest(`This lab is configured with an unsupported platform: '${runtimeType}'.`);
  }

  const existing = await findActiveSessionForUser(userId);
  if (existing) {
    if (existing.labId === labId) {
      return ok({
        ...existing,
        message: "You already have an active lab session for this lab.",
      });
    }
    throw badRequest(
      "You already have an active lab running. Stop it before starting another.",
    );
  }

  const labType = canonicalLabType(labId);
  const session = createSessionRecord({
    userId,
    labId,
    labType,
    runtimeType: lab.runtime?.type || lab.RuntimeType || lab.runtimeType || "ide",
    durationMinutes,
  });

  if (body?.dotnetSubtype) {
    session.dotnetSubtype = body.dotnetSubtype;
  }

  if (!isEcsEnabled()) {
    session.status = "starting";
    session.bootstrapState = "NOT_STARTED";
    session.message = "Lab environment (local mock) is provisioning...";
    session.publicIp = null;
    await saveSession(session);
    return ok(session);
  }

  try {
    const { taskArn, taskPort } = await startEcsTask({
      labId,
      sessionId: session.sessionId,
      sessionToken: session.sessionToken,
    });
    session.taskArn = taskArn;
    session.taskPort = taskPort;
    session.bootstrapState = "NOT_STARTED";
    await saveSession(session);
    return ok(session);
  } catch (err) {
    console.error("[sessionsStart]", err);
    throw badRequest(`Failed to start lab: ${err.message}`);
  }
};
export const sessionsGetHandler = async ({ pathParameters, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const sessionId = pathParameters?.sessionId;
  let session = await getSession(sessionId);
  if (!session) throw notFound("Session not found");

  if (String(session.userId) !== String(auth.userId) && auth.role !== "Super Admin") {
    throw forbidden("You do not own this session");
  }

  if (session.status === "starting") {
    if (isEcsEnabled()) {
      if (session.taskArn) {
        const net = await resolveTaskNetworking(session.taskArn, session.labId);
        if (net.status !== "starting") {
          // Task networking is ready, trigger bootstrap asynchronously if not already bootstrapping/ready
          if (!session.bootstrapState || session.bootstrapState === "NOT_STARTED") {
            console.log(`[sessionsGetHandler] Triggering background bootstrap for ECS session: ${sessionId}`);
            // Save networking info to DB first
            session = await updateSession(sessionId, net);
            bootstrapSession(session, net).catch((err) => {
              console.error(`[sessionsGetHandler] Async ECS bootstrap failed for ${sessionId}:`, err.message);
            });
            // Brief sleep to let initial DB update reflect
            await new Promise(r => setTimeout(r, 100));
          }
          // Refresh session state
          session = await getSession(sessionId);
        }
      }
    } else {
      // Local session mock bootstrap
      if (!session.bootstrapState || session.bootstrapState === "NOT_STARTED") {
        console.log(`[sessionsGetHandler] Triggering background bootstrap for Local session: ${sessionId}`);
        bootstrapSession(session).catch((err) => {
          console.error(`[sessionsGetHandler] Async Local bootstrap failed for ${sessionId}:`, err.message);
        });
        // Brief sleep
        await new Promise(r => setTimeout(r, 100));
      }
      session = await getSession(sessionId);
    }
  }

  return ok(session);
};

export const sessionsStopHandler = async ({ pathParameters, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const sessionId = pathParameters?.sessionId;
  const session = await getSession(sessionId);
  if (!session) throw notFound("Session not found");

  if (String(session.userId) !== String(auth.userId) && auth.role !== "Super Admin") {
    throw forbidden("You do not own this session");
  }

  if (session.taskArn && isEcsEnabled()) {
    try {
      await stopEcsTask(session.taskArn);
    } catch (err) {
      console.error("[sessionsStop]", err);
    }
  }

  clearSessionFiles(sessionId);
  await deleteSession(sessionId);
  return ok({ sessionId, status: "stopped" });
};

export const sessionsListByUserHandler = async ({
  pathParameters,
  queryStringParameters,
  auth,
}) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const requestedUser = decodeURIComponent(pathParameters?.userId || "");
  const labId = queryStringParameters?.labId;

  const ownsRequest =
    String(requestedUser) === String(auth.userId) ||
    requestedUser === auth.email ||
    auth.role === "Super Admin";

  if (!ownsRequest) {
    throw forbidden("Cannot list another user's sessions");
  }

  let session = await findActiveSessionForUser(auth.userId, labId);
  if (!session && auth.email) {
    session = await findActiveSessionForUser(auth.email, labId);
  }
  if (session) return ok({ session });
  return ok({ success: false, message: "No active session found" });
};
