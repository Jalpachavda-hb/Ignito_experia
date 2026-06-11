import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  port: Number(process.env.PORT || 8080),
  nodeEnv: process.env.NODE_ENV || "development",
  apiPrefix: process.env.API_PREFIX || "/api",
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
  containerHostMode: process.env.CONTAINER_HOST_MODE || "public",
  defaultSessionMinutes: Number(process.env.DEFAULT_SESSION_TIMEOUT || 120),
  /** Public URL students' browsers use to reach this API (for Jupyter iframe proxy links). */
  apiPublicUrl:
    process.env.API_PUBLIC_URL ||
    `http://localhost:${Number(process.env.PORT || 8080)}${process.env.API_PREFIX || "/api"}`,
};

export const useDynamoDb = () => Boolean(ENV.sessionsTable);
