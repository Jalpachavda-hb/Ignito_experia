import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { getSession } from "./services/sessionRepository.js";
import { getLabRuntime, getContainerHost } from "./lib/labTools.js";
import { ENV } from "./config/env.js";


const PROXY_TIMEOUT_MS = 120000;

const isCodeServerLab = (session) => {
  const rt = session?.runtimeType?.toLowerCase();
  return ['codeserver', 'code-server', 'vscode', 'code server'].includes(rt);
};

const authMiddleware = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    const session = await getSession(sessionId);

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }
    if (!isCodeServerLab(session)) {
      return res.status(400).json({ success: false, message: "Not a code-server lab." });
    }
    if (session.status !== "running") {
      return res.status(503).json({ success: false, message: "Container is not ready yet." });
    }

    const host = getContainerHost(session);

    if (!host) {
      return res.status(503).json({
        success: false,
        message: "Container host unavailable."
      });
    }
    const runtime = await getLabRuntime(session.labId);
    req.codeServerTarget = `http://${host}:${runtime.port || 8080}`;
    req.codeServerSessionId = sessionId;
    res.setHeader(
      "Set-Cookie",
      `vlab_vscode_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax`,
    );
    return next();
  } catch (err) {
    console.error("[codeServerProxy auth]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


/** Strip the prefix so /api/lab-sessions/:id/vscode/some/path → /some/path */
function stripProxyPrefix(path, apiPrefix) {
  const prefixPattern = new RegExp(
    `^${apiPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/lab-sessions/[^/]+/vscode`,
  );
  return path.replace(prefixPattern, "");
}

const buildProxyPrefix = (apiPrefix, sessionId) =>
  `${apiPrefix}/lab-sessions/${sessionId}/vscode`;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Resolve lab session from WS URL, Referer, or cookie set by the vscode proxy. */
const resolveCodeServerSessionId = (req, url, apiPrefix) => {
  const prefix = escapeRegExp(apiPrefix);
  const fromUrl = url.match(new RegExp(`${prefix}/lab-sessions/([^/]+)/vscode`));
  if (fromUrl?.[1]) return fromUrl[1];

  const referer = req.headers.referer || req.headers.referrer || "";
  const fromReferer = referer.match(/\/lab-sessions\/([^/]+)\/vscode/);
  if (fromReferer?.[1]) return fromReferer[1];

  const cookies = req.headers.cookie || "";
  const fromCookie = cookies.match(/(?:^|;\s*)vlab_vscode_session=([^;]+)/);
  if (fromCookie?.[1]) {
    try {
      return decodeURIComponent(fromCookie[1]);
    } catch {
      return fromCookie[1];
    }
  }

  return null;
};

const isCodeServerUpgradePath = (url, apiPrefix) => {
  if (!url) return false;
  if (url.startsWith("/stable-")) return true;
  const prefix = escapeRegExp(apiPrefix);
  return new RegExp(`${prefix}/lab-sessions/[^/]+/vscode`).test(url);
};

const bindCodeServerSession = async (req, sessionId) => {
  const session = await getSession(sessionId);
  if (!session || !isCodeServerLab(session) || session.status !== "running") {
    return false;
  }

  const host = getContainerHost(session);
  if (!host) return false;

  const runtime = await getLabRuntime(session.labId);
  req.codeServerTarget = `http://${host}:${runtime.port || 8080}`;
  req.codeServerSessionId = sessionId;
  return true;
};

/** Forward browser-facing headers code-server expects behind a reverse proxy. */
const applyCodeServerForwardHeaders = (outReq, req, apiPrefix, sessionId) => {
  const browserHost = req.headers.host;
  const proto =
    req.headers["x-forwarded-proto"] ||
    (req.socket?.encrypted ? "https" : "http");

  if (browserHost) {
    outReq.setHeader("Host", browserHost);
    outReq.setHeader("X-Forwarded-Host", browserHost);
  }

  outReq.setHeader("X-Forwarded-Proto", proto);

  if (req.headers.origin) {
    outReq.setHeader("Origin", req.headers.origin);
  }

  if (sessionId) {
    outReq.setHeader("X-Forwarded-Prefix", buildProxyPrefix(apiPrefix, sessionId));
  }

  // WebSocket upgrade — must reach code-server unchanged.
  if (req.headers.upgrade) {
    outReq.setHeader("Upgrade", req.headers.upgrade);
  }
  if (req.headers.connection) {
    outReq.setHeader("Connection", req.headers.connection);
  }
};

export const setupCodeServerProxy = (app, apiPrefix) => {
  const mountPath = `${apiPrefix}/lab-sessions/:sessionId/vscode`;

  app.get(`${mountPath}/diagnostics`, authMiddleware, async (req, res) => {
    try {
      const target = req.codeServerTarget;


      let codeServerRunning = false;
      try {
        const ping = await fetch(target, { method: "GET" });
        codeServerRunning = ping.ok || ping.status === 403 || ping.status === 401 || ping.status === 302;
      } catch (e) {

      }


      res.json({
        success: true,
        workspaceExists: true,
        workspaceWritable: true,
        workspaceFiles: [],
        codeServerRunning,
        websocketStatus: codeServerRunning ? "reachable" : "unreachable",
        mountedVolumes: ["/workspace"],
        target,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  const proxyMiddleware = createProxyMiddleware({
    target: "http://placeholder",
    // Keep the browser Host header; code-server uses it behind reverse proxies.
    changeOrigin: false,
    // WS upgrades are handled manually in attachCodeServerProxyUpgrade so we can
    // resolve /stable-* root paths and attach the ECS target before forwarding.
    ws: false,
    xfwd: true,
    timeout: 300000,
    proxyTimeout: 300000,
    logger: console,

    router: (req) => {
      if (!req.codeServerTarget) {
        throw new Error("No code-server target for proxy request");
      }
      return req.codeServerTarget;
    },

    pathRewrite: (path) => {
      const rewritten = stripProxyPrefix(path, apiPrefix) || "/";

      console.log("\n========== PATH REWRITE ==========");
      console.log("Incoming :", path);
      console.log("Outgoing :", rewritten);
      console.log("==================================\n");

      return rewritten;
    },

    on: {
      proxyReq(proxyReq, req) {
        const sessionId = req.codeServerSessionId || req.params?.sessionId;
        const forwardedPath = proxyReq.path;
        const upstreamUrl = `${req.codeServerTarget}${forwardedPath}`;

        applyCodeServerForwardHeaders(proxyReq, req, apiPrefix, sessionId);

        console.log("\n========== PROXY REQUEST ==========");
        console.log("Method   :", req.method);
        console.log("Original :", req.originalUrl);
        console.log("Forward  :", forwardedPath);
        console.log("Upstream :", upstreamUrl);
        console.log("Target   :", req.codeServerTarget);
        console.log("Host     :", req.headers.host);
        console.log("Origin   :", req.headers.origin);
        console.log("===================================\n");

        fixRequestBody(proxyReq, req);
      },
      proxyReqWs(proxyReq, req) {
        if (!req.codeServerTarget) {
          console.warn("[codeServerProxy] WS upgrade missing target, skipping");
          return;
        }
        const sessionId = req.codeServerSessionId;
        applyCodeServerForwardHeaders(proxyReq, req, apiPrefix, sessionId);

        console.log("\n========== WS PROXY REQUEST ==========");
        console.log("Forward  :", req.url);
        console.log("Target   :", req.codeServerTarget);
        console.log("Host     :", req.headers.host);
        console.log("Origin   :", req.headers.origin);
        console.log("======================================\n");
      },
      proxyRes(proxyRes, req) {
        console.log("\n========== PROXY RESPONSE =========");
        console.log("Status   :", proxyRes.statusCode);
        console.log("Request  :", req.originalUrl);
        console.log("Forward  :", req.url);
        console.log("===================================\n");

        delete proxyRes.headers["x-frame-options"];
        delete proxyRes.headers["X-Frame-Options"];
        proxyRes.headers["content-security-policy"] = "frame-ancestors *";
        proxyRes.headers["access-control-allow-origin"] = "*";
      },

      error(err, req, res) {
        console.log("\n========== PROXY ERROR ============");
        console.log("Message  :", err.message);
        console.log("URL      :", req.originalUrl);
        console.log("Target   :", req.codeServerTarget);
        console.log("===================================\n");

        if (res.status && !res.headersSent) {
          res.status(502).send(err.message);
        } else if (res.destroy) {
          res.destroy();
        } else if (res.end) {
          res.end();
        }
      }
    }
  });

  // Store globally so the upgrade handler can use it
  global.codeServerWsProxy = proxyMiddleware;

  app.use(mountPath, authMiddleware, proxyMiddleware);
  return mountPath;
};

export const attachCodeServerProxyUpgrade = (httpServer, apiPrefix = ENV.apiPrefix) => {
  httpServer.on("upgrade", async (req, socket, head) => {
    try {
      const url = req.url || "";

      if (!isCodeServerUpgradePath(url, apiPrefix)) {
        return;
      }

      console.log("\n========== WS REQUEST ==========");
      console.log("req.url         :", url);
      console.log("req.headers.host:", req.headers.host);
      console.log("req.headers.origin:", req.headers.origin);
      console.log("req.headers.referer:", req.headers.referer);
      console.log("===============================\n");

      const sessionId = resolveCodeServerSessionId(req, url, apiPrefix);
      if (!sessionId) {
        console.log("❌ WS missing session context:", url);
        socket.destroy();
        return;
      }

      const bound = await bindCodeServerSession(req, sessionId);
      if (!bound) {
        console.log("❌ WS session not running:", sessionId);
        socket.destroy();
        return;
      }

      const queryIndex = url.indexOf("?");
      const pathOnly = queryIndex >= 0 ? url.slice(0, queryIndex) : url;
      const query = queryIndex >= 0 ? url.slice(queryIndex) : "";
      const forwardedPath = stripProxyPrefix(pathOnly, apiPrefix) || pathOnly;
      req.url = `${forwardedPath.startsWith("/") ? forwardedPath : `/${forwardedPath}`}${query}`;

      req.headers["x-forwarded-host"] = req.headers.host || "";
      req.headers["x-forwarded-proto"] =
        req.headers["x-forwarded-proto"] ||
        (req.socket?.encrypted ? "https" : "http");
      req.headers["x-forwarded-prefix"] = buildProxyPrefix(apiPrefix, sessionId);

      console.log("WS UPGRADE URL:", req.url);
      console.log("SESSION ID:", sessionId);
      console.log("TARGET:", req.codeServerTarget);

      if (!global.codeServerWsProxy?.upgrade) {
        socket.destroy();
        return;
      }

      global.codeServerWsProxy.upgrade(req, socket, head);
    } catch (err) {
      console.error("[WS]", err);
      socket.destroy();
    }
  });
};