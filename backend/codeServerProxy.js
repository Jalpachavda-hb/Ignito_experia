import { createProxyMiddleware } from "http-proxy-middleware";
import { getSession } from "./services/sessionRepository.js";
import { getLabRuntime, getContainerHost } from "./lib/labTools.js";
import { ENV } from "./config/env.js";


const PROXY_TIMEOUT_MS = 120000;

/** Labs that serve code-server on port 8080 via the proxy */
const CODE_SERVER_LAB_IDS = new Set([
  "testing-lab",
  "mobile-app-lab",
  "dotnet-lab",
  "software-eng-lab",
]);

const isCodeServerLab = (labId) => CODE_SERVER_LAB_IDS.has((labId || "").toLowerCase());

const authMiddleware = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    const session = await getSession(sessionId);

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }
    if (!isCodeServerLab(session.labId)) {
      return res.status(400).json({ success: false, message: "Not a code-server lab." });
    }
    if (session.status !== "running") {
      return res.status(503).json({ success: false, message: "Container is not ready yet." });
    }

    const host = getContainerHost(session);
    if (!host) {
      return res.status(503).json({ success: false, message: "Container host unavailable." });
    }

    const runtime = getLabRuntime(session.labId);
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
  const sessionId = req.params?.codeServerSessionId || req.codeServerSessionId || "";
  const prefixes = [
    `${ENV.apiPrefix}/lab-sessions/${sessionId}/vscode`,
    `/api/lab-sessions/${sessionId}/vscode`,
    `/lab-sessions/${sessionId}/vscode`,
  ];
  let stripped = (req.originalUrl || path).split("?")[0];
  for (const pfx of prefixes) {
    if (stripped.startsWith(pfx)) {
      stripped = stripped.slice(pfx.length) || "/";
      break;
    }
  }
  const qs = (req.originalUrl || "").split("?")[1];
  return (stripped.startsWith("/") ? stripped : `/${stripped}`) + (qs ? `?${qs}` : "");
};

export const setupCodeServerProxy = (app, apiPrefix) => {
  const mountPath = `${apiPrefix}/lab-sessions/:sessionId/vscode`;

  const proxyMiddleware = createProxyMiddleware({
    target: "http://placeholder",
    changeOrigin: true,
    ws: true,
    timeout: PROXY_TIMEOUT_MS,
    proxyTimeout: PROXY_TIMEOUT_MS,
    router: (req) => req.codeServerTarget || "http://127.0.0.1:8080",
    pathRewrite: stripProxyPrefix,
    on: {
      error(err, req, res) {
        console.error("[codeServerProxy]", err.message, "target=", req.codeServerTarget);
        if (res?.writeHead) {
          res.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;background:#1e1e1e;color:#fff;padding:2rem">
            <h2>VS Code could not be reached</h2>
            <p>The backend cannot connect to the lab container on port <b>8080</b>.</p>
            <p style="color:#aaa;font-size:12px">Target: ${req.codeServerTarget || "unknown"} — ${err.message}</p>
          </body></html>`);
        }
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
      const session = await getSession(match[1]);
      if (!session || !isCodeServerLab(session.labId)) {
        socket.destroy();
        return;
      }
      const host = getContainerHost(session);
      const port = getLabRuntime(session.labId).port || 8080;
      const target = `http://${host}:${port}`;

      const proxy = createProxyMiddleware({
        target,
        changeOrigin: true,
        ws: true,
        pathRewrite: () => {
          const path = url.split("?")[0];
          const idx = path.indexOf("/vscode");
          return path.slice(idx + "/vscode".length) || "/";
        },
      });

      if (typeof proxy.upgrade === "function") {
        proxy.upgrade(req, socket, head);
      } else {
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  });
};
