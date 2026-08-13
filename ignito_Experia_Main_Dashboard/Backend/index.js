import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { ENV } from "./config/env.js";
import { verifyDbConnection } from "./config/db.js";
import { setupRoutes } from "./router.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically at /uploads
app.use("/uploads", express.static(uploadsDir));

// Verify DB connection on startup
verifyDbConnection();

// CORS — allow owner frontend on port 5174 and any localhost during development
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow image loading across origins
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50000,
  skip: (req) => process.env.NODE_ENV !== "production" || req.ip === "127.0.0.1" || req.ip === "::1" || req.ip === "::ffff:127.0.0.1",
  message: { success: false, message: "Too many requests, please try again later." },
});
app.use(`${ENV.apiPrefix}/`, limiter);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Routes
setupRoutes(app, ENV.apiPrefix);

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(ENV.port, () => {
  console.log(`[Owner Backend] Running at http://localhost:${ENV.port}${ENV.apiPrefix}`);
  console.log(`[Owner Backend] Database: ${ENV.db.name} @ ${ENV.db.host}:${ENV.db.port}`);
  console.log(`[Owner Backend] Static Uploads: http://localhost:${ENV.port}/uploads/`);
});
