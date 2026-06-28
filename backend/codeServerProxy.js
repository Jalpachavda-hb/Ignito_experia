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
    return next();
  } catch (err) {
    console.error("[codeServerProxy auth]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


/** Strip the prefix so /api/lab-sessions/:id/vscode/some/path → /some/path */
function stripProxyPrefix(path) {
  return path.replace(
    /^\/api\/lab-sessions\/[^/]+\/vscode/,
    ""
  );
}

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
    changeOrigin: true,
    ws: true,
    xfwd: true,
    timeout: 300000,
    proxyTimeout: 300000,
    logger: console,

    router: (req) => req.codeServerTarget || "http://127.0.0.1:8080",

    pathRewrite: (path, req) => {
      // DO NOT strip the prefix, code-server needs it to serve correct base paths!
      const rewritten = path;

      console.log("\n========== PATH REWRITE ==========");
      console.log("Incoming :", path);
      console.log("Outgoing :", rewritten);
      console.log("==================================\n");

      return rewritten;
    },

    on: {
      proxyReq(proxyReq, req) {
        console.log("\n========== PROXY REQUEST ==========");
        console.log("Method   :", req.method);
        console.log("Original :", req.originalUrl);
        console.log("Forward  :", proxyReq.path);
        console.log("Target   :", req.codeServerTarget);
        console.log("===================================\n");

        fixRequestBody(proxyReq, req);
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

export const attachCodeServerProxyUpgrade = (httpServer) => {
  httpServer.on("upgrade", async (req, socket, head) => {
    try {
      console.log("\n========== WS REQUEST ==========");
      console.log("req.url         :", req.url);
      console.log("req.originalUrl :", req.originalUrl);
      console.log("req.headers.host:", req.headers.host);
      console.log("req.headers.origin:", req.headers.origin);
      console.log("req.headers.referer:", req.headers.referer);
      console.log("===============================\n");
      const url = req.url || "";
      console.log("WS UPGRADE:", url);

      if (url.startsWith("/stable-")) {
        console.log("❌ INVALID WS ENTRY (bypassed proxy)");
        socket.destroy();
        return;
      }

      const match = url.match(/\/lab-sessions\/([^/]+)\/vscode/);
      if (!match) {
        console.log("❌ WS missing session context:", url);
        socket.destroy();
        return;
      }

      const sessionId = match[1];
      if (!sessionId) {
        console.error("WS missing sessionId");
        socket.destroy();
        return;
      }

      const session = await getSession(sessionId);

      if (!session || !isCodeServerLab(session) || session.status !== "running") {
        socket.destroy();
        return;
      }

      const host = getContainerHost(session);
      const runtime = await getLabRuntime(session.labId);

      req.codeServerTarget = `http://${host}:${runtime.port || 8080}`;
      req.codeServerSessionId = sessionId;

      console.log("WS UPGRADE URL:", req.url);
      console.log("SESSION ID:", sessionId);
      console.log("TARGET:", req.codeServerTarget);

      // We DO NOT strip the proxy prefix anymore. Code-server handles it natively.


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