// Start-time configuration for container labs (docs/lab-startup-optimization.md).
// Values are defaults; override per environment with the JSON env vars below so they can be
// tuned from real measurements without a code change.

const parseJsonEnv = (name, fallback) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    console.warn(`[labStartup] Ignoring invalid JSON in ${name}`);
    return fallback;
  }
};

// Typical cold-start time (seconds) shown to students while a lab boots.
const DEFAULT_EXPECTED_READY_SECONDS = {
  python: 60,
  java: 75,
  linux: 60,
  agilemethodology: 75,
  softwareengeering: 75,
  mysql: 75,
  postgres: 75,
  oracle: 300,
  testing: 120,
  dotnet: 120,
  bigdata: 150,
  datascience: 120,
  android: 180,
  "android-emulator": 300,
  redhat: 75,
  kali: 120,
};
const DEFAULT_SECONDS = 90;

const expectedReadySeconds = {
  ...DEFAULT_EXPECTED_READY_SECONDS,
  ...parseJsonEnv("LAB_EXPECTED_READY_SECONDS_JSON", {}),
};

export const getExpectedReadySeconds = (labType) =>
  Number(expectedReadySeconds[labType] ?? expectedReadySeconds.default ?? DEFAULT_SECONDS);

// Per-lab-type security groups, e.g. {"kali": ["sg-123"]} (terraform output lab_task_security_group_ids).
// Lab types not listed use ECS_SECURITY_GROUPS.
const labSecurityGroups = parseJsonEnv("LAB_SECURITY_GROUPS_JSON", {});

export const getLabSecurityGroups = (labType, fallback = []) => {
  const groups = labSecurityGroups[labType];
  if (Array.isArray(groups) && groups.length) return groups;
  if (typeof groups === "string" && groups.trim()) return groups.split(",").map((g) => g.trim()).filter(Boolean);
  return fallback;
};

// Warm pool (section 3.1). Off unless WARM_POOL_ENABLED=true.
// WARM_POOL_SIZES_JSON: {"python": {"min": 2, "max": 4}, "java": {"min": 1, "max": 2}}
export const warmPoolConfig = {
  enabled: String(process.env.WARM_POOL_ENABLED || "").toLowerCase() === "true",
  sizes: parseJsonEnv("WARM_POOL_SIZES_JSON", {}),
  maxAgeMinutes: Number(process.env.WARM_POOL_MAX_AGE_MINUTES || 240),
  refillIntervalSeconds: Number(process.env.WARM_POOL_REFILL_INTERVAL_SECONDS || 60),
  // Space out RunTask calls during refills (Fargate API rate limits).
  maxStartsPerTick: Number(process.env.WARM_POOL_MAX_STARTS_PER_TICK || 3),
};

// Lab types whose image serves lab_server.py (supports POST /claim). Excluded:
// - datascience (JUPYTER_TOKEN) and testing (VNC_PASSWORD): per-session secrets are read at
//   boot and /claim cannot set them, so a warm task could not be locked to one student;
// - dotnet and android(-emulator): they read per-session bootstrap settings (DOTNET_SUBTYPE,
//   starter files) at boot. Add them once their images accept `bootstrap` in POST /claim.
export const WARM_POOL_CAPABLE_LAB_TYPES = new Set([
  "python", "java", "linux", "agilemethodology", "softwareengeering",
  "mysql", "postgres", "oracle", "bigdata", "redhat", "kali",
]);
