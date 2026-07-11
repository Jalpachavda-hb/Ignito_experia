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
import { saveToContainer, bootstrapWorkspaceFromS3 } from "../services/containerClient.js";

const activeBootstraps = new Set();

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

  if (!isEcsEnabled()) {
    session.status = "running";
    session.message = "Lab environment (local mock) is ready";
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

  if (session.status === "starting" && session.taskArn && isEcsEnabled()) {
    const net = await resolveTaskNetworking(session.taskArn, session.labId);
    if (net.status !== "starting") {
      const canonicalType = canonicalLabType(session.labId);
      const isAndroid = canonicalType === 'android' || session.labType === 'android' || session.labId === 'mobile-app-lab' || session.labId === 'android';
      const isDotnet = canonicalType === 'dotnet' || session.labType === 'dotnet' || session.labId === 'dotnet-lab' || session.labId.includes('dotnet');
      const isDataScience = canonicalType === 'datascience' || session.labType === 'datascience' || session.labId === 'data-science-lab' || session.labId.includes('datascience') || session.labId.includes('jupyter') || session.labId.includes('notebook');

      if (isAndroid || isDotnet || isDataScience) {
        if (!activeBootstraps.has(sessionId)) {
          activeBootstraps.add(sessionId);
          const labName = isAndroid ? 'Android' : isDotnet ? 'Dotnet' : 'Data Science';
          await updateSession(sessionId, { message: `Downloading and extracting ${labName} starter files from S3...` });
          
          try {
            console.log(`[Bootstrap] Bootstrapping ${labName} workspace from S3 for session ${session.sessionId}...`);
            await bootstrapWorkspaceFromS3(session);
            session = await updateSession(sessionId, { ...net, status: "running", message: "Workspace ready" });
          } catch (err) {
            console.error(`[Bootstrap] Failed to bootstrap ${labName} workspace from S3:`, err.message);
            session = await updateSession(sessionId, { ...net, status: "running", message: "Workspace loaded with errors" });
          } finally {
            activeBootstraps.delete(sessionId);
          }
        }
      } else {
        session = await updateSession(sessionId, net);
        if (session.status === "running" && session.files && session.files.length > 0) {
          // Run container file sync in background so as not to block sessionsGetHandler
          (async () => {
            console.log(`[Sync] Syncing ${session.files.length} seeded files to container ${session.sessionId}...`);
            for (const file of session.files) {
              try {
                await saveToContainer(session, { path: file.path, content: file.content });
              } catch (err) {
                console.warn(`[Sync] Failed to sync ${file.path} to container:`, err.message);
              }
            }
          })();
        }
      }
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
