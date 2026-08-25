import dotenv from "dotenv";
dotenv.config();

const corsOrigin = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const ENV = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  apiPrefix: process.env.API_PREFIX || "/api",
  jwtSecret: process.env.JWT_SECRET || "owner-secret-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
  /** Allowed browser origins (comma-separated in CORS_ORIGIN). Empty = allow localhost only in non-prod. */
  corsOrigin,
  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    name: process.env.DB_NAME || "ignito_experia",
  },
};
