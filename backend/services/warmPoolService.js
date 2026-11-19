// Warm pool for container labs (docs/lab-startup-optimization.md §3.1).
//
// Keeps a few healthy, unassigned tasks per lab type. A student start claims one with an
// atomic conditional UPDATE, then binds it to the session via lab_server's POST /claim.
// If none is free, the caller falls back to the normal cold RunTask.
//
// Off unless WARM_POOL_ENABLED=true. Sizes per lab type come from WARM_POOL_SIZES_JSON.

import crypto from "crypto";
import pool from "../lib/mysql.js";
import { ENV } from "../config/env.js";
import { labService } from "./labService.js";
import { canonicalLabType } from "../lib/labTypeMapper.js";
import { warmPoolConfig, WARM_POOL_CAPABLE_LAB_TYPES } from "../config/labStartup.js";
import {
  isEcsEnabled,
  describeTask,
  stopEcsTask,
  startWarmPoolTask,
  taskDefinitionHasHealthCheck,
  computeStartStage,
  getTaskPublicIp,
  getTaskPrivateIp,
} from "./ecsService.js";
import { getContainerPort } from "../lib/labTools.js";

const TABLE = "lab_warm_tasks";
let tableReady = false;
let workerHandle = null;

const ensureTable = async () => {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`${TABLE}\` (
      \`TaskArn\`     VARCHAR(255) NOT NULL PRIMARY KEY,
      \`LabId\`       VARCHAR(100) NOT NULL,
      \`LabType\`     VARCHAR(64)  NOT NULL,
      \`Status\`      VARCHAR(16)  NOT NULL DEFAULT 'STARTING',
      \`ClaimSecret\` VARCHAR(128) NOT NULL,
      \`PrivateIp\`   VARCHAR(64)  NULL,
      \`PublicIp\`    VARCHAR(64)  NULL,
      \`TaskPort\`    INT          NULL,
      \`SessionId\`   VARCHAR(64)  NULL,
      \`CreatedAt\`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`WarmAt\`      DATETIME     NULL,
      \`ClaimedAt\`   DATETIME     NULL,
      INDEX \`IDX_warm_type_status\` (\`LabType\`, \`Status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tableReady = true;
};

export const isWarmPoolEnabled = () => warmPoolConfig.enabled && isEcsEnabled();

export const canUseWarmPool = (labType) =>
  isWarmPoolEnabled() && WARM_POOL_CAPABLE_LAB_TYPES.has(labType) && Boolean(warmPoolConfig.sizes[labType]);

const findLabForType = async (labType) => {
  const labs = await labService.getAllActive();
  return (labs || []).find((l) => l.taskDefinition && canonicalLabType(l.id) === labType) || null;
};

const taskHost = (row) => (ENV.containerHostMode === "private" ? row.PrivateIp : row.PublicIp);

const retire = async (taskArn, { stop = true } = {}) => {
  if (stop) await stopEcsTask(taskArn).catch(() => {});
  await pool.query(`UPDATE \`${TABLE}\` SET Status = 'RETIRED' WHERE TaskArn = ?`, [taskArn]);
};

/**
 * Binds a WARM task to a session. Returns { taskArn, publicIp, taskPrivateIp, taskPort } or null.
 * sessionToken / bootstrap are sent to the task over the backend→task connection only.
 */
export const claimWarmTask = async ({ labType, sessionId, sessionToken, bootstrap = null }) => {
  if (!canUseWarmPool(labType) || !sessionToken) return null;
  await ensureTable();

  const [candidates] = await pool.query(
    `SELECT * FROM \`${TABLE}\` WHERE LabType = ? AND Status = 'WARM' ORDER BY WarmAt ASC LIMIT 5`,
    [labType],
  );

  for (const row of candidates || []) {
    // Atomic: only one request can move this row from WARM to CLAIMED.
    const [res] = await pool.query(
      `UPDATE \`${TABLE}\` SET Status = 'CLAIMED', SessionId = ?, ClaimedAt = NOW() WHERE TaskArn = ? AND Status = 'WARM'`,
      [sessionId, row.TaskArn],
    );
    if (res.affectedRows !== 1) continue;

    const host = taskHost(row);
    if (!host) {
      await retire(row.TaskArn);
      continue;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const resp = await fetch(`http://${host}:${row.TaskPort || 8080}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Claim-Secret": row.ClaimSecret },
        body: JSON.stringify({ sessionToken, sessionId, ...(bootstrap ? { bootstrap } : {}) }),
        signal: controller.signal,
      });
      if (resp.ok) {
        return {
          taskArn: row.TaskArn,
          publicIp: row.PublicIp,
          taskPrivateIp: row.PrivateIp,
          taskPort: row.TaskPort,
        };
      }
      // 409 = already claimed elsewhere; anything else = unhealthy task. Either way, drop it.
      console.warn(`[warmPool] Claim refused (${resp.status}) for a ${labType} task; trying the next one`);
      await retire(row.TaskArn);
    } catch (err) {
      console.warn(`[warmPool] Claim request failed for a ${labType} task: ${err.message}`);
      await retire(row.TaskArn);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
};

/** STARTING → WARM once ECS reports the task ready; retire stopped and old tasks. */
const refreshTasks = async () => {
  const [rows] = await pool.query(
    `SELECT * FROM \`${TABLE}\` WHERE Status IN ('STARTING', 'WARM')`,
  );
  const maxAgeMs = warmPoolConfig.maxAgeMinutes * 60 * 1000;
  for (const row of rows || []) {
    try {
      const age = Date.now() - new Date(row.CreatedAt).getTime();
      if (age > maxAgeMs) {
        await retire(row.TaskArn);
        continue;
      }
      const task = await describeTask(row.TaskArn);
      if (!task || task.lastStatus === "STOPPED") {
        await retire(row.TaskArn, { stop: false });
        continue;
      }
      if (row.Status === "STARTING") {
        const hasHealthCheck = await taskDefinitionHasHealthCheck(task.taskDefinitionArn);
        if (computeStartStage(task, hasHealthCheck) !== "READY") continue;
        const privateIp = getTaskPrivateIp(task);
        const publicIp = ENV.containerHostMode === "private" ? null : await getTaskPublicIp(row.TaskArn);
        if (!(ENV.containerHostMode === "private" ? privateIp : publicIp)) continue;
        await pool.query(
          `UPDATE \`${TABLE}\` SET Status = 'WARM', WarmAt = NOW(), PrivateIp = ?, PublicIp = ? WHERE TaskArn = ? AND Status = 'STARTING'`,
          [privateIp, publicIp, row.TaskArn],
        );
      }
    } catch (err) {
      console.warn(`[warmPool] Refresh failed for a ${row.LabType} task: ${err.message}`);
    }
  }
};

/** Start tasks until each lab type has its minimum (bounded per tick for RunTask rate limits). */
const refill = async () => {
  let budget = warmPoolConfig.maxStartsPerTick;
  for (const [labType, size] of Object.entries(warmPoolConfig.sizes)) {
    if (budget <= 0) break;
    if (!WARM_POOL_CAPABLE_LAB_TYPES.has(labType)) continue;
    const min = Number(size?.min ?? size ?? 0);
    const max = Number(size?.max ?? min);
    const [[{ n }]] = await pool.query(
      `SELECT COUNT(*) AS n FROM \`${TABLE}\` WHERE LabType = ? AND Status IN ('STARTING', 'WARM')`,
      [labType],
    );
    const want = Math.min(min, max) - Number(n);
    for (let i = 0; i < want && budget > 0; i += 1, budget -= 1) {
      try {
        const lab = await findLabForType(labType);
        if (!lab) {
          console.warn(`[warmPool] No lab found for type ${labType}; skipping`);
          break;
        }
        const claimSecret = crypto.randomBytes(32).toString("hex");
        const { taskArn } = await startWarmPoolTask({ labId: lab.id, claimSecret });
        const port = await getContainerPort(lab.id);
        await pool.query(
          `INSERT INTO \`${TABLE}\` (TaskArn, LabId, LabType, Status, ClaimSecret, TaskPort) VALUES (?, ?, ?, 'STARTING', ?, ?)`,
          [taskArn, lab.id, canonicalLabType(lab.id), claimSecret, port],
        );
      } catch (err) {
        console.warn(`[warmPool] Could not start a ${labType} warm task: ${err.message}`);
        break; // likely throttled or misconfigured; try again next tick
      }
    }
  }
};

export const warmPoolTick = async () => {
  if (!isWarmPoolEnabled()) return;
  await ensureTable();
  await refreshTasks();
  await refill();
};

export const startWarmPoolWorker = () => {
  if (!isWarmPoolEnabled() || workerHandle) return;
  console.log(`[warmPool] Enabled for: ${Object.keys(warmPoolConfig.sizes).join(", ") || "(no lab types configured)"}`);
  const run = () => warmPoolTick().catch((err) => console.error("[warmPool] Tick failed:", err.message));
  run();
  workerHandle = setInterval(run, warmPoolConfig.refillIntervalSeconds * 1000);
};

/** Replace a claimed task in the background (call after a successful claim). */
export const refillSoon = () => {
  if (!isWarmPoolEnabled()) return;
  setTimeout(() => refill().catch(() => {}), 1000);
};
