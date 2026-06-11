import { ok } from "../lib/apigw.js";
import { forbidden, notFound } from "../lib/errors.js";
import { getSession } from "../services/sessionRepository.js";
import { getLabRuntime, getContainerHost } from "../lib/labTools.js";

export const jupyterHealthHandler = async ({ pathParameters, auth }) => {
  const sessionId = pathParameters?.sessionId;
  const session = await getSession(sessionId);
  if (!session) throw notFound("Session not found");
  if (session.userId !== auth.userId && auth.role !== "Super Admin") {
    throw forbidden("You do not own this session");
  }

  const host = getContainerHost(session);
  const port = getLabRuntime(session.labId).port || 8888;
  if (!host || session.status !== "running") {
    return ok({
      reachable: false,
      message: "Jupyter container is not ready yet",
      host: host || null,
      port,
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const apiPrefix = process.env.API_PREFIX || "/api";
    const jupyterPath = `${apiPrefix}/lab-sessions/${sessionId}/jupyter/lab`;
    const probe = await fetch(`http://${host}:${port}${jupyterPath}`, { signal: controller.signal });
    clearTimeout(timer);

    // Jupyter returns 200 or 302 (redirect to login) when it is ready.
    // 404 means the server is up but base URL is mismatched.
    const isReady = probe.ok || probe.status === 302 || probe.status === 404;
    return ok({
      reachable: isReady,
      status: probe.status,
      host,
      port,
    });
  } catch (err) {
    console.error("[jupyterHealth] fetch failed for", host, port, err.message);
    clearTimeout(timer);
    return ok({
      reachable: false,
      message:
        "Cannot reach Jupyter on port 8888. AWS engineer must allow inbound TCP 8888 on the ECS security group.",
      host,
      port,
      error: err.message,
    });
  }
};
