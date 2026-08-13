import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { createServer } from "http";
import { Server } from "socket.io";
import { ENV } from "./config/env.js";
import { ROUTES } from "./router.js";
import { expressRoute } from "./lib/apigw.js";
import { setupTerminal } from "./terminalHandler.js";
import { setupJupyterProxy, attachJupyterProxyUpgrade } from "./jupyterProxy.js";
import { cleanupExpiredSessions } from "./services/sessionCleanup.js";
import { sessionCleanupService } from "./services/SessionCleanupService.js";
import { verifyDbConnection } from "./lib/mysql.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

import { auditContextMiddleware } from "./middleware/auditContext.js";
import { auditCleanupService } from "./services/AuditCleanupService.js";
import { analyticsCronService } from "./services/analytics/AnalyticsCronService.js";

const app = express();
const httpServer = createServer(app);

// Verify DB on startup
verifyDbConnection();

const io = new Server(httpServer, {
  cors: {
    origin: ENV.corsOrigin,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  },
});

app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true
}));

app.use(helmet());
app.use(auditContextMiddleware);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50000,
  skip: (req) => process.env.NODE_ENV !== "production" || req.ip === "127.0.0.1" || req.ip === "::1" || req.ip === "::ffff:127.0.0.1",
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const upload = multer({ dest: "uploads/" });
app.use(upload.any());



// URL rewrite fallback to handle download requests missing the /api prefix
app.use((req, res, next) => {
  if (req.path === "/files/download") {
    req.url = `/api${req.url}`;
  }
  next();
});

for (const route of ROUTES) {
  expressRoute(app, route, ENV.apiPrefix);
}

// Global active SSE logs streams registry
global.activeLogStreams = global.activeLogStreams || new Map();

app.get("/api/runs/:runId/logs", (req, res) => {
  const { runId } = req.params;
  
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.flushHeaders();

  let streamEntry = global.activeLogStreams.get(runId);
  if (!streamEntry) {
    streamEntry = { clients: [], history: [], completed: false };
    global.activeLogStreams.set(runId, streamEntry);
  }

  // Send history logs
  for (const log of streamEntry.history) {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  }

  // Add client to stream
  streamEntry.clients.push(res);

  // Send initial message if empty to establish connection
  if (streamEntry.history.length === 0) {
    const initMsg = { type: "info", message: "Connecting to execution logs stream...", timestamp: new Date().toISOString() };
    res.write(`data: ${JSON.stringify(initMsg)}\n\n`);
  }

  // Heartbeat ping every 15s to prevent cloud proxy disconnects
  const pingInterval = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() })}\n\n`);
    } catch (err) {
      clearInterval(pingInterval);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(pingInterval);
    const entry = global.activeLogStreams.get(runId);
    if (entry) {
      entry.clients = entry.clients.filter((client) => client !== res);
      if (entry.clients.length === 0 && entry.completed) {
        global.activeLogStreams.delete(runId);
      }
    }
  });
});


setupJupyterProxy(app, ENV.apiPrefix);
attachJupyterProxyUpgrade(httpServer, ENV.apiPrefix);

setupTerminal(io);

// Periodically check and auto-stop expired lab sessions every 30 seconds
setInterval(() => {
  cleanupExpiredSessions();
}, 30000);

// Run Enterprise Auth Session Cleanup every 5 minutes
setInterval(() => {
  sessionCleanupService.runCleanupJob().catch(console.error);
}, 5 * 60 * 1000);

// Run Enterprise Audit Retention Archive daily
setInterval(() => {
  auditCleanupService.runRetentionCleanup().catch(console.error);
}, 24 * 60 * 60 * 1000);

// Run Enterprise Analytics Precomputation hourly (should be daily in prod)
setInterval(() => {
  analyticsCronService.runDailyAggregation().catch(console.error);
}, 60 * 60 * 1000);

// Error handlers must be last
app.use(notFoundHandler);
app.use(errorHandler);

httpServer.listen(ENV.port, () => {
  console.log(`VLab API server: ${ENV.apiPublicUrl}`);
  console.log(`Storage: ${ENV.sessionsTable ? `DynamoDB (${ENV.sessionsTable})` : "in-memory"}`);
  console.log(`ECS: ${ENV.ecsCluster || "disabled (mock sessions)"}`);
  console.log(`Container access: ${ENV.containerHostMode} (8080=IDE, 8888=Jupyter)`);
});
