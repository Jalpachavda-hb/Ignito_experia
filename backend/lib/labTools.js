import { LAB_PORTS, getLabById } from "../config/labs.js";
import { ENV } from "../config/env.js";
import { signJupyterEmbedToken } from "./jwt.js";
import { getContainerHost, isDirectContainerMode, isLocalMode, isAwsInstance } from "./ipManager.js";
import { canonicalLabType } from "./labTypeMapper.js";

export const LAB_DESKTOP_PORT = 6080;

export { getContainerHost, isDirectContainerMode, isLocalMode, isAwsInstance };


const joinUrl = (base, path = "/") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath === "/" ? "" : normalizedPath}`;
};

export const getLabRuntime = async (labId) => {
  const lab = await getLabById(labId);
  if (!lab) return { type: "ide", port: 8080, path: "/" };
  return {
    type: (lab.runtime?.type || lab.RuntimeType || lab.runtimeType || "ide").toLowerCase(),
    port: lab.runtime?.port || lab.RuntimePort || lab.runtimePort || 8080,
    path: lab.runtime?.path || lab.RuntimePath || lab.runtimePath || "/",
    containerApi: {
      enabled: lab.runtime?.containerApi?.enabled || lab.ContainerApiEnabled || lab.containerApiEnabled || false,
      port: lab.runtime?.containerApi?.port || lab.ContainerApiPort || lab.containerApiPort || 8080,
    }
  };
};

export const getContainerPort = async (labId) => {
  const runtime = await getLabRuntime(labId);
  if (runtime.containerApi?.port) return runtime.containerApi.port;
  return runtime.port;
};

export const getSessionApiBaseUrl = async (session) => {
  const host = getContainerHost(session);

  if (!host || session.status !== "running") {
    return null;
  }

  const runtime = await getLabRuntime(session.labId);

  const isIdeRuntime = ["ide", "custom ide"].includes(runtime.type);
  if (runtime.containerApi?.enabled === false && !isIdeRuntime) {
    return null;
  }

  const port = await getContainerPort(session.labId);

  return `http://${host}:${port}`;
};

export const buildJupyterProxyUrl = async (session) => {
  if (!session?.sessionId || !session?.userId || session.status !== "running") {
    return null;
  }
  const runtime = await getLabRuntime(session.labId);
  if (runtime.type !== "jupyter") return null;

  const token = signJupyterEmbedToken(session.sessionId, session.userId);
  const base = ENV.apiPublicUrl.replace(/\/+$/, "");
  // Use API_PUBLIC_URL if it looks like a real (non-localhost) URL;
  // otherwise fall back to just the path so the browser resolves it relative to its own origin.
  const isLocalhost = /localhost|127\.0\.0\.1/.test(base);
  const prefix = isLocalhost
    ? `${ENV.apiPrefix}/lab/sessions/${session.sessionId}/jupyter`
    : `${base}/lab/sessions/${session.sessionId}/jupyter`;

  let targetPath = runtime.path || "";
  if (!targetPath || targetPath === "/" || targetPath === "/lab" || targetPath === "/workspace") {
    targetPath = "/lab";
  }

  return `${prefix}${targetPath}?access_token=${encodeURIComponent(token)}`;
};

export const buildMainToolUrl = async ({ labId, session }) => {
  const runtime = await getLabRuntime(labId);
  const host = getContainerHost(session);

  if (!host || session.status !== "running") {
    return null;
  }

  if (runtime.type === "jupyter") {
    // Only ever hand out the authenticated backend proxy URL. A direct http://<ip>:8888 URL
    // bypasses the proxy's ownership check; if the proxy URL can't be built, report "not ready".
    return await buildJupyterProxyUrl(session);
  }

  return joinUrl(`http://${host}:${runtime.port}`, runtime.path);
};

// noVNC "Browser desktop" (testing lab). Carries the per-session VNC password, so it is only
// ever returned to the session's owner (session GET/list handlers check ownership).
export const buildDesktopToolUrl = (session) => {
  const labType = session?.labType || canonicalLabType(session?.labId);
  if (labType !== "testing") return null;
  const host = getContainerHost(session);
  if (!host || session.status !== "running" || !session.vncPassword) return null;
  const params = new URLSearchParams({ autoconnect: "1", resize: "scale", password: session.vncPassword });
  return `http://${host}:${LAB_DESKTOP_PORT}/vnc.html?${params.toString()}`;
};

export const buildSessionTools = async (session) => {
  const runtime = await getLabRuntime(session.labId);
  const apiBaseUrl = await getSessionApiBaseUrl(session);
  const mainUrl = await buildMainToolUrl({ labId: session.labId, session });

  return {
    main: {
      enabled: true,
      type: runtime.type,
      port: runtime.port,
      url: mainUrl,
      apiBaseUrl,
    },
    ide: {
      enabled: runtime.type === "ide",
      port: LAB_PORTS.WEB_LAB,
      url: runtime.type === "ide" ? mainUrl : null,
    },
    jupyter: {
      enabled: runtime.type === "jupyter",
      port: LAB_PORTS.JUPYTER,
      url: runtime.type === "jupyter" ? mainUrl : null,
    },
    desktop: (() => {
      const url = buildDesktopToolUrl(session);
      return { enabled: Boolean(url), type: "vnc", port: LAB_DESKTOP_PORT, url };
    })(),
  };
};

export const enrichSession = async (session) => {
  if (!session) return session;
  const runtime = await getLabRuntime(session.labId);
  // Always use current lab catalog runtime — stale DynamoDB values (e.g. Code Server → ide) must not win.
  session.runtimeType = runtime.type;
  session.tools = await buildSessionTools(session);
  session.apiBaseUrl = await getSessionApiBaseUrl(session);
  session.containerPort = await getContainerPort(session.labId);
  if (session.startTime && session.durationMinutes) {
    const startMs = new Date(session.startTime).getTime();
    session.expiresAt = new Date(
      startMs + session.durationMinutes * 60 * 1000,
    ).toISOString();
  }
  return session;
};
