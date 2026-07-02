import dotenv from "dotenv";

dotenv.config();

const port = Number(process.env.PORT || 8080);
const apiPrefix = process.env.API_PREFIX || "/api";

/** Origin only (scheme + host + port), derived from a full API base URL. */
export const getApiOrigin = (apiPublicUrl) => {
  const value = apiPublicUrl || `http://localhost:${port}${apiPrefix}`;
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return value.replace(/\/api\/?$/i, "");
  }
};

export const ENV = {
  port,
  nodeEnv: process.env.NODE_ENV || "development",
  apiPrefix,
  jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
  awsRegion: process.env.AWS_REGION || "ap-south-1",
  ecsCluster: process.env.ECS_CLUSTER || "",
  ecsSubnets: (process.env.ECS_SUBNETS || "").split(",").map((s) => s.trim()).filter(Boolean),
  ecsSecurityGroups: (process.env.ECS_SECURITY_GROUPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  sessionsTable: process.env.SESSIONS_TABLE_NAME || process.env.DYNAMODB_TABLE_NAME || "",
  runsTable: process.env.RUNS_TABLE_NAME || "",
  submissionsTable: process.env.SUBMISSIONS_TABLE_NAME || "",
  resultsTable: process.env.RESULTS_TABLE_NAME || "",
  containerHostMode: process.env.CONTAINER_HOST_MODE || "private",
  defaultSessionMinutes: Number(process.env.DEFAULT_SESSION_TIMEOUT || 120),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  /** Public URL students' browsers use to reach this API (for Jupyter iframe proxy links). */
  apiPublicUrl: process.env.API_PUBLIC_URL || `http://localhost:${port}${apiPrefix}`,
  /** API server origin without path (for trusted origins, sockets, etc.). */
  apiOrigin: getApiOrigin(process.env.API_PUBLIC_URL || `http://localhost:${port}${apiPrefix}`),
};

export const useDynamoDb = () => Boolean(ENV.sessionsTable);
