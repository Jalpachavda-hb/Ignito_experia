import { LAB_PORTS, getLabById } from "../config/labs.js";
import { ENV } from "../config/env.js";

const joinUrl = (base, path = "/") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath === "/" ? "" : normalizedPath}`;
};

export const getLabRuntime = (labId) => {
  const lab = getLabById(labId);
  return lab?.runtime || { type: "web", port: LAB_PORTS.WEB_LAB, path: "/" };
};

export const buildMainToolUrl = ({ labId, publicIp, sessionId }) => {
  const runtime = getLabRuntime(labId);

  console.log("========== TOOL URL DEBUG ==========");
  console.log("Lab ID:", labId);
  console.log("Runtime Type:", runtime.type);
  console.log("Runtime Port:", runtime.port);
  console.log("Runtime Path:", runtime.path);
  console.log("Public IP:", publicIp);
  console.log("Session ID:", sessionId);

  if (runtime.type === "ide") {
    console.log("Opening IDE route");
    return `/admin/compute/ide?sessionId=${sessionId}&labId=${labId}`;
  }

  if (!publicIp) {
    console.log("No Public IP Found");

    return runtime.type === "jupyter"
      ? "http://13.235.48.30:8080/lab"
      : `/admin/compute/ide?sessionId=${sessionId}`;
  }

  const url = joinUrl(
    `http://${publicIp}:${runtime.port}`,
    runtime.path
  );

  console.log("FINAL GENERATED URL:", url);
  console.log("===================================");

  return url;
};

export const buildSessionTools = (session) => {
  const runtime = getLabRuntime(session.labId);
  const apiBaseUrl = getSessionApiBaseUrl(session);
  const mainUrl = buildMainToolUrl({
    labId: session.labId,
    publicIp: session.publicIp,
    sessionId: session.sessionId,
  });

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
      url: runtime.type === "ide" ? mainUrl : null,
    },
    jupyter: {
      enabled: runtime.type === "jupyter",
      url: runtime.type === "jupyter" ? mainUrl : null,
    },
  };
};

export const getContainerHost = (session) => {
  if (!session) return null;
  if (ENV.containerHostMode === "private") {
    return session.taskPrivateIp || session.publicIp || null;
  }
  return session.publicIp || null;
};

export const getContainerPort = (labId) => {
  const runtime = getLabRuntime(labId);
  return runtime.containerApi?.port || runtime.port;
};

export const getSessionApiBaseUrl = (session) => {
  const host = getContainerHost(session);
  if (!host || session.status !== "running") return null;

  const runtime = getLabRuntime(session.labId);
  const containerApi = runtime.containerApi;

  if (containerApi?.enabled === false) return null;
  if (runtime.type === "jupyter" && !containerApi?.enabled) return null;

  return `http://${host}:${getContainerPort(session.labId)}`;
};
