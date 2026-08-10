import path from "path";
import { ok } from "../lib/apigw.js";
import { badRequest, forbidden, notFound, HttpError } from "../lib/errors.js";
import { getSession } from "../services/sessionRepository.js";
import { AndroidBuildService } from "../services/AndroidBuildService.js";
import { readBinaryFromContainer } from "../services/containerClient.js";

const getSessionId = (event) =>
  event.headers?.["x-session-id"] ||
  event.queryStringParameters?.sessionId ||
  event.body?.sessionId;

const assertSessionAccess = async (event) => {
  const sessionId = getSessionId(event);
  if (!sessionId) throw badRequest("Session ID required");
  const session = await getSession(sessionId);
  if (!session) throw notFound("Session not found");
  if (
    event.auth &&
    String(session.userId) !== String(event.auth.userId) &&
    event.auth.role !== "Super Admin"
  ) {
    throw forbidden("You do not own this session");
  }
  return { sessionId, session };
};

export const androidBuildHandler = async (event) => {
  const { session } = await assertSessionAccess(event);

  if (session.build?.status === "RUNNING") {
    const containerStatus = await AndroidBuildService.readBuildStatusFile(session);
    if (containerStatus === "RUNNING") {
      throw new HttpError("Build already running", 409);
    }
  }

  const isValid = await AndroidBuildService.validateWorkspace(session);
  if (!isValid) {
    throw badRequest("Android workspace validation failed. Ensure gradlew and build.sh exist.");
  }

  await AndroidBuildService.startBuild(session);

  return ok({
    success: true,
    buildId: session.sessionId,
    status: "RUNNING",
  });
};

export const androidBuildStatusHandler = async (event) => {
  let { session } = await assertSessionAccess(event);
  const offset = parseInt(event.queryStringParameters?.offset || "0", 10);

  let currentStatus = session.build?.status || "IDLE";
  let logs = "";
  let logOffset = offset;

  if (currentStatus === "RUNNING") {
    const result = await AndroidBuildService.getBuildStatusAndLogs(session, offset);
    const statusFile = result.status;
    logs = result.logs;
    logOffset = result.offset;

    if (statusFile === "SUCCESS") {
      const apkPath = await AndroidBuildService.locateLatestApk(session);
      if (apkPath) {
        session.build = {
          status: "SUCCESS",
          apkPath,
        };
        const { updateSession } = await import("../services/sessionRepository.js");
        await updateSession(session.sessionId, { build: session.build });
        currentStatus = "SUCCESS";
      } else {
        session.build = { status: "FAILED" };
        const { updateSession } = await import("../services/sessionRepository.js");
        await updateSession(session.sessionId, { build: session.build });
        currentStatus = "FAILED";
      }
    } else if (statusFile === "FAILED") {
      session.build = { status: "FAILED" };
      const { updateSession } = await import("../services/sessionRepository.js");
      await updateSession(session.sessionId, { build: session.build });
      currentStatus = "FAILED";
    }
  } else {
    // If not running, retrieve remaining logs
    const logChunk = await AndroidBuildService.readLogChunk(session, offset);
    logs = logChunk.logs;
    logOffset = logChunk.offset;
  }

  return ok({
    status: currentStatus,
    offset: logOffset,
    logs: logs,
    apkReady: currentStatus === "SUCCESS",
    downloadUrl: currentStatus === "SUCCESS" ? `/api/android/download?sessionId=${session.sessionId}` : null,
  });
};

export const androidDownloadHandler = async (event) => {
  const { session } = await assertSessionAccess(event);

  let apkPath = session.build?.apkPath;

  if (!apkPath) {
    apkPath = await AndroidBuildService.locateLatestApk(session);
    if (apkPath) {
      session.build = {
        ...(session.build || {}),
        status: "SUCCESS",
        apkPath,
      };
      const { updateSession } = await import("../services/sessionRepository.js");
      await updateSession(session.sessionId, { build: session.build });
    }
  }

  if (!apkPath) {
    throw new HttpError("APK file not found on container. Please ensure build completed successfully.", 404);
  }

  const buffer = await readBinaryFromContainer(session, apkPath);
  if (!buffer) {
    throw notFound("APK file not found on container");
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": `attachment; filename="${path.basename(apkPath) || "app-debug.apk"}"`,
      "Content-Length": buffer.length.toString(),
      "Access-Control-Allow-Origin": "*",
    },
    body: buffer,
  };
};
