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
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const upload = multer({ dest: "uploads/" });
app.use(upload.any());



for (const route of ROUTES) {
  expressRoute(app, route, ENV.apiPrefix);
}

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
