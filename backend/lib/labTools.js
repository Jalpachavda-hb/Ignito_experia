  import { LAB_PORTS, getLabById } from "../config/labs.js";
import { ENV } from "../config/env.js";
import { signJupyterEmbedToken } from "./jwt.js";

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

/** Container host: public IP for browser; private IP for Lambda in VPC */
export const getContainerHost = (session) => {
  if (!session) return null;
  if (process.env.NODE_ENV === "development" || ENV.nodeEnv === "development") {
    return session.publicIp || session.taskPrivateIp;
  }
  if (ENV.containerHostMode === "private") {
    return session.taskPrivateIp || session.publicIp;
  }
  return session.publicIp || session.taskPrivateIp;
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

  const baseUrl = `http://${host}:${port}`;

  console.log("BASE URL:", baseUrl);

  return baseUrl;
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
  if (!targetPath || targetPath === "/" || targetPath === "/lab") {
    targetPath = "/notebooks/lab.ipynb";
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
    const jupyterUrl = await buildJupyterProxyUrl(session);
    return jupyterUrl || joinUrl(`http://${host}:${runtime.port}`, runtime.path);
  }

  return joinUrl(`http://${host}:${runtime.port}`, runtime.path);
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
