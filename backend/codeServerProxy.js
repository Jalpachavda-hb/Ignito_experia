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
      return res.status(503).json({ success: false, message: "Container host unavailable." });
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
const stripProxyPrefix = (path, req) => {
  let sessionId = req.codeServerSessionId;

  // Fallback: extract sessionId from URL
  if (!sessionId) {
    const match = (req.originalUrl || req.url || "").match(
      /\/lab-sessions\/([^/]+)\/vscode/
    );
    sessionId = match?.[1];
  }

  if (!sessionId) {
    return path;
  }

  const originalPath = req.originalUrl || req.url || path;

  const prefixes = [
    `${ENV.apiPrefix}/lab-sessions/${sessionId}/vscode`,
    `/api/lab-sessions/${sessionId}/vscode`,
    `/lab-sessions/${sessionId}/vscode`,
  ];

  let rewrittenPath = originalPath;

  for (const prefix of prefixes) {
    if (rewrittenPath.startsWith(prefix)) {
      rewrittenPath = rewrittenPath.substring(prefix.length) || "/";
      break;
    }
  }

  console.log("Original URL:", req.originalUrl || req.url);
  console.log("Session ID:", sessionId);
  console.log("Rewritten URL:", rewrittenPath);
  return rewrittenPath.startsWith("/")
    ? rewrittenPath
    : `/${rewrittenPath}`;
};

export const setupCodeServerProxy = (app, apiPrefix) => {
  const mountPath = `${apiPrefix}/lab-sessions/:sessionId/vscode`;

  app.get(`${mountPath}/diagnostics`, authMiddleware, async (req, res) => {
    try {
      const target = req.codeServerTarget;

      // Check if code-server HTTP is responding
      let codeServerRunning = false;
      try {
        const ping = await fetch(target, { method: "GET" });
        codeServerRunning = ping.ok || ping.status === 403 || ping.status === 401 || ping.status === 302;
      } catch (e) {
        // failed
      }

      // Check websocket implicitly by the fact that if HTTP is up, WS is likely up (code-server hosts both)
      res.json({
        success: true,
        workspaceExists: true,     // Enforced via ECS command
        workspaceWritable: true,   // Enforced via ECS command
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
    timeout: PROXY_TIMEOUT_MS,
    proxyTimeout: PROXY_TIMEOUT_MS,
    router: (req) => req.codeServerTarget || "http://127.0.0.1:8080",
    pathRewrite: stripProxyPrefix,
    on: {
      proxyReq: fixRequestBody,
      error(err, req, res) {
        const logMsg = `[${new Date().toISOString()}] ProxyError: ${err.message}, target: ${req?.codeServerTarget}, url: ${req?.url}\n`;
        try { require('fs').appendFileSync('e:/vb-Lab Jalpa Hb/Ignito_experia/backend/scripts/proxy_debug_logs.txt', logMsg); } catch(e){}
        console.error("[codeServerProxy]", err.message, "target=", req?.codeServerTarget);
        if (res?.writeHead) {
          res.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;background:#1e1e1e;color:#fff;padding:2rem">
            <h2>VS Code could not be reached</h2>
            <p>The backend cannot connect to the lab container on port <b>8080</b>.</p>
            <p style="color:#aaa;font-size:12px">Target: ${req.codeServerTarget || "unknown"} — ${err.message}</p>
          </body></html>`);
        }
      },
      // proxyReqWs(proxyReq, req, socket, options, head) 
      proxyReqWs(){
        proxyReq.setHeader('Connection', 'Upgrade');
        proxyReq.setHeader('Upgrade', 'websocket');
      },
      proxyRes(proxyRes) {
        // Allow iframe embedding — remove X-Frame-Options and relax CSP
        delete proxyRes.headers["x-frame-options"];
        delete proxyRes.headers["X-Frame-Options"];
        proxyRes.headers["content-security-policy"] = "frame-ancestors *";
        proxyRes.headers["access-control-allow-origin"] = "*";
      },
    },
  });

  // Store globally so the upgrade handler can use it
  global.codeServerWsProxy = proxyMiddleware;

  app.use(mountPath, authMiddleware, proxyMiddleware);
  return mountPath;
};

export const attachCodeServerProxyUpgrade = (httpServer, apiPrefix) => {
  httpServer.on("upgrade", async (req, socket, head) => {
    const url = req.url || "";
    if (!url.includes("/lab-sessions/") || !url.includes("/vscode")) return;

    const match = url.match(/\/lab-sessions\/([^/]+)\/vscode/);
    if (!match) return;

    try {
      const sessionId = match[1];
      const session = await getSession(sessionId);
      const logPfx = `[${new Date().toISOString()}] UpgradeRequest: url: ${url}, sessionFound: ${!!session}, labId: ${session?.labId}, status: ${session?.status}`;
      
      if (!session || !isCodeServerLab(session)) {
        try { require('fs').appendFileSync('e:/vb-Lab Jalpa Hb/Ignito_experia/backend/scripts/proxy_debug_logs.txt', `${logPfx} -> Rejected (not found or not code-server)\n`); } catch(e){}
        socket.destroy();
        return;
      }
      const host = getContainerHost(session);
      const runtime = await getLabRuntime(session.labId);
      const port = runtime.port || 8080;

      req.codeServerTarget = `http://${host}:${port}`;
      req.codeServerSessionId = sessionId;

      try { require('fs').appendFileSync('e:/vb-Lab Jalpa Hb/Ignito_experia/backend/scripts/proxy_debug_logs.txt', `${logPfx} -> target: ${req.codeServerTarget}, host: ${host}, port: ${port}\n`); } catch(e){}

      if (global.codeServerWsProxy && typeof global.codeServerWsProxy.upgrade === "function") {
        global.codeServerWsProxy.upgrade(req, socket, head);
      } else {
        try { require('fs').appendFileSync('e:/vb-Lab Jalpa Hb/Ignito_experia/backend/scripts/proxy_debug_logs.txt', `${logPfx} -> Rejected (global.codeServerWsProxy not ready)\n`); } catch(e){}
        socket.destroy();
      }
    } catch (err) {
      try { require('fs').appendFileSync('e:/vb-Lab Jalpa Hb/Ignito_experia/backend/scripts/proxy_debug_logs.txt', `[${new Date().toISOString()}] UpgradeError: ${err.message}\n`); } catch(e){}
      console.error("[codeServerProxyUpgrade error]", err);
      socket.destroy();
    }
  });
};
