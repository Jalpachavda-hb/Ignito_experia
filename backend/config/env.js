import dotenv from "dotenv";
import { isPrivateMode } from "../lib/ipManager.js";

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
  ecsSubnets: ((isPrivateMode ? process.env.ECS_PRIVATE_SUBNETS : process.env.ECS_PUBLIC_SUBNETS) || process.env.ECS_SUBNETS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  ecsSecurityGroups: (process.env.ECS_SECURITY_GROUPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  sessionsTable: process.env.SESSIONS_TABLE_NAME || process.env.DYNAMODB_TABLE_NAME || "",
  runsTable: process.env.RUNS_TABLE_NAME || "",
  submissionsTable: process.env.SUBMISSIONS_TABLE_NAME || "",
  resultsTable: process.env.RESULTS_TABLE_NAME || "",
  containerHostMode: isPrivateMode ? "private" : "public",
  defaultSessionMinutes: Number(process.env.DEFAULT_SESSION_TIMEOUT || 120),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  /** Public URL students' browsers use to reach this API (for Jupyter iframe proxy links). */
  apiPublicUrl: process.env.API_PUBLIC_URL || `http://localhost:${port}${apiPrefix}`,
  /** API server origin without path (for trusted origins, sockets, etc.). */
  apiOrigin: getApiOrigin(process.env.API_PUBLIC_URL || `http://localhost:${port}${apiPrefix}`),
  testCasesBucket: process.env.TEST_CASES_BUCKET || "vlab-dev-lab-files-0kdrg0q8",
  labBootstrapPresignTtlSeconds: Number(process.env.LAB_BOOTSTRAP_PRESIGN_TTL_SECONDS || 3600),
  executeCommandMaxRetries: Number(process.env.EXECUTE_COMMAND_MAX_RETRIES || 6),
  executeCommandTimeout: Number(process.env.EXECUTE_COMMAND_TIMEOUT || 120000),
  executeCommandInitialDelay: Number(process.env.EXECUTE_COMMAND_INITIAL_DELAY || 2000),
  executeCommandMaxDelay: Number(process.env.EXECUTE_COMMAND_MAX_DELAY || 30000),
  executeCommandBackoffFactor: Number(process.env.EXECUTE_COMMAND_BACKOFF_FACTOR || 1.5),
};

export const useDynamoDb = () => Boolean(ENV.sessionsTable);
