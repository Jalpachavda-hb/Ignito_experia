import { createProxyMiddleware } from "http-proxy-middleware";
import { gunzipSync, brotliDecompressSync, inflateSync } from "zlib";
import { getBearerToken, verifyAccessToken, verifyJupyterEmbedToken } from "./lib/jwt.js";
import { getSession } from "./services/sessionRepository.js";
import { getLabRuntime, getContainerHost } from "./lib/labTools.js";
import { ENV } from "./config/env.js";

// Proxy timeout configured to 5s to fail fast during local dev if AWS SG blocks traffic
const PROXY_TIMEOUT_MS = 5000;

const getCookieToken = (req, sessionId) => {
  const cookieHeader = req.headers?.cookie || "";
  const name = `jupyter_sess_${sessionId}=`;
  const part = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(name));
  return part ? decodeURIComponent(part.slice(name.length)) : null;
};

const resolveAuth = (req) => {
  const sessionId = req.params?.sessionId;
  const queryToken = typeof req.query?.access_token === "string" ? req.query.access_token : null;
  const cookieToken = sessionId ? getCookieToken(req, sessionId) : null;
  const bearer = getBearerToken(req.headers || {});

  const tryToken = (token) => {
    if (!token) return null;
    try {
      const claims = verifyJupyterEmbedToken(token);
      const userId = claims.userId || claims.sub;
      if (!userId || !claims.sessionId) return null;
      return { userId, sessionId: claims.sessionId, token };
    } catch {
      return null;
    }
  };

  const fromEmbed = tryToken(queryToken) || tryToken(cookieToken);
  if (fromEmbed) return fromEmbed;

  if (bearer) {
    const claims = verifyAccessToken(bearer);
    return { userId: claims.sub, sessionId: sessionId || claims.sessionId, token: bearer };
  }
  return null;
};

const setJupyterCookie = (res, sessionId, token) => {
  const maxAge = 4 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `jupyter_sess_${sessionId}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`,
  );
};

const stripJupyterPrefix = (req, apiPrefix) => {
  const sessionId = req.params?.sessionId || "";
  const prefixes = [
    `${apiPrefix}/lab-sessions/${sessionId}/jupyter`,
    `/api/lab-sessions/${sessionId}/jupyter`,
    `/lab-sessions/${sessionId}/jupyter`,
  ];
  let path = req.originalUrl?.split("?")[0] || req.url?.split("?")[0] || "/";
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of prefixes) {
      if (path.startsWith(prefix)) {
        path = path.slice(prefix.length) || "/";
        changed = true;
        break;
      }
    }
  }
  return path.startsWith("/") ? path : `/${path}`;
};

const rewriteJupyterHtml = (body, proxyBase) => {
  const base = proxyBase.endsWith("/") ? proxyBase.slice(0, -1) : proxyBase;
  const baseSlash = `${base}/`;
  let out = body
    .replace(/href="\//g, `href="${baseSlash}`)
    .replace(/src="\//g, `src="${baseSlash}`)
    .replace(/url\(\//g, `url(${baseSlash}`)
    .replace(/"baseUrl":\s*"\/"/g, `"baseUrl": "${baseSlash}"`)
    .replace(/"baseUrl":\s*""/g, `"baseUrl": "${baseSlash}"`)
    .replace(/"appUrl":\s*"\/lab"/g, `"appUrl": "${baseSlash}lab"`)
    .replace(/"appUrl":\s*"lab"/g, `"appUrl": "${baseSlash}lab"`)
    .replace(/"fullStaticUrl":\s*"\/static\//g, `"fullStaticUrl": "${baseSlash}static/`)
    .replace(/"staticUrl":\s*"\/static\//g, `"staticUrl": "${baseSlash}static/`)
    .replace(/"wsUrl":\s*"\/"/g, `"wsUrl": "${baseSlash}"`)
    .replace(/"wsUrl":\s*""/g, `"wsUrl": "${baseSlash}"`);

  if (!out.includes("<base ")) {
    out = out.replace(/<head([^>]*)>/i, `<head$1><base href="${baseSlash}">`);
  }
  return out;
};

export const setupJupyterProxy = (app, apiPrefix) => {
  const mountPath = `${apiPrefix}/lab-sessions/:sessionId/jupyter`;

  const skipNonProxyPaths = (req, res, next) => {
    const path = req.originalUrl || req.url || "";
    if (path.includes("jupyter-health")) {
      return next("route");
    }
    return next();
  };

  const authMiddleware = async (req, res, next) => {
    try {
      const auth = resolveAuth(req);
      if (!auth) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const sessionId = req.params.sessionId;
      if (auth.sessionId && auth.sessionId !== sessionId) {
        return res.status(403).json({ success: false, message: "Session mismatch" });
      }

      const session = await getSession(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, message: "Session not found" });
      }
      if (session.userId !== auth.userId) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const runtime = getLabRuntime(session.labId);
      if (runtime.type !== "jupyter") {
        return res.status(400).json({
          success: false,
          message: "This session is not a Jupyter lab.",
        });
      }

      const host = getContainerHost(session);
      if (!host || session.status !== "running") {
        return res.status(503).json({
          success: false,
          message: "Jupyter container is not ready yet",
        });
      }

      req.jupyterTarget = `http://${host}:${runtime.port || 8888}`;
      req.jupyterProxyBase = `${apiPrefix}/lab-sessions/${sessionId}/jupyter`;
      if (auth.token && req.query?.access_token) {
        setJupyterCookie(res, sessionId, auth.token);
      }
      return next();
    } catch (err) {
      console.error("[jupyterProxy auth]", err);
      return res.status(401).json({ success: false, message: err.message || "Unauthorized" });
    }
  };

  const proxyMiddleware = createProxyMiddleware({
    target: "http://placeholder",
    changeOrigin: true,
    ws: true,
    timeout: PROXY_TIMEOUT_MS,
    proxyTimeout: PROXY_TIMEOUT_MS,
    router: (req) => req.jupyterTarget || "http://127.0.0.1:8888",
    pathRewrite: (path, req) => stripJupyterPrefix(req, apiPrefix),
    on: {
      proxyReq(proxyReq) {
        // Remove accept-encoding so upstream sends uncompressed HTML we can rewrite
        proxyReq.removeHeader("accept-encoding");
      },
      error(err, req, res) {
        console.error("[jupyterProxy]", err.message, "target=", req.jupyterTarget);
        if (res.writeHead) {
          res.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem">
            <h2>Jupyter could not be reached</h2>
            <p>The API server cannot connect to the lab container on port <b>8888</b>.</p>
            <p><b>AWS fix:</b> Open inbound TCP <b>8888</b> on the ECS task security group (see docs/JUPYTER_AWS_FIX.md).</p>
            <p style="color:#666;font-size:12px">Target: ${req.jupyterTarget || "unknown"} — ${err.message}</p>
          </body></html>`);
        }
      },
      proxyRes(proxyRes, req, res) {
        delete proxyRes.headers["x-frame-options"];
        proxyRes.headers["content-security-policy"] = "frame-ancestors *";
        proxyRes.headers["access-control-allow-origin"] = "*";

        const contentType = proxyRes.headers["content-type"] || "";
        if (!contentType.includes("text/html") || !req.jupyterProxyBase) {
          return;
        }

        const chunks = [];
        const originalWrite = res.write.bind(res);
        const originalEnd = res.end.bind(res);

        proxyRes.on("data", (chunk) => chunks.push(chunk));
        proxyRes.on("end", () => {
          let body;
          try {
            const raw = Buffer.concat(chunks);
            const encoding = (proxyRes.headers["content-encoding"] || "").toLowerCase();
            if (encoding === "gzip") {
              body = gunzipSync(raw).toString("utf8");
            } else if (encoding === "br") {
              body = brotliDecompressSync(raw).toString("utf8");
            } else if (encoding === "deflate") {
              body = inflateSync(raw).toString("utf8");
            } else {
              body = raw.toString("utf8");
            }
          } catch {
            body = Buffer.concat(chunks).toString("utf8");
          }
          const rewritten = rewriteJupyterHtml(body, req.jupyterProxyBase);
          const buf = Buffer.from(rewritten);
          delete proxyRes.headers["content-length"];
          delete proxyRes.headers["content-encoding"];
          res.removeHeader("content-encoding");
          res.setHeader("content-length", buf.length);
          originalWrite(buf);
          originalEnd();
        });

        res.write = () => true;
        res.end = () => { };
      },
    },
  });

  app.use(mountPath, skipNonProxyPaths, authMiddleware, proxyMiddleware);

  return mountPath;
};

export const attachJupyterProxyUpgrade = (httpServer, apiPrefix) => {
  httpServer.on("upgrade", async (req, socket, head) => {
    const url = req.url || "";
    if (!url.includes("/lab-sessions/") || !url.includes("/jupyter")) {
      return;
    }

    const sessionIdMatch = url.match(/\/lab-sessions\/([^/]+)\/jupyter/);
    if (!sessionIdMatch) {
      return;
    }

    try {
      const session = await getSession(sessionIdMatch[1]);
      if (!session) {
        socket.destroy();
        return;
      }
      const host = getContainerHost(session);
      const port = getLabRuntime(session.labId).port || 8888;
      req.jupyterTarget = `http://${host}:${port}`;

      const proxy = createProxyMiddleware({
        target: req.jupyterTarget,
        changeOrigin: true,
        ws: true,
        pathRewrite: () => {
          const path = url.split("?")[0];
          const idx = path.indexOf("/jupyter");
          return path.slice(idx + "/jupyter".length) || "/";
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
