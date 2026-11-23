import pool from "../lib/mysql.js";
import { ok } from "../lib/apigw.js";
import { badRequest, forbidden, notFound, unauthorized } from "../lib/errors.js";
import { canonicalLabType } from "../lib/labTypeMapper.js";
import { getLabById, resolveLabAlias } from "../config/labs.js";
import { getExpectedReadySeconds } from "../config/labStartup.js";
import { claimWarmTask, refillSoon } from "../services/warmPoolService.js";
import labSessionRepository from "../repositories/LabSessionRepository.js";
import creditWalletService from "../services/CreditWalletService.js";
import creditWalletRepository from "../repositories/CreditWalletRepository.js";
import studentLabTokenWalletRepository from "../repositories/StudentLabTokenWalletRepository.js";
import usageBillingService from "../services/UsageBillingService.js";
import runtimeStopService from "../services/RuntimeStopService.js";
import {
  createSessionRecord,
  getSession,
  saveSession,
  updateSession,
  deleteSession,
  ensureSessionSecrets,
  toPublicSession,
} from "../services/sessionRepository.js";
import {
  isEcsEnabled,
  startEcsTask,
  stopEcsTask,
  describeTask,
  resolveTaskNetworking,
} from "../services/ecsService.js";
import { clearSessionFiles, clearDiskWorkspace } from "../services/fileRepository.js";
import { bootstrap as bootstrapSession, switchDotnetSubtypeWorkspace } from "../services/workspaceBootstrapService.js";
import userWorkspaceService from "../services/UserWorkspaceService.js";
import { resolveAuthTenantId } from "../lib/studentTenant.js";
import { applyRuntimeReadiness } from "../services/sessionReadiness.js";
import studentLabAccessService, { invalidateStudentLabAccess } from "../services/StudentLabAccessService.js";

function calculateRemainingSeconds(expiresAt) {
  if (!expiresAt) return 0;
  let expiresMs = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  if (typeof expiresAt === 'string' && !expiresAt.endsWith('Z') && !expiresAt.includes('+')) {
    const utcMs = new Date(expiresAt + 'Z').getTime();
    if (!isNaN(utcMs)) {
      expiresMs = Math.max(expiresMs, utcMs);
    }
  }
  const diffMs = expiresMs - Date.now();
  return Math.max(0, Math.floor(diffMs / 1000));
}

export const verifySessionOwnership = async (dbSession, auth) => {
  if (!dbSession || !auth) return false;
  if (auth.role === "Super Admin" || auth.role === "Tenant Admin" || auth.authType === "ADMIN") return true;
  if (String(dbSession.UserId) === String(auth.userId) || String(dbSession.UserId) === String(auth.id)) {
    return true;
  }
  const rawAuthId = String(auth?.userId || auth?.id || "").trim();
  const isNum = /^\d+$/.test(rawAuthId);
  const numId = isNum ? parseInt(rawAuthId, 10) : -1;
  const lookupEmail = String(auth?.email || "").trim().toLowerCase();

  try {
    const [uRows] = await pool.query(
      `SELECT UserId FROM Users 
       WHERE UserId = ? 
         AND ((UserId = ? AND ? > 0) OR (LOWER(Email) = LOWER(?) AND ? != '') OR (ExternalStudentId = ? AND ? != '')) 
       LIMIT 1`,
      [dbSession.UserId, numId, numId, lookupEmail, lookupEmail, rawAuthId, rawAuthId]
    );
    return Boolean(uRows && uRows.length > 0);
  } catch (err) {
    console.warn("[verifySessionOwnership] Error verifying ownership:", err.message);
    return false;
  }
};

const effectiveUserIdForCache = (userId) => String(userId);

export const sessionsStartHandler = async ({ body, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const userId = String(auth.userId);
  // Tenant from the signed token or the student's own records, never from the request body.
  const tenantId = await resolveAuthTenantId(auth, { fallback: "DIRECT" });

  const labId = body?.labId;
  const idempotencyKey = body?.idempotencyKey || body?.referenceId || null;

  if (!labId) throw badRequest("labId is required");
  const lab = await getLabById(labId);
  if (!lab) throw notFound("Lab not found");

  // Access is decided by the backend before any row is locked (LMS lookups can be slow).
  // Only needed when the student has no tokens for this lab: a university-assigned lab then gets
  // its course credit; any other lab is refused. Values from the request body are never used.
  const isAdminCaller = auth?.role?.includes('Super Admin') || auth?.role?.includes('Tenant Admin') || auth?.authType === 'ADMIN';
  let preAccess = null;
  if (!isAdminCaller) {
    const preWallet = await studentLabTokenWalletRepository.getWallet(tenantId, userId, labId, auth?.email).catch(() => null);
    if (Number(preWallet?.RemainingTokens || 0) <= 0) {
      preAccess = await studentLabAccessService.getLabAccess(auth, labId).catch((err) => {
        console.warn("[sessionsStartHandler] lab access lookup failed:", err.message);
        return null;
      });
    }
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  let dbSession = null;
  const startedAtDate = new Date();
  const maxInfrastructureExpiresAtDate = new Date(startedAtDate.getTime() + 12 * 60 * 60 * 1000);
  const rawSubtype = String(body?.dotnetSubtype || body?.subtype || body?.subType || "").toLowerCase().trim();
  const dotnetSubtype = rawSubtype.includes("mvc") ? "mvc" : (rawSubtype.includes("console") ? "console" : (rawSubtype || null));

  try {
    // Check student-scoped active session
    let activeSession = await labSessionRepository.findActiveSessionForUser(userId, tenantId, connection);
    if (activeSession) {
      const remainingSeconds = calculateRemainingSeconds(activeSession.ExpiresAt);
      const isExpired = remainingSeconds <= 0;
      let shouldAutoComplete = false;
      let autoCompletedReason = "";

      if (isExpired) {
        shouldAutoComplete = true;
        autoCompletedReason = "Session expired";
      } else if (activeSession.Status === 'STOPPING') {
        shouldAutoComplete = true;
        autoCompletedReason = "Session was in STOPPING status";
      } else if (isEcsEnabled()) {
        if (!activeSession.TaskArn) {
          const startedMs = activeSession.StartedAt ? new Date(activeSession.StartedAt).getTime() : 0;
          const createdMs = activeSession.CreatedAt ? new Date(activeSession.CreatedAt).getTime() : 0;
          const ageMs = Date.now() - Math.max(startedMs, createdMs);
          if (ageMs > 45000 || activeSession.Status !== 'STARTING') {
            shouldAutoComplete = true;
            autoCompletedReason = "No ECS TaskArn assigned to session";
          }
        } else {
          try {
            const task = await describeTask(activeSession.TaskArn);
            if (!task || task.lastStatus === 'STOPPED') {
              shouldAutoComplete = true;
              autoCompletedReason = `ECS task ${activeSession.TaskArn} is STOPPED or not found`;
            }
          } catch (ecsErr) {
            console.warn(`[sessionsStartHandler] Could not verify ECS task status:`, ecsErr.message);
            const msg = (ecsErr.message || "").toLowerCase();
            if (msg.includes("not found") || msg.includes("missing") || msg.includes("invalidparameter") || msg.includes("does not exist")) {
              shouldAutoComplete = true;
              autoCompletedReason = `ECS task missing from cluster: ${ecsErr.message}`;
            }
          }
        }
      }

      if (body?.force || body?.resetPrevious) {
        shouldAutoComplete = true;
        autoCompletedReason = "User requested force start / reset previous session";
      }

      if (shouldAutoComplete) {
        console.log(`[sessionsStartHandler] Auto-completing stale session ${activeSession.SessionId}: ${autoCompletedReason}`);
        await labSessionRepository.updateSession(activeSession.SessionId, {
          Status: 'STOPPED',
          EndedAt: new Date()
        }, connection).catch(() => {});
        try {
          await usageBillingService.finalizeSessionBilling(activeSession.SessionId);
        } catch (e) {}
        clearSessionFiles(activeSession.SessionId, activeSession);
        await deleteSession(activeSession.SessionId).catch(() => {});
        activeSession = null;
      }
    }

    if (activeSession) {
      await connection.rollback();
      connection.release();
      // Same lab (e.g. page reload or a second click): hand back the existing session instead
      // of starting another task.
      if (String(resolveLabAlias(activeSession.LabId)).toLowerCase() === String(resolveLabAlias(labId)).toLowerCase()) {
        const existingType = canonicalLabType(resolveLabAlias(activeSession.LabId));
        const existingStatus = String(activeSession.Status || "STARTING").toUpperCase();
        return ok({
          sessionId: activeSession.SessionId,
          labId: activeSession.LabId,
          status: existingStatus,
          reused: true,
          stage: existingStatus === "STARTING" ? "PROVISIONING" : "READY",
          expectedReadySeconds: getExpectedReadySeconds(existingType),
          warm: false,
          startedAt: activeSession.StartedAt,
          expiresAt: activeSession.ExpiresAt,
          remainingSeconds: calculateRemainingSeconds(activeSession.ExpiresAt),
          allocatedCredits: activeSession.AllocatedCredits,
          allocatedDurationMinutes: activeSession.AllocatedDurationMinutes,
          dotnetSubtype: activeSession.Subtype || null,
          message: "Reconnected to your running lab session.",
        });
      }
      throw badRequest("You already have an active lab session. Please stop or complete the current session before starting another lab.");
    }

    // Lock lab-specific token wallet FOR UPDATE
    let labWallet = await studentLabTokenWalletRepository.getWalletForUpdate(tenantId, userId, labId, auth?.email, connection);
    let remainingTokens = Number(labWallet?.RemainingTokens || 0);

    const isAdmin = auth?.role?.includes('Super Admin') || auth?.role?.includes('Tenant Admin') || auth?.authType === 'ADMIN';

    if (!isAdmin && remainingTokens <= 0) {
      // Course credit only for a lab the backend confirmed as university-assigned to this student.
      const universityAccess = Boolean(preAccess?.access?.viaUniversity) && preAccess?.status === 'active';

      if (universityAccess) {
        const rawLabId = String(labId).toLowerCase().trim();
        const cleanLabId = rawLabId.replace(/^lab-/, '').replace(/-lab$/, '');
        const mappedCourses = (preAccess.access.courses || []).join(',');
        const defaultCredit = (cleanLabId.includes('dbms') || mappedCourses.includes('4031')) ? 90 : ((cleanLabId.includes('dotnet') || mappedCourses.includes('4011')) ? 80 : 60);
        const practicalCredit = Number(preAccess.access.practicalCredit || defaultCredit);

        try {
          await connection.query(
            `INSERT INTO student_lab_token_wallets (TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, RemainingTokens, Version)
             VALUES (?, ?, ?, ?, 0, ?, 1)
             ON DUPLICATE KEY UPDATE
               TotalPurchasedTokens = IF(TotalPurchasedTokens < VALUES(TotalPurchasedTokens), VALUES(TotalPurchasedTokens), TotalPurchasedTokens),
               RemainingTokens = CASE WHEN CAST(TotalPurchasedTokens AS SIGNED) >= CAST(ConsumedTokens AS SIGNED) THEN CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED) ELSE 0 END`,
            [tenantId || 'DEFAULT', String(userId), cleanLabId, practicalCredit, practicalCredit]
          );
        } catch (e) {}

        labWallet = await studentLabTokenWalletRepository.getWalletForUpdate(tenantId, userId, labId, auth?.email, connection);
        remainingTokens = Number(labWallet?.RemainingTokens || practicalCredit);
      }

      if (!isAdmin && remainingTokens <= 0) {
        await connection.rollback();
        connection.release();
        throw forbidden(`You do not have available tokens for lab '${lab.title || labId}'. Please purchase lab tokens to start this session.`);
      }
    }

    const sessionTokens = remainingTokens > 0 ? remainingTokens : 60; // Admin fallback duration
    const startedAtDate = new Date();
    const tokenExpiryAtDate = new Date(startedAtDate.getTime() + sessionTokens * 60 * 1000);

    // Resolve or ensure valid UserId in Users table so foreign key constraint never fails
    let effectiveUserId = null;
    const rawUserId = String(userId).trim();
    const isNumeric = /^\d+$/.test(rawUserId);
    const numericId = isNumeric ? parseInt(rawUserId, 10) : -1;
    const email = String(auth?.email || (rawUserId.includes("@") ? rawUserId : "")).trim().toLowerCase();

    try {
      const [uRows] = await connection.query(
        `SELECT UserId, TenantId, Email FROM Users 
         WHERE (UserId = ? AND ? > 0)
            OR (LOWER(Email) = LOWER(?) AND ? != '')
            OR (ExternalStudentId = ? AND ? != '')
         LIMIT 1`,
        [numericId, numericId, email, email, rawUserId, rawUserId]
      );

      if (uRows && uRows.length > 0) {
        effectiveUserId = uRows[0].UserId;
      }
    } catch (userErr) {
      console.warn("[sessionsStartHandler] User lookup failed:", userErr.message);
    }
    // The signed token always names an existing account (SSO and direct login create it first).
    // Never invent a placeholder student here; that created duplicate, fake-profile accounts.
    if (!effectiveUserId) {
      await connection.rollback();
      connection.release();
      throw unauthorized("Your account could not be found. Please sign in again.");
    }

    let starterAssetKey = null;
    if (dotnetSubtype === "mvc") {
      starterAssetKey = "lab-assets/dotnet/mvc/latest.tar.gz";
    } else if (dotnetSubtype === "console" || dotnetSubtype === "console-snippet") {
      starterAssetKey = "lab-assets/dotnet/console-snippet/latest.tar.gz";
    }

    // Generate Session ID & create lab_sessions DB row (Status = STARTING)
    const sessionRecord = createSessionRecord({
      userId: String(effectiveUserId),
      labId,
      labType: canonicalLabType(labId),
      runtimeType: lab.runtime?.type || lab.RuntimeType || lab.runtimeType || "ide",
      durationMinutes: sessionTokens,
      dotnetSubtype,
      starterAssetKey,
    });

    // All lab sessions start 100% clean and fresh with 0 files; never restore prior files from old sessions.
    sessionRecord.files = [];
    userWorkspaceService.clearUserWorkspace(effectiveUserId, labId).catch(() => {});
    clearDiskWorkspace();

    const sessionId = sessionRecord.sessionId;

    dbSession = await labSessionRepository.createSession({
      sessionId,
      tenantId,
      userId: effectiveUserId,
      labId,
      allocatedCredits: sessionTokens,
      allocatedDurationMinutes: sessionTokens,
      startedAt: startedAtDate,
      tokenExpiryAt: tokenExpiryAtDate,
      expiresAt: tokenExpiryAtDate,
      subtype: dotnetSubtype,
      status: 'STARTING'
    }, connection);

    const startedIso = new Date(dbSession.StartedAt).toISOString();
    const expiresIso = new Date(tokenExpiryAtDate).toISOString();

    sessionRecord.startedAt = startedIso;
    sessionRecord.expiresAt = expiresIso;
    sessionRecord.allocatedCredits = sessionTokens;
    sessionRecord.allocatedDurationMinutes = sessionTokens;
    sessionRecord.dotnetSubtype = dotnetSubtype;
    sessionRecord.starterAssetKey = starterAssetKey;
    sessionRecord.status = 'starting';
    await saveSession(sessionRecord);

    await connection.commit();
    connection.release();
    // A course-credit wallet may have just been created: refresh the dashboard's access list.
    invalidateStudentLabAccess(effectiveUserIdForCache(userId)).catch(() => {});
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); connection.release(); } catch (e) {}
    }
    throw err;
  }

  // 3. Post-Commit: Launch Container / ECS Task
  if (!isEcsEnabled()) {
    // Local mock environment -> Mark RUNNING and initialize LastBilledAt = NOW(), UnbilledSeconds = 0, TokenExpiryAt
    const now = new Date();
    const sessionTokens = dbSession.AllocatedCredits || 60;
    const tokenExpiryAt = new Date(now.getTime() + sessionTokens * 60 * 1000);

    await labSessionRepository.updateSession(dbSession.SessionId, {
      Status: 'RUNNING',
      StartedAt: now,
      TokenExpiryAt: tokenExpiryAt,
      ExpiresAt: tokenExpiryAt,
      LastBilledAt: now,
      UnbilledSeconds: 0
    });
    const memorySess = await getSession(dbSession.SessionId);
    if (memorySess) {
      memorySess.status = "running";
      memorySess.startedAt = now.toISOString();
      memorySess.expiresAt = tokenExpiryAt.toISOString();
      await saveSession(memorySess);
    }
    return ok({
      sessionId: dbSession.SessionId,
      status: 'RUNNING',
      startedAt: now,
      expiresAt: tokenExpiryAt,
      remainingSeconds: calculateRemainingSeconds(tokenExpiryAt),
      allocatedCredits: dbSession.AllocatedCredits,
      allocatedDurationMinutes: dbSession.AllocatedDurationMinutes,
      dotnetSubtype: dotnetSubtype || dbSession.Subtype || null,
      message: 'Lab environment is running.'
    });
  }

  try {
    // Fail closed: every task gets real per-session secrets. Never start a task with a
    // missing or shared token (that would expose code execution / Jupyter / noVNC).
    let memorySess = await getSession(dbSession.SessionId);
    if (!memorySess) {
      throw new Error("Runtime session record missing; refusing to start a task without a session token");
    }
    if (!memorySess.sessionToken || !memorySess.jupyterToken || !memorySess.vncPassword) {
      memorySess = await saveSession(ensureSessionSecrets(memorySess));
    }

    // Warm pool first: a healthy task that only needs to be bound to this session.
    const startLabType = canonicalLabType(lab?.id || labId);
    const warm = await claimWarmTask({
      labType: startLabType,
      sessionId: dbSession.SessionId,
      sessionToken: memorySess.sessionToken,
    }).catch((e) => {
      console.warn("[sessionsStart] Warm-pool claim failed, starting cold:", e.message);
      return null;
    });
    if (warm) {
      await labSessionRepository.updateSession(dbSession.SessionId, { TaskArn: warm.taskArn });
      memorySess.taskArn = warm.taskArn;
      memorySess.taskPort = warm.taskPort;
      memorySess.publicIp = warm.publicIp;
      memorySess.taskPrivateIp = warm.taskPrivateIp;
      memorySess.warm = true;
      await saveSession(memorySess);
      refillSoon();
      return ok({
        sessionId: dbSession.SessionId,
        status: 'STARTING',
        stage: 'STARTING',
        warm: true,
        expectedReadySeconds: 5,
        startedAt: dbSession.StartedAt,
        expiresAt: dbSession.ExpiresAt,
        remainingSeconds: calculateRemainingSeconds(dbSession.ExpiresAt),
        allocatedCredits: dbSession.AllocatedCredits || 60,
        allocatedDurationMinutes: dbSession.AllocatedDurationMinutes || 60,
        dotnetSubtype: dotnetSubtype || null,
        message: 'Connecting to a ready lab environment...'
      });
    }

    const { taskArn, taskPort } = await startEcsTask({
      labId,
      sessionId: dbSession.SessionId,
      sessionToken: memorySess.sessionToken,
      jupyterToken: memorySess.jupyterToken,
      vncPassword: memorySess.vncPassword,
      dotnetSubtype,
    });

    await labSessionRepository.updateSession(dbSession.SessionId, { TaskArn: taskArn });
    if (memorySess) {
      memorySess.taskArn = taskArn;
      memorySess.taskPort = taskPort;
      await saveSession(memorySess);
    }

    return ok({
      sessionId: dbSession.SessionId,
      status: 'STARTING',
      stage: 'QUEUED',
      warm: false,
      expectedReadySeconds: getExpectedReadySeconds(canonicalLabType(lab?.id || labId)),
      startedAt: dbSession.StartedAt,
      expiresAt: dbSession.ExpiresAt,
      remainingSeconds: calculateRemainingSeconds(dbSession.ExpiresAt),
      allocatedCredits: dbSession.AllocatedCredits || 60,
      allocatedDurationMinutes: dbSession.AllocatedDurationMinutes || 60,
      dotnetSubtype: dotnetSubtype || null,
      message: 'Provisioning lab container environment...'
    });
  } catch (ecsErr) {
    console.error("[sessionsStart] ECS task launch failed:", ecsErr);
    // Mark session FAILED (0 tokens were billed during STARTING)
    await labSessionRepository.updateSession(dbSession.SessionId, { Status: 'FAILED', EndedAt: new Date() });
    throw badRequest(`Lab container failed to start: ${ecsErr.message}`);
  }
};

export const sessionsGetHandler = async ({ pathParameters, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const tenantId = auth.tenantId || auth.universityId;
  const sessionId = pathParameters?.sessionId;

  let dbSession = await labSessionRepository.getSessionById(sessionId);
  if (!dbSession) {
    const memorySess = await getSession(sessionId);
    if (!memorySess) throw notFound("Session not found");
    const ownsMemorySession = await verifySessionOwnership({ UserId: memorySess.userId }, auth);
    if (!ownsMemorySession) throw forbidden("You do not own this session");
    return ok(toPublicSession(memorySess));
  }

  const isOwner = await verifySessionOwnership(dbSession, auth);
  if (!isOwner) {
    throw forbidden("You do not own this session");
  }

  const remainingSeconds = calculateRemainingSeconds(dbSession.ExpiresAt);
  let currentStatus = dbSession.Status;

  // State transition: check if 10-min warning threshold crossed
  if (remainingSeconds <= 600 && remainingSeconds > 0 && currentStatus === 'RUNNING') {
    currentStatus = 'EXPIRING_SOON';
    await labSessionRepository.updateSession(sessionId, { Status: 'EXPIRING_SOON' });
  } else if (remainingSeconds <= 0 && ['STARTING', 'RUNNING', 'EXPIRING_SOON'].includes(currentStatus)) {
    currentStatus = 'EXPIRED';
    await labSessionRepository.updateSession(sessionId, { Status: 'EXPIRED', EndedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') });
  }

  let memorySess = await getSession(sessionId);
  let startStage = null;
  if (isEcsEnabled() && dbSession.TaskArn) {
    try {
      const task = await describeTask(dbSession.TaskArn);
      if (!task || task.lastStatus === 'STOPPED') {
        currentStatus = 'STOPPED';
        await labSessionRepository.updateSession(sessionId, { Status: 'STOPPED', EndedAt: new Date() }).catch(() => {});
        await deleteSession(sessionId).catch(() => {});
      } else if (currentStatus === 'STARTING' || memorySess?.status === 'starting') {
        const net = await resolveTaskNetworking(dbSession.TaskArn, dbSession.LabId);
        startStage = net.stage || null;
        // ECS healthy is not enough: billing starts only after the workspace bootstrap is READY.
        if (net.status === 'running') {
          if (!memorySess) {
            // No runtime record to bootstrap (e.g. store lost after a restart): old behaviour.
            const promoted = await applyRuntimeReadiness(dbSession, { bootstrapState: 'READY' });
            if (promoted.changed) {
              currentStatus = 'RUNNING';
              dbSession.StartedAt = promoted.startedAt;
              dbSession.ExpiresAt = promoted.tokenExpiryAt;
            }
          } else {
            if (!memorySess.bootstrapState || memorySess.bootstrapState === 'NOT_STARTED') {
              await updateSession(sessionId, net);
              bootstrapSession({ ...memorySess, ...net }, net).catch(e => console.error(e));
              startStage = 'BOOTSTRAPPING';
            }
            const fresh = (await getSession(sessionId)) || memorySess;
            memorySess = fresh;
            const result = await applyRuntimeReadiness(dbSession, fresh, { stopTask: stopEcsTask });
            if (result.outcome === 'RUNNING') {
              currentStatus = 'RUNNING';
              startStage = 'READY';
              if (result.changed) {
                dbSession.StartedAt = result.startedAt;
                dbSession.ExpiresAt = result.tokenExpiryAt;
                fresh.startedAt = result.startedAt.toISOString();
                fresh.expiresAt = result.tokenExpiryAt.toISOString();
                fresh.status = 'running';
                await saveSession(fresh);
              }
            } else if (result.outcome === 'FAILED') {
              currentStatus = 'FAILED';
              startStage = 'FAILED';
            } else {
              startStage = startStage || 'BOOTSTRAPPING';
            }
          }
        }
      }
    } catch (ecsCheckErr) {
      console.warn(`[sessionsStatusHandler] ECS task check error:`, ecsCheckErr.message);
      const msg = (ecsCheckErr.message || "").toLowerCase();
      if (msg.includes("not found") || msg.includes("missing") || msg.includes("invalidparameter") || msg.includes("does not exist")) {
        currentStatus = 'STOPPED';
        await labSessionRepository.updateSession(sessionId, { Status: 'STOPPED', EndedAt: new Date() }).catch(() => {});
        await deleteSession(sessionId).catch(() => {});
      }
    }
  }

  if (currentStatus === 'STOPPING' && (!dbSession.TaskArn || !isEcsEnabled() || !memorySess?.publicIp)) {
    currentStatus = 'STOPPED';
    await labSessionRepository.updateSession(sessionId, { Status: 'STOPPED', EndedAt: new Date() }).catch(() => {});
    await deleteSession(sessionId).catch(() => {});
  }

  if (memorySess && !memorySess.dotnetSubtype && dbSession.Subtype) {
    memorySess.dotnetSubtype = dbSession.Subtype;
    memorySess.starterAssetKey = dbSession.Subtype === "mvc" ? "lab-assets/dotnet/mvc/latest.tar.gz" : "lab-assets/dotnet/console-snippet/latest.tar.gz";
    await saveSession(memorySess).catch(() => {});
  }

  // DB state wins for terminal states and for "not ready yet" (no billing before READY).
  const terminal = ['FAILED', 'STOPPED', 'EXPIRED', 'COMPLETED'].includes(String(currentStatus).toUpperCase());
  const effectiveStatus = (terminal
    ? currentStatus
    : (String(currentStatus).toUpperCase() === 'STARTING' && isEcsEnabled() ? 'starting' : (memorySess?.status || currentStatus || 'RUNNING'))
  ).toLowerCase();
  if (!startStage) {
    if (['running', 'expiring_soon'].includes(effectiveStatus)) startStage = 'READY';
    else if (effectiveStatus === 'starting') startStage = dbSession.TaskArn ? 'PROVISIONING' : 'QUEUED';
    else if (effectiveStatus === 'failed') startStage = 'FAILED';
  }

  return ok({
    sessionId: dbSession.SessionId,
    labId: dbSession.LabId,
    status: effectiveStatus,
    Status: currentStatus,
    stage: startStage,
    warm: Boolean(memorySess?.warm),
    expectedReadySeconds: getExpectedReadySeconds(canonicalLabType(resolveLabAlias(dbSession.LabId))),
    idleTimeoutMinutes: IDLE_TIMEOUT_MINUTES || null,
    startedAt: dbSession.StartedAt,
    expiresAt: dbSession.ExpiresAt,
    remainingSeconds,
    allocatedCredits: dbSession.AllocatedCredits,
    allocatedDurationMinutes: dbSession.AllocatedDurationMinutes,
    dotnetSubtype: memorySess?.dotnetSubtype || dbSession.Subtype || null,
    tenMinuteWarningSent: Boolean(dbSession.TenMinuteWarningSent),
    publicIp: memorySess?.publicIp || null,
    tools: memorySess?.tools || null
  });
};

export const sessionsExtendHandler = async ({ pathParameters, body, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const tenantId = auth.tenantId || auth.universityId || auth.tenant_id || null;

  const sessionId = pathParameters?.sessionId;
  const sessionBlocks = Math.max(1, Number(body?.sessionBlocks || 1));
  const idempotencyKey = body?.idempotencyKey || body?.referenceId || null;

  const dbSession = await labSessionRepository.getSessionById(sessionId);
  if (!dbSession) throw notFound("Session not found");

  const isOwner = await verifySessionOwnership(dbSession, auth);
  if (!isOwner) {
    throw forbidden("You do not own this session");
  }

  if (['COMPLETED', 'EXPIRED', 'FAILED', 'STOPPING'].includes(dbSession.Status)) {
    throw badRequest("Cannot extend a session that is already completed, expired, or stopping.");
  }

  const lab = await getLabById(dbSession.LabId);
  if (!lab) throw notFound("Lab not found");

  const creditCost = Number(lab.creditCost || lab.credits || 0);
  const baseDurationMinutes = Number(lab.durationMinutes || lab.duration || 60);

  const extensionCredits = creditCost * sessionBlocks;
  const extensionMinutes = baseDurationMinutes * sessionBlocks;

  // Idempotency check
  if (idempotencyKey) {
    const existingTxn = await creditWalletRepository.findTransactionByIdempotencyKey(idempotencyKey);
    if (existingTxn) {
      const currentRemaining = calculateRemainingSeconds(dbSession.ExpiresAt);
      return ok({
        sessionId: dbSession.SessionId,
        status: dbSession.Status,
        expiresAt: dbSession.ExpiresAt,
        remainingSeconds: currentRemaining,
        allocatedCredits: dbSession.AllocatedCredits,
        allocatedDurationMinutes: dbSession.AllocatedDurationMinutes,
        message: "Extension request already processed (idempotent response)."
      });
    }
  }

  // Transaction for credit deduction & extension update
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const wallet = await creditWalletRepository.getWalletForUpdate(auth.userId, tenantId, connection);
    if (!wallet || Number(wallet.AvailableCredits) < extensionCredits) {
      await connection.rollback();
      connection.release();
      throw forbidden(`Insufficient credits to extend session. Required: ${extensionCredits}, Available: ${wallet ? wallet.AvailableCredits : 0}`);
    }

    // Deduct extension credits
    const newBalance = Number(wallet.Balance) - extensionCredits;
    const newConsumed = Number(wallet.ConsumedCredits || 0) + extensionCredits;
    await creditWalletRepository.updateBalance(wallet.WalletId, newBalance, { consumedCredits: newConsumed }, connection);

    // Insert LAB_EXTENSION transaction
    await creditWalletRepository.insertTransaction({
      tenantId,
      userId: auth.userId,
      type: 'LAB_EXTENSION',
      source: 'STUDENT_PORTAL',
      credits: extensionCredits,
      amount: 0.00,
      currency: 'INR',
      paymentReference: sessionId,
      labId: dbSession.LabId,
      labSessionId: sessionId,
      idempotencyKey,
      status: 'SUCCESS',
      metadataJson: { sessionId, sessionBlocks, extensionCredits, extensionMinutes, previousBalance: wallet.Balance, newBalance }
    }, connection);

    // Compute new expiration timestamp
    const currentExpiresMs = new Date(dbSession.ExpiresAt).getTime();
    const nowMs = Date.now();
    // If session was close to expiry or expired, add duration to MAX(now, currentExpires)
    const baseMs = Math.max(nowMs, currentExpiresMs);
    const newExpiresAtDate = new Date(baseMs + extensionMinutes * 60 * 1000);
    const newExpiresAt = newExpiresAtDate.toISOString().slice(0, 19).replace('T', ' ');

    const updatedSession = await labSessionRepository.extendSession({
      sessionId,
      additionalCredits: extensionCredits,
      additionalMinutes: extensionMinutes,
      newExpiresAt
    }, connection);

    await connection.commit();
    connection.release();

    const remainingSeconds = calculateRemainingSeconds(newExpiresAt);
    return ok({
      sessionId,
      status: updatedSession.Status,
      expiresAt: newExpiresAt,
      remainingSeconds,
      allocatedCredits: updatedSession.AllocatedCredits,
      allocatedDurationMinutes: updatedSession.AllocatedDurationMinutes,
      message: `Session extended successfully by ${extensionMinutes} minutes!`
    });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); connection.release(); } catch (e) {}
    }
    throw err;
  }
};

export const sessionsStopHandler = async ({ pathParameters, body, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const tenantId = auth.tenantId || auth.universityId || auth.tenant_id || null;
  let sessionId = pathParameters?.sessionId || body?.sessionId;

  let dbSession = null;
  if (!sessionId || sessionId === "active" || sessionId === "current") {
    dbSession = await labSessionRepository.findActiveSessionForUser(auth.userId, tenantId);
    if (!dbSession) {
      return ok({
        sessionId: null,
        status: 'STOPPED',
        message: 'No active lab session to stop.'
      });
    }
    sessionId = dbSession.SessionId;
  } else {
    dbSession = await labSessionRepository.getSessionById(sessionId);
    if (!dbSession) {
      const activeFallback = await labSessionRepository.findActiveSessionForUser(auth.userId, tenantId);
      if (activeFallback) {
        dbSession = activeFallback;
        sessionId = dbSession.SessionId;
      } else {
        return ok({
          sessionId,
          status: 'STOPPED',
          message: 'Session already completed or not found.'
        });
      }
    }
  }

  const isOwner = await verifySessionOwnership(dbSession, auth);
  if (!isOwner) {
    throw forbidden("You do not own this session");
  }

  // 1. Finalize billing (charges partial minutes according to commercial rule)
  let billingResult = null;
  try {
    billingResult = await usageBillingService.finalizeSessionBilling(sessionId);
  } catch (billingErr) {
    console.warn(`[sessionsStopHandler] Billing finalization error for ${sessionId}:`, billingErr.message);
  }

  // 2. Submit container stop request
  try {
    await runtimeStopService.processStop(sessionId);
  } catch (stopErr) {
    console.warn(`[sessionsStopHandler] Container stop error for ${sessionId}:`, stopErr.message);
  }

  // 3. Mark session stopped in DB to guarantee status consistency
  await labSessionRepository.updateSession(sessionId, {
    Status: 'STOPPED',
    EndedAt: new Date()
  }).catch(() => {});

  clearSessionFiles(sessionId, dbSession);
  const stopUserId = dbSession?.UserId || dbSession?.userId;
  const stopLabId = dbSession?.LabId || dbSession?.labId;
  if (stopUserId && stopLabId) {
    await userWorkspaceService.clearUserWorkspace(stopUserId, stopLabId).catch(() => {});
  }
  await deleteSession(sessionId).catch(() => {});

  const totalBilledTokens = Number(billingResult?.totalTokensCharged ?? dbSession?.BilledTokens ?? 0);
  return ok({
    sessionId,
    status: 'STOPPED',
    finalizedBilling: billingResult,
    actualMinutesUsed: totalBilledTokens,
    finalCreditsConsumed: totalBilledTokens,
    creditsConsumed: totalBilledTokens,
    message: 'Lab session stopped successfully.'
  });
};

export const sessionsListByUserHandler = async ({
  pathParameters,
  queryStringParameters,
  auth,
}) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const tenantId = auth.tenantId || auth.universityId || auth.tenant_id || null;
  const rawParam = pathParameters?.userId ? decodeURIComponent(pathParameters.userId) : null;

  if (rawParam && rawParam !== "active") {
    const ownsRequest =
      String(rawParam) === String(auth.userId) ||
      rawParam === auth.email ||
      auth.role === "Super Admin";

    if (!ownsRequest) {
      throw forbidden("Cannot list another user's sessions");
    }
  }

  const activeSession = await labSessionRepository.findActiveSessionForUser(auth.userId, tenantId);
  if (activeSession) {
    // 0. Check if session is stopping or in a terminal state
    if (['STOPPING', 'STOPPED', 'COMPLETED', 'EXPIRED', 'FAILED'].includes(activeSession.Status)) {
      if (activeSession.Status === 'STOPPING') {
        await labSessionRepository.updateSession(activeSession.SessionId, {
          Status: 'STOPPED',
          EndedAt: new Date()
        }).catch(() => {});
        await deleteSession(activeSession.SessionId).catch(() => {});
      }
      return ok({ success: false, message: "No active session found" });
    }

    // 1. Check expiration
    const remainingSeconds = calculateRemainingSeconds(activeSession.ExpiresAt);
    if (remainingSeconds <= 0 && ['STARTING', 'RUNNING', 'EXPIRING_SOON'].includes(activeSession.Status)) {
      console.log(`[sessionsListByUserHandler] Session ${activeSession.SessionId} has expired. Updating to EXPIRED.`);
      await labSessionRepository.updateSession(activeSession.SessionId, {
        Status: 'EXPIRED',
        EndedAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }).catch(() => {});
      await deleteSession(activeSession.SessionId).catch(() => {});
      return ok({ success: false, message: "No active session found" });
    }

    // 2. Check actual ECS container status
    if (isEcsEnabled()) {
      let isTaskDead = false;
      if (!activeSession.TaskArn) {
        const startedMs = activeSession.StartedAt ? new Date(activeSession.StartedAt).getTime() : 0;
        const createdMs = activeSession.CreatedAt ? new Date(activeSession.CreatedAt).getTime() : 0;
        const ageMs = Date.now() - Math.max(startedMs, createdMs);
        if (ageMs > 45000 || activeSession.Status !== 'STARTING') {
          isTaskDead = true;
        }
      } else {
        try {
          const task = await describeTask(activeSession.TaskArn);
          if (!task || task.lastStatus === 'STOPPED') {
            isTaskDead = true;
          }
        } catch (ecsErr) {
          console.warn(`[sessionsListByUserHandler] Could not describe ECS task ${activeSession.TaskArn}:`, ecsErr.message);
          const msg = (ecsErr.message || "").toLowerCase();
          if (msg.includes("not found") || msg.includes("missing") || msg.includes("invalidparameter") || msg.includes("does not exist")) {
            isTaskDead = true;
          }
        }
      }

      if (isTaskDead) {
        console.log(`[sessionsListByUserHandler] Detected ECS task for session ${activeSession.SessionId} is dead/STOPPED. Syncing to STOPPED.`);
        await labSessionRepository.updateSession(activeSession.SessionId, {
          Status: 'STOPPED',
          EndedAt: new Date()
        }).catch(() => {});
        await deleteSession(activeSession.SessionId).catch(() => {});
        return ok({ success: false, message: "No active session found" });
      }
    }

    const memorySess = await getSession(activeSession.SessionId);
    return ok({
      session: {
        sessionId: activeSession.SessionId,
        labId: activeSession.LabId,
        status: activeSession.Status,
        startedAt: activeSession.StartedAt,
        expiresAt: activeSession.ExpiresAt,
        remainingSeconds,
        allocatedCredits: activeSession.AllocatedCredits,
        allocatedDurationMinutes: activeSession.AllocatedDurationMinutes,
        dotnetSubtype: memorySess?.dotnetSubtype || activeSession.Subtype || null,
        tenMinuteWarningSent: Boolean(activeSession.TenMinuteWarningSent),
        publicIp: memorySess?.publicIp || null,
        tools: memorySess?.tools || null
      }
    });
  }

  return ok({ success: false, message: "No active session found" });
};

export const sessionsSwitchSubtypeHandler = async ({ pathParameters, body, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const sessionId = pathParameters?.sessionId || body?.sessionId;
  if (!sessionId) throw badRequest("Session ID required");

  const targetSubtype = (body?.subtype || body?.dotnetSubtype || "").toLowerCase().trim();
  if (targetSubtype !== "console" && targetSubtype !== "mvc") {
    throw badRequest("Invalid subtype. Allowed values: 'console', 'mvc'");
  }

  const dbSession = await labSessionRepository.getSessionById(sessionId);
  if (!dbSession) throw notFound("Session not found");

  const isOwner = await verifySessionOwnership(dbSession, auth);
  if (!isOwner) throw forbidden("You do not own this session");

  if (['COMPLETED', 'EXPIRED', 'FAILED', 'STOPPING', 'STOPPED'].includes(dbSession.Status)) {
    throw badRequest("Cannot switch subtype of an inactive session.");
  }

  const labId = (dbSession.LabId || "").toLowerCase();
  const lab = await getLabById(dbSession.LabId);
  const labType = (lab?.runtime?.type || lab?.RuntimeType || lab?.runtimeType || canonicalLabType(labId) || "").toLowerCase();

  const isDotnet = labType === "dotnet" || labId === "dotnet-lab" || labId.includes("dotnet");
  if (!isDotnet) {
    throw badRequest("Subtype switching is only supported for .NET labs");
  }

  const result = await switchDotnetSubtypeWorkspace(dbSession, targetSubtype);
  return ok(result);
};



// Idle stop (docs/lab-startup-optimization.md §3.3). 0 = disabled.
export const IDLE_TIMEOUT_MINUTES = Number(process.env.LAB_IDLE_TIMEOUT_MINUTES || 0);

/** POST /lab-sessions/:sessionId/heartbeat. Sent by the lab page while the student is active. */
export const sessionsHeartbeatHandler = async ({ pathParameters, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const sessionId = pathParameters?.sessionId;
  const dbSession = await labSessionRepository.getSessionById(sessionId);
  if (!dbSession) throw notFound("Session not found");
  if (!(await verifySessionOwnership(dbSession, auth))) throw forbidden("You do not own this session");

  const now = new Date().toISOString();
  const memorySess = await getSession(sessionId);
  if (memorySess) {
    await updateSession(sessionId, { lastHeartbeatAt: now }).catch(() => {});
  }
  return ok({ sessionId, lastHeartbeatAt: now, idleTimeoutMinutes: IDLE_TIMEOUT_MINUTES || null });
};

const START_STAGES = new Set(["QUEUED", "PROVISIONING", "PULLING", "STARTING", "READY"]);

/**
 * POST /lab-sessions/:sessionId/start-metrics. Student-side start timing
 * ({ labType, warm, clickToReadyMs, stageDurations }). Emitted as one structured log line
 * so it can be turned into a metric/dashboard (compare with ECS task timestamps).
 */
export const sessionsStartMetricsHandler = async ({ pathParameters, body, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const sessionId = pathParameters?.sessionId;
  const dbSession = await labSessionRepository.getSessionById(sessionId);
  if (!dbSession) throw notFound("Session not found");
  if (!(await verifySessionOwnership(dbSession, auth))) throw forbidden("You do not own this session");

  const clickToReadyMs = Number(body?.clickToReadyMs);
  if (!Number.isFinite(clickToReadyMs) || clickToReadyMs < 0 || clickToReadyMs > 60 * 60 * 1000) {
    throw badRequest("clickToReadyMs must be a duration in milliseconds");
  }
  const stageDurations = {};
  for (const [stage, ms] of Object.entries(body?.stageDurations || {})) {
    const n = Number(ms);
    if (START_STAGES.has(stage) && Number.isFinite(n) && n >= 0) stageDurations[stage] = Math.round(n);
  }
  const memorySess = await getSession(sessionId);
  console.log(JSON.stringify({
    metric: "lab_start",
    labId: dbSession.LabId,
    labType: canonicalLabType(resolveLabAlias(dbSession.LabId)),
    warm: Boolean(memorySess?.warm),
    clickToReadyMs: Math.round(clickToReadyMs),
    stageDurations,
    taskArn: dbSession.TaskArn || null,
  }));
  return ok({ recorded: true });
};
