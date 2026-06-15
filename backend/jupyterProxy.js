import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
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

  console.log(`[jupyterProxy resolveAuth] Checking auth for sessionId: ${sessionId}`);
  console.log(`[jupyterProxy resolveAuth] queryToken: ${queryToken ? queryToken.substring(0, 20) + "..." : "none"}`);
  console.log(`[jupyterProxy resolveAuth] cookieToken: ${cookieToken ? cookieToken.substring(0, 20) + "..." : "none"}`);
  console.log(`[jupyterProxy resolveAuth] bearer: ${bearer ? bearer.substring(0, 20) + "..." : "none"}`);

  const tryToken = (token, source) => {
    if (!token) return null;
    try {
      const claims = verifyJupyterEmbedToken(token);
      const userId = claims.userId || claims.sub;
      if (!userId || !claims.sessionId) {
        console.log(`[jupyterProxy resolveAuth] Token from ${source} is missing sub/userId or sessionId`);
        return null;
      }
      return { userId, sessionId: claims.sessionId, token };
    } catch (err) {
      console.log(`[jupyterProxy resolveAuth] Token from ${source} failed verification: ${err.message}`);
      return null;
    }
  };

  const fromEmbed = tryToken(queryToken, "query") || tryToken(cookieToken, "cookie");
  if (fromEmbed) return fromEmbed;

  if (bearer) {
    try {
      const claims = verifyAccessToken(bearer);
      return { userId: claims.sub, sessionId: sessionId || claims.sessionId, token: bearer };
    } catch (err) {
      console.log(`[jupyterProxy resolveAuth] Bearer token verification failed: ${err.message}`);
    }
  }
  console.log(`[jupyterProxy resolveAuth] No valid authentication found`);
  return null;
};

const setJupyterCookie = (res, sessionId, token) => {
  const maxAge = 4 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `jupyter_sess_${sessionId}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=None; Secure`,
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
      const sessionId = req.params.sessionId;
      const session = await getSession(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, message: "Session not found" });
      }

      const rt = session.runtimeType?.toLowerCase();
      if (rt !== "jupyter") {
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

      const runtime = await getLabRuntime(session.labId);
      req.jupyterTarget = `http://${host}:${runtime.port || 8888}`;
      req.jupyterProxyBase = `${apiPrefix}/lab-sessions/${sessionId}/jupyter`;
      return next();
    } catch (err) {
      console.error("[jupyterProxy auth]", err);
      return res.status(401).json({ success: false, message: err.message || "Unauthorized" });
    }
  };

  const proxyMiddleware = createProxyMiddleware({
    target: "http://placeholder",
    changeOrigin: true,
    ws: false,
    timeout: PROXY_TIMEOUT_MS,
    proxyTimeout: PROXY_TIMEOUT_MS,
    router: (req) => {
      console.log(`[jupyterProxy router] url=${req.url} jupyterTarget=${req.jupyterTarget}`);
      return req.jupyterTarget || "http://127.0.0.1:8888";
    },
    pathRewrite: (path, req) => {
      const url = req.originalUrl || req.url || path || "";
      const match = url.match(/\/lab-sessions\/([^/]+)\/jupyter/);
      const sessionId = match ? match[1] : "";
      const prefix = `${apiPrefix}/lab-sessions/${sessionId}/jupyter`;
      return path.startsWith(prefix) ? path : `${prefix}${path}`;
    },
    on: {
      proxyReq: fixRequestBody,
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
        if (!contentType.includes("text/html")) {
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

          // Inject script to force links and window.open to load in the same frame
          const script = `
<script>
  (function() {
    // Override window.open to load in the same frame
    const originalOpen = window.open;
    window.open = function(url, name, specs) {
      if (url) {
        window.location.href = url;
        return window;
      }
      return originalOpen.apply(this, arguments);
    };

    // Intercept link clicks to force target="_self"
    document.addEventListener('click', function(e) {
      let target = e.target;
      while (target && target.tagName !== 'A') {
        target = target.parentNode;
      }
      if (target && target.getAttribute('target') === '_blank') {
        target.setAttribute('target', '_self');
      }
    }, true);
  })();
</script>
`;
          const rewritten = body.replace(/<head([^>]*)>/i, `<head$1>${script}`);
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

  global.jupyterWsProxy = proxyMiddleware;

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
      const runtime = await getLabRuntime(session.labId);
      const port = runtime.port || 8888;
      req.jupyterTarget = `http://${host}:${port}`;

      if (global.jupyterWsProxy && typeof global.jupyterWsProxy.upgrade === "function") {
        global.jupyterWsProxy.upgrade(req, socket, head);
      } else {
        socket.destroy();
      }
    } catch (err) {
      console.error("[jupyterProxyUpgrade error]", err);
      socket.destroy();
    }
  });
};
