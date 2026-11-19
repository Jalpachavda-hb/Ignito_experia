import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { gunzipSync, brotliDecompressSync, inflateSync } from "zlib";
import { getBearerToken, verifyAccessToken, verifyJupyterEmbedToken } from "./lib/jwt.js";
import { getSession } from "./services/sessionRepository.js";
import { authorizeLabSession } from "./lib/sessionAccess.js";
import { getLabRuntime, getContainerHost } from "./lib/labTools.js";
import { ENV } from "./config/env.js";

// Proxy timeout configured to 60s for long-running notebook cells and asset loading
const PROXY_TIMEOUT_MS = 60000;

const getCookieToken = (req, sessionId) => {
  const cookieHeader = req.headers?.cookie || "";
  const name = `jupyter_sess_${sessionId}=`;
  const part = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(name));
  return part ? decodeURIComponent(part.slice(name.length)) : null;
};

const sessionIdFromUrl = (url = "") => url.match(/\/(lab-sessions|lab\/sessions)\/([^/?]+)\/jupyter/)?.[2] || null;

const queryParam = (req, name) => {
  if (typeof req.query?.[name] === "string") return req.query[name];
  try {
    return new URL(req.originalUrl || req.url || "/", "http://local").searchParams.get(name);
  } catch {
    return null;
  }
};

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

/**
 * Authorizes a Jupyter proxy request (HTTP or WebSocket upgrade) for one session.
 * Accepts, in order: the signed embed token (?access_token= or the per-session cookie),
 * which must name this session and its owner; or the student's normal bearer token,
 * checked with the same ownership/tenant rules as file and terminal access.
 * Returns { session, cookieToken }; cookieToken is set when the embed token came from the query.
 */
const authorizeJupyter = async (req, sessionId) => {
  if (!sessionId) throw httpError(400, "Session ID required");

  const candidates = [
    [queryParam(req, "access_token"), true],
    [getCookieToken(req, sessionId), false],
  ];
  for (const [token, fromQuery] of candidates) {
    if (!token) continue;
    let claims;
    try {
      claims = verifyJupyterEmbedToken(token);
    } catch {
      continue;
    }
    if (claims.sessionId !== sessionId) continue;
    const session = await getSession(sessionId);
    if (!session) throw httpError(404, "Session not found");
    if (String(claims.sub ?? claims.userId) !== String(session.userId)) continue;
    return { session, cookieToken: fromQuery ? token : null };
  }

  const bearer = getBearerToken(req.headers || {});
  if (bearer) {
    let claims = null;
    try {
      claims = verifyAccessToken(bearer);
    } catch {
      claims = null;
    }
    if (claims) {
      const auth = {
        userId: claims.sub,
        email: claims.email || "",
        role: claims.role || "Tenant User",
        tenantId: claims.tenantId || claims.universityId,
      };
      const { session } = await authorizeLabSession(auth, sessionId);
      if (session) return { session, cookieToken: null };
    }
  }

  throw httpError(401, "Jupyter access requires a valid session link");
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
  const mountPaths = [
    `${apiPrefix}/lab-sessions/:sessionId/jupyter`,
    `${apiPrefix}/lab/sessions/:sessionId/jupyter`
  ];

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
      const { session, cookieToken } = await authorizeJupyter(req, sessionId);
      if (cookieToken) setJupyterCookie(res, sessionId, cookieToken);

      const rt = session.runtimeType?.toLowerCase();
      if (rt !== "jupyter") {
        return res.status(400).json({
          success: false,
          message: "This session is not a Jupyter lab.",
        });
      }

      let host = getContainerHost(session);
      if (!host && session.taskArn) {
        try {
          const { getTaskPublicIp } = await import("./services/ecsService.js");
          const publicIp = await getTaskPublicIp(session.taskArn);
          if (publicIp) {
            host = publicIp;
            session.publicIp = publicIp;
          }
        } catch (e) {}
      }

      const sStatus = (session.status || "").toLowerCase();
      const isStopped = sStatus === "stopped" || sStatus === "expired";
      if (!host || isStopped) {
        return res.status(503).json({
          success: false,
          message: "Jupyter container is not ready yet",
        });
      }

      const runtime = await getLabRuntime(session.labId);
      req.jupyterTarget = `http://${host}:${runtime.port || 8888}`;
      req.jupyterToken = session.jupyterToken || null;
      req.jupyterAuthorized = true;
      const matchedPath = req.originalUrl || req.url || "";
      const pathType = matchedPath.includes("/lab/sessions/") ? "lab/sessions" : "lab-sessions";
      req.jupyterProxyBase = `${apiPrefix}/${pathType}/${sessionId}/jupyter`;
      return next();
    } catch (err) {
      const status = err.statusCode || 401;
      if (status >= 500) console.error("[jupyterProxy auth]", err.message);
      return res.status(status).json({ success: false, message: status >= 500 ? "Unauthorized" : err.message });
    }
  };

  const proxyMiddleware = createProxyMiddleware({
    target: "http://placeholder",
    changeOrigin: true,
    ws: true,
    timeout: PROXY_TIMEOUT_MS,
    proxyTimeout: PROXY_TIMEOUT_MS,
    pathFilter: (pathname, req) => {
      const full = req?.originalUrl || req?.url || pathname || "";
      return full.includes("/jupyter");
    },
    router: async (req) => {
      // HTTP requests were already authorized by authMiddleware.
      if (req.jupyterAuthorized && req.jupyterTarget) {
        return req.jupyterTarget;
      }
      // WebSocket upgrades bypass Express middleware, so authorize them here.
      req.jupyterAuthorized = false;
      const sessionId = sessionIdFromUrl(req.originalUrl || req.url || "");
      try {
        const { session } = await authorizeJupyter(req, sessionId);
        let host = getContainerHost(session);
        if (!host && session.taskArn) {
          const { getTaskPublicIp } = await import("./services/ecsService.js");
          host = await getTaskPublicIp(session.taskArn);
        }
        const sStatus = (session.status || "").toLowerCase();
        if (host && sStatus !== "stopped" && sStatus !== "expired") {
          const runtime = await getLabRuntime(session.labId);
          req.jupyterTarget = `http://${host}:${runtime.port || 8888}`;
          req.jupyterToken = session.jupyterToken || null;
          req.jupyterAuthorized = true;
          return req.jupyterTarget;
        }
      } catch {
        // unauthorized or not ready: fall through
      }
      // Never fall back to a real Jupyter (e.g. one on this host); proxyReqWs drops the socket.
      return "http://127.0.0.1:9";
    },
    pathRewrite: (path, req) => {
      const url = req.originalUrl || req.url || path || "";
      const match = url.match(/\/(lab-sessions|lab\/sessions)\/([^/]+)\/jupyter/);
      const sessionId = match ? match[2] : "";
      const pathType = match ? match[1] : "lab-sessions";
      const prefix = `${apiPrefix}/${pathType}/${sessionId}/jupyter`;
      return path.startsWith(prefix) ? path : `${prefix}${path}`;
    },
    on: {
      proxyReq: (proxyReq, req, res) => {
        fixRequestBody(proxyReq, req);
        // Authenticate to Jupyter with the per-session JUPYTER_TOKEN. This also drops the
        // student's own bearer token, which must not be forwarded into the lab container.
        proxyReq.removeHeader("authorization");
        if (req.jupyterToken) proxyReq.setHeader("Authorization", `token ${req.jupyterToken}`);
        const target = req.jupyterTarget;
        if (target) {
          try {
            const u = new URL(target);
            proxyReq.setHeader("origin", u.origin);
            proxyReq.setHeader("host", u.host);
          } catch (e) {}
        }
      },
      proxyReqWs: (proxyReq, req, socket, options, head) => {
        if (!req.jupyterAuthorized) {
          proxyReq.destroy();
          socket.destroy();
          return;
        }
        proxyReq.removeHeader("authorization");
        if (req.jupyterToken) proxyReq.setHeader("Authorization", `token ${req.jupyterToken}`);
        proxyReq.setHeader("Connection", "Upgrade");
        proxyReq.setHeader("Upgrade", "websocket");
        const target = req.jupyterTarget || (typeof options?.target === "string" ? options.target : options?.target?.href);
        if (target) {
          try {
            const u = new URL(target);
            proxyReq.setHeader("origin", u.origin);
            proxyReq.setHeader("host", u.host);
          } catch (e) {}
        }
      },
      error(err, req, res) {
        console.error("[jupyterProxy]", err.message);
        if (res.writeHead) {
          res.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem">
            <h2>Jupyter could not be reached</h2>
            <p>The API server cannot connect to the lab container on port <b>8888</b>.</p>
            <p><b>AWS fix:</b> Open inbound TCP <b>8888</b> on the ECS task security group (see docs/JUPYTER_AWS_FIX.md).</p>
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

  app.use(mountPaths, skipNonProxyPaths, authMiddleware, proxyMiddleware);

  return mountPaths[0];
};

export const attachJupyterProxyUpgrade = (httpServer, apiPrefix) => {
  // http-proxy-middleware with `ws: true` and `pathFilter` automatically handles
  // HTTP upgrade events via its internal handleUpgrade and our async router.
  // We keep this function exported for compatibility.
};
