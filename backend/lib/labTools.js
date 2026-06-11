import { LAB_PORTS, getLabById } from "../config/labs.js";
import { ENV } from "../config/env.js";
import { signJupyterEmbedToken } from "./jwt.js";

const joinUrl = (base, path = "/") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath === "/" ? "" : normalizedPath}`;
};

export const getLabRuntime = (labId) => {
  const lab = getLabById(labId);
  return lab?.runtime || { type: "web", port: LAB_PORTS.WEB_LAB, path: "/" };
};

/** Container host: public IP for browser; private IP for Lambda in VPC */
export const getContainerHost = (session) => {
  if (!session) return null;
  if (ENV.containerHostMode === "private") {
    return session.taskPrivateIp || session.publicIp;
  }
  return session.publicIp || session.taskPrivateIp;
};

export const getContainerPort = (labId) => {
  const runtime = getLabRuntime(labId);
  if (runtime.containerApi?.port) return runtime.containerApi.port;
  return runtime.port;
};

export const getSessionApiBaseUrl = (session) => {
  const host = getContainerHost(session);

  if (!host || session.status !== "running") {
    return null;
  }

  const runtime = getLabRuntime(session.labId);

  if (runtime.containerApi?.enabled === false) {
    return null;
  }

  const port = getContainerPort(session.labId);

  const baseUrl = `http://${host}:${port}`;

  console.log("BASE URL:", baseUrl);

  return baseUrl;
};

export const buildJupyterProxyUrl = (session) => {
  if (!session?.sessionId || !session?.userId || session.status !== "running") {
    return null;
  }
  const runtime = getLabRuntime(session.labId);
  if (runtime.type !== "jupyter") return null;

  const token = signJupyterEmbedToken(session.sessionId, session.userId);
  const base = ENV.apiPublicUrl.replace(/\/+$/, "");
  // Use API_PUBLIC_URL if it looks like a real (non-localhost) URL;
  // otherwise fall back to just the path so the browser resolves it relative to its own origin.
  const isLocalhost = /localhost|127\.0\.0\.1/.test(base);
  const prefix = isLocalhost
    ? `${ENV.apiPrefix}/lab-sessions/${session.sessionId}/jupyter`
    : `${base}/lab-sessions/${session.sessionId}/jupyter`;
  return `${prefix}${runtime.path || "/lab"}?access_token=${encodeURIComponent(token)}`;
};

/** Labs that serve VS Code (code-server) via the /vscode proxy */
const CODE_SERVER_LAB_IDS = new Set([
  "testing-lab",
  "mobile-app-lab",
  "dotnet-lab",
  "software-eng-lab",
]);

export const buildCodeServerProxyUrl = (session) => {
  if (!session?.sessionId || session.status !== "running") return null;
  if (!CODE_SERVER_LAB_IDS.has((session.labId || "").toLowerCase())) return null;
  const base = ENV.apiPublicUrl.replace(/\/+$/, "");
  return `${base}/lab-sessions/${session.sessionId}/vscode/`;
};

export const buildMainToolUrl = ({ labId, session }) => {
  const runtime = getLabRuntime(labId);
  const host = getContainerHost(session);

  if (!host || session.status !== "running") {
    return null;
  }

  if (runtime.type === "jupyter") {
    return buildJupyterProxyUrl(session) || joinUrl(`http://${host}:${runtime.port}`, runtime.path);
  }

  // Route code-server labs through the backend proxy (strips X-Frame-Options, avoids direct exposure)
  if (CODE_SERVER_LAB_IDS.has((labId || "").toLowerCase())) {
    return buildCodeServerProxyUrl(session) || joinUrl(`http://${host}:${runtime.port}`, runtime.path);
  }

  return joinUrl(`http://${host}:${runtime.port}`, runtime.path);
};

export const buildSessionTools = (session) => {
  const runtime = getLabRuntime(session.labId);
  const apiBaseUrl = getSessionApiBaseUrl(session);
  const mainUrl = buildMainToolUrl({ labId: session.labId, session });

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
  };
};

export const enrichSession = (session) => {
  if (!session) return session;
  session.tools = buildSessionTools(session);
  session.apiBaseUrl = getSessionApiBaseUrl(session);
  session.containerPort = getContainerPort(session.labId);
  if (session.startTime) {
    const duration = session.durationMinutes || ENV.defaultSessionMinutes || 30;
    const startMs = new Date(session.startTime).getTime();
    session.expiresAt = new Date(startMs + duration * 60 * 1000).toISOString();
  }
  return session;
};
