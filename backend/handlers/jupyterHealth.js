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
      host: host || null,
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

  try {
    const isReady = await checkPort(host, port);

    return ok({
      status: isReady ? "ok" : "error",
      httpStatus: isReady ? 200 : 503,
      ready: isReady,
      reachable: isReady,
      service: "jupyter",
      timestamp: new Date().toISOString(),
      host,
      port,
    });
  } catch (err) {
    console.error("[jupyterHealth] socket check failed for", host, port, err.message);
    return ok({
      status: "error",
      httpStatus: 503,
      ready: false,
      reachable: false,
      service: "jupyter",
      timestamp: new Date().toISOString(),
      message: "Jupyter container check encountered an error",
      host,
      port,
      error: err.message,
    });
  }
};
