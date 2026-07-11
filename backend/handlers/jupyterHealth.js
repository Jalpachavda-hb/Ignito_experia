import net from "net";
import { ok } from "../lib/apigw.js";
import { forbidden, notFound } from "../lib/errors.js";
import { getSession } from "../services/sessionRepository.js";
import { getLabRuntime, getContainerHost } from "../lib/labTools.js";
import { executeInContainer } from "../services/containerClient.js";
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
    let isReady = await checkPort(host, port);

    // SSM Fallback if direct TCP connection fails (e.g. local dev server trying to reach private VPC IP)
    if (!isReady && session.taskArn) {
      console.log(`[jupyterHealth] Direct TCP check failed for ${host}:${port}. Trying SSM container process check...`);
      try {
        const payload = {
          path: "/tmp/jupyter_check.sh",
          language: "bash",
          content: "pgrep -f jupyter >/dev/null && echo 'OK' || echo 'FAIL'"
        };
        const res = await executeInContainer(session, payload, { forceSsm: true });
        if (res && res.output && res.output.includes("OK")) {
          console.log("[jupyterHealth] SSM container process check succeeded. Marking as ready!");
          isReady = true;
        }
      } catch (ssmErr) {
        console.warn("[jupyterHealth] SSM process check failed:", ssmErr.message);
      }
    }

    return ok({
      ready: isReady,
      reachable: isReady,
      status: isReady ? 200 : 503,
      host,
      port,
    });
  } catch (err) {
    console.error("[jupyterHealth] socket check failed for", host, port, err.message);
    return ok({
      ready: false,
      reachable: false,
      message: "Jupyter container check encountered an error",
      host,
      port,
      error: err.message,
    });
  }
};
