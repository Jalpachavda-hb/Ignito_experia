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

  try {
    // Check student-scoped active session
    const activeSession = await labSessionRepository.findActiveSessionForUser(userId, tenantId, connection);
    if (activeSession) {
      await connection.rollback();
      connection.release();
      throw badRequest("You already have an active lab session. Please stop or complete the current session before starting another lab.");
    }

    // Lock lab-specific token wallet FOR UPDATE
    let labWallet = await studentLabTokenWalletRepository.getWalletForUpdate(tenantId, userId, labId, connection);
    let remainingTokens = Number(labWallet?.RemainingTokens || 0);

    const isAdmin = auth?.role?.includes('Super Admin') || auth?.role?.includes('Tenant Admin') || auth?.authType === 'ADMIN';

    if (!isAdmin && remainingTokens <= 0) {
      await connection.rollback();
      connection.release();
      throw forbidden(`You do not have available tokens for lab '${lab.title || labId}'. Please purchase lab tokens to start this session.`);
    }

    const sessionTokens = remainingTokens > 0 ? remainingTokens : 60; // Admin fallback duration
    const startedAtDate = new Date();
    const tokenExpiryAtDate = new Date(startedAtDate.getTime() + sessionTokens * 60 * 1000);

    // Generate Session ID & create lab_sessions DB row (Status = STARTING)
    const sessionRecord = createSessionRecord({
      userId,
      labId,
      labType: canonicalLabType(labId),
      runtimeType: lab.runtime?.type || lab.RuntimeType || lab.runtimeType || "ide",
      durationMinutes: sessionTokens,
    });
    const sessionId = sessionRecord.sessionId;

    dbSession = await labSessionRepository.createSession({
      sessionId,
      tenantId,
      userId,
      labId,
      allocatedCredits: sessionTokens,
      allocatedDurationMinutes: sessionTokens,
      startedAt: startedAtDate,
      tokenExpiryAt: tokenExpiryAtDate,
      expiresAt: tokenExpiryAtDate,
      status: 'STARTING'
    }, connection);

    const startedIso = new Date(dbSession.StartedAt).toISOString();
    const expiresIso = new Date(tokenExpiryAtDate).toISOString();

    sessionRecord.startedAt = startedIso;
    sessionRecord.expiresAt = expiresIso;
    sessionRecord.allocatedCredits = sessionTokens;
    sessionRecord.allocatedDurationMinutes = sessionTokens;
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
      message: 'Lab environment is running.'
    });
  }

  try {
    const memorySess = await getSession(dbSession.SessionId);
    const { taskArn, taskPort } = await startEcsTask({
      labId,
      sessionId: dbSession.SessionId,
      sessionToken: memorySess?.sessionToken || 'token',
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

  if (String(dbSession.UserId) !== String(auth.userId) && auth.role !== "Super Admin") {
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
  if (memorySess && isEcsEnabled() && dbSession.TaskArn) {
    if (memorySess.status === 'starting' || currentStatus === 'STARTING') {
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
    tenMinuteWarningSent: Boolean(dbSession.TenMinuteWarningSent),
    publicIp: memorySess?.publicIp || null,
    tools: memorySess?.tools || null
  });
};

export const sessionsExtendHandler = async ({ pathParameters, body, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const tenantId = auth.tenantId || auth.universityId || auth.tenant_id || "TEN000001";

  const sessionId = pathParameters?.sessionId;
  const sessionBlocks = Math.max(1, Number(body?.sessionBlocks || 1));
  const idempotencyKey = body?.idempotencyKey || body?.referenceId || null;

  const dbSession = await labSessionRepository.getSessionById(sessionId);
  if (!dbSession) throw notFound("Session not found");

  if (String(dbSession.UserId) !== String(auth.userId) && auth.role !== "Super Admin") {
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

export const sessionsStopHandler = async ({ pathParameters, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const sessionId = pathParameters?.sessionId;

  const dbSession = await labSessionRepository.getSessionById(sessionId);
  if (!dbSession) throw notFound("Session not found");

  if (String(dbSession.UserId) !== String(auth.userId) && auth.role !== "Super Admin") {
    throw forbidden("You do not own this session");
  }

  // 1. Finalize billing (charges partial minutes according to commercial rule)
  const billingResult = await usageBillingService.finalizeSessionBilling(sessionId);

  // 2. Submit container stop request
  await runtimeStopService.processStop(sessionId);

  clearSessionFiles(sessionId);
  await deleteSession(sessionId);

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
  const tenantId = auth.tenantId || auth.universityId || auth.tenant_id || "TEN000001";
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
    const memorySess = await getSession(activeSession.SessionId);
    return ok({
      session: {
        sessionId: activeSession.SessionId,
        labId: activeSession.LabId,
        status: activeSession.Status,
        startedAt: activeSession.StartedAt,
        expiresAt: activeSession.ExpiresAt,
        remainingSeconds: calculateRemainingSeconds(activeSession.ExpiresAt),
        allocatedCredits: activeSession.AllocatedCredits,
        allocatedDurationMinutes: activeSession.AllocatedDurationMinutes,
        tenMinuteWarningSent: Boolean(activeSession.TenMinuteWarningSent),
        publicIp: memorySess?.publicIp || null,
        tools: memorySess?.tools || null
      }
    });
  }

  return ok({ success: false, message: "No active session found" });
};
