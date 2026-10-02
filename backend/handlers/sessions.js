import pool from "../lib/mysql.js";
import { ok } from "../lib/apigw.js";
import { badRequest, forbidden, notFound, unauthorized } from "../lib/errors.js";
import { canonicalLabType } from "../lib/labTypeMapper.js";
import { getLabById } from "../config/labs.js";
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
} from "../services/sessionRepository.js";
import {
  isEcsEnabled,
  startEcsTask,
  stopEcsTask,
  describeTask,
  resolveTaskNetworking,
} from "../services/ecsService.js";
import { clearSessionFiles } from "../services/fileRepository.js";
import { bootstrap as bootstrapSession } from "../services/workspaceBootstrapService.js";

function calculateRemainingSeconds(expiresAt) {
  if (!expiresAt) return 0;
  const expiresMs = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
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

export const sessionsStartHandler = async ({ body, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const userId = String(auth.userId);
  const tenantId = auth.tenantId || auth.universityId || auth.tenant_id || body?.tenantId || body?.tenant_id || "DIRECT";

  const labId = body?.labId;
  const idempotencyKey = body?.idempotencyKey || body?.referenceId || null;

  if (!labId) throw badRequest("labId is required");
  const lab = await getLabById(labId);
  if (!lab) throw notFound("Lab not found");

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
        await deleteSession(activeSession.SessionId).catch(() => {});
        activeSession = null;
      }
    }

    if (activeSession) {
      await connection.rollback();
      connection.release();
      throw badRequest("You already have an active lab session. Please stop or complete the current session before starting another lab.");
    }

    // Lock lab-specific token wallet FOR UPDATE
    let labWallet = await studentLabTokenWalletRepository.getWalletForUpdate(tenantId, userId, labId, auth?.email, connection);
    let remainingTokens = Number(labWallet?.RemainingTokens || 0);

    const isAdmin = auth?.role?.includes('Super Admin') || auth?.role?.includes('Tenant Admin') || auth?.authType === 'ADMIN';

    if (!isAdmin && remainingTokens <= 0) {
      const isLmsCandidate = auth?.authType === 'LMS' ||
        auth?.authType === 'LMS_AND_DIRECT' ||
        auth?.isLmsStudent ||
        Boolean(auth?.externalStudentId || auth?.studentDegreeAdmissionId || auth?.studentId) ||
        (tenantId && String(tenantId).toUpperCase() !== 'PLATFORM' && String(tenantId).toUpperCase() !== 'DIRECT') ||
        Boolean(body?.academicCtx);

      if (isLmsCandidate) {
        const rawLabId = String(labId).toLowerCase().trim();
        const cleanLabId = rawLabId.replace(/^lab-/, '').replace(/-lab$/, '');
        const practicalCredit = Number(body?.practicalCredit || body?.academicCtx?.practicalCredit || 60);

        try {
          await connection.query(
            `INSERT INTO student_lab_token_wallets (TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, RemainingTokens, Version)
             VALUES (?, ?, ?, ?, 0, ?, 1)
             ON DUPLICATE KEY UPDATE
               TotalPurchasedTokens = IF(TotalPurchasedTokens = 0, VALUES(TotalPurchasedTokens), TotalPurchasedTokens),
               RemainingTokens = IF(TotalPurchasedTokens = 0, VALUES(RemainingTokens), RemainingTokens)`,
            [tenantId || 'DEFAULT', String(userId), cleanLabId, practicalCredit, practicalCredit]
          );
          if (auth?.email && String(auth.email).toLowerCase() !== String(userId).toLowerCase()) {
            await connection.query(
              `INSERT INTO student_lab_token_wallets (TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, RemainingTokens, Version)
               VALUES (?, ?, ?, ?, 0, ?, 1)
               ON DUPLICATE KEY UPDATE
                 TotalPurchasedTokens = IF(TotalPurchasedTokens = 0, VALUES(TotalPurchasedTokens), TotalPurchasedTokens),
                 RemainingTokens = IF(TotalPurchasedTokens = 0, VALUES(RemainingTokens), RemainingTokens)`,
              [tenantId || 'DEFAULT', String(auth.email).toLowerCase(), cleanLabId, practicalCredit, practicalCredit]
            ).catch(() => {});
          }
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
      } else {
        const fallbackEmail = email || `student_${rawUserId.replace(/[^a-zA-Z0-9]/g, "_")}@experia.ignitolearn.com`;
        const fallbackName = auth?.name || auth?.fullName || `Student ${rawUserId}`;
        if (isNumeric && numericId > 0) {
          const [insRes] = await connection.query(
            `INSERT INTO Users (UserId, FullName, Email, Role, Status, CreatedFrom, AuthType, TenantId, ExternalStudentId)
             VALUES (?, ?, ?, 'STUDENT', 'Active', 'LMS', 'LMS', ?, ?)
             ON DUPLICATE KEY UPDATE UserId = LAST_INSERT_ID(UserId), TenantId = COALESCE(VALUES(TenantId), TenantId)`,
            [numericId, fallbackName, fallbackEmail, tenantId || 'TEN000001', rawUserId]
          );
          effectiveUserId = insRes.insertId || numericId;
        } else {
          const [insRes] = await connection.query(
            `INSERT INTO Users (FullName, Email, Role, Status, CreatedFrom, AuthType, TenantId, ExternalStudentId)
             VALUES (?, ?, 'STUDENT', 'Active', 'LMS', 'LMS', ?, ?)
             ON DUPLICATE KEY UPDATE UserId = LAST_INSERT_ID(UserId), TenantId = COALESCE(VALUES(TenantId), TenantId)`,
            [fallbackName, fallbackEmail, tenantId || 'TEN000001', rawUserId]
          );
          effectiveUserId = insRes.insertId;
        }
      }
    } catch (userErr) {
      console.warn("[sessionsStartHandler] User ensure warning:", userErr.message);
      effectiveUserId = numericId > 0 ? numericId : 1;
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
      LastBilledAt: now,
      UnbilledSeconds: 0
    });
    const memorySess = await getSession(dbSession.SessionId);
    if (memorySess) {
      memorySess.status = "running";
      await saveSession(memorySess);
    }
    return ok({
      sessionId: dbSession.SessionId,
      status: 'RUNNING',
      startedAt: now,
      expiresAt: dbSession.ExpiresAt,
      remainingSeconds: calculateRemainingSeconds(dbSession.ExpiresAt),
      allocatedCredits: dbSession.AllocatedCredits,
      allocatedDurationMinutes: dbSession.AllocatedDurationMinutes,
      dotnetSubtype: dotnetSubtype || dbSession.Subtype || null,
      message: 'Lab environment is running.'
    });
  }

  try {
    const memorySess = await getSession(dbSession.SessionId);
    const { taskArn, taskPort } = await startEcsTask({
      labId,
      sessionId: dbSession.SessionId,
      sessionToken: memorySess?.sessionToken || 'token',
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
    return ok(memorySess);
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

  const memorySess = await getSession(sessionId);
  if (isEcsEnabled() && dbSession.TaskArn) {
    try {
      const task = await describeTask(dbSession.TaskArn);
      if (!task || task.lastStatus === 'STOPPED') {
        currentStatus = 'STOPPED';
        await labSessionRepository.updateSession(sessionId, { Status: 'STOPPED', EndedAt: new Date() }).catch(() => {});
        await deleteSession(sessionId).catch(() => {});
      } else if (memorySess && (memorySess.status === 'starting' || currentStatus === 'STARTING')) {
        const net = await resolveTaskNetworking(dbSession.TaskArn, dbSession.LabId);
        if (net.status === 'running' || net.publicIp) {
          currentStatus = 'RUNNING';
          await labSessionRepository.updateSession(sessionId, { Status: 'RUNNING' });
          if (!memorySess.bootstrapState || memorySess.bootstrapState === 'NOT_STARTED') {
            await updateSession(sessionId, net);
            bootstrapSession(memorySess, net).catch(e => console.error(e));
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

  const effectiveStatus = (memorySess?.status || currentStatus || 'RUNNING').toLowerCase();

  return ok({
    sessionId: dbSession.SessionId,
    labId: dbSession.LabId,
    status: effectiveStatus,
    Status: currentStatus,
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

  clearSessionFiles(sessionId);
  await deleteSession(sessionId).catch(() => {});

  return ok({
    sessionId,
    status: 'STOPPED',
    finalizedBilling: billingResult,
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
