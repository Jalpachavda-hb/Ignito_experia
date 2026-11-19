import net from "net";
import { ok } from "../lib/apigw.js";
import { forbidden, notFound } from "../lib/errors.js";
import { getSession } from "../services/sessionRepository.js";
import { getLabRuntime, getContainerHost } from "../lib/labTools.js";
import { ENV } from "../config/env.js";

export const jupyterHealthHandler = async ({ pathParameters, auth }) => {
  const sessionId = pathParameters?.sessionId;
  const session = await getSession(sessionId);
  if (!session) throw notFound("Session not found");
  if (String(session.userId) !== String(auth.userId) && auth.role !== "Super Admin") {
    throw forbidden("You do not own this session");
  }

  const host = getContainerHost(session);
  const runtime = await getLabRuntime(session.labId);
  const port = runtime.port || 8888;
  if (!host || session.status !== "running") {
    return ok({
      reachable: false,
      message: "Jupyter container is not ready yet",
      port,
    });
  }

  const checkPort = (host, port) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let connected = false;

      socket.setTimeout(2000);

      socket.on('connect', () => {
        connected = true;
        socket.destroy();
      });

      socket.on('timeout', () => {
        socket.destroy();
      });

      socket.on('error', () => {
        socket.destroy();
      });

      socket.on('close', () => {
        resolve(connected);
      });

      socket.connect(port, host);
    });
  };

  // Probe Jupyter with the session's JUPYTER_TOKEN. 401/403 means the container's token
  // doesn't match (e.g. the task started without it): the UI shows "Reconnect" instead of a login page.
  const probeJupyter = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const headers = session.jupyterToken ? { Authorization: `token ${session.jupyterToken}` } : {};
      const res = await fetch(`http://${host}:${port}/api/status`, { headers, signal: controller.signal });
      return res.status;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const base = { service: "jupyter", timestamp: new Date().toISOString(), port };
  try {
    const isOpen = await checkPort(host, port);
    if (!isOpen) {
      return ok({ ...base, status: "error", httpStatus: 503, ready: false, reachable: false });
    }
    const httpStatus = await probeJupyter();
    if (httpStatus === 401 || httpStatus === 403) {
      return ok({
        ...base,
        status: "auth_required",
        httpStatus,
        ready: false,
        reachable: true,
        message: "Jupyter is running but rejected the session secret. Reconnect or restart the lab.",
      });
    }
    // Port open but HTTP not answering yet (still booting) counts as not ready.
    const isReady = httpStatus !== null && httpStatus < 500;
    return ok({ ...base, status: isReady ? "ok" : "error", httpStatus: httpStatus ?? 503, ready: isReady, reachable: true });
  } catch (err) {
    console.error("[jupyterHealth] check failed:", err.message);
    return ok({
      ...base,
      status: "error",
      httpStatus: 503,
      ready: false,
      reachable: false,
      message: "Jupyter container check encountered an error",
    });
  }
};
