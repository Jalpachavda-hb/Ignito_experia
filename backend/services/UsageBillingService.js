import pool from "../lib/mysql.js";
import studentLabTokenWalletRepository from "../repositories/StudentLabTokenWalletRepository.js";
import studentLabTokenTransactionRepository from "../repositories/StudentLabTokenTransactionRepository.js";
import labTokenUsageRepository from "../repositories/LabTokenUsageRepository.js";
import notificationService from "./NotificationService.js";
import runtimeStopService from "./RuntimeStopService.js";

class UsageBillingService {
  async billSession(sessionId) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Lock Lab Session
      const [sessionRows] = await connection.query(
        `SELECT SessionId, TenantId, UserId, LabId, BilledSeconds, BilledTokens, StartedAt, LastBilledAt, Status, LowTokenWarningSent, ExpiresAt, TokenExpiryAt, AllocatedCredits, AllocatedDurationMinutes
         FROM lab_sessions
         WHERE SessionId = ? FOR UPDATE`,
        [sessionId]
      );

      const session = sessionRows[0];
      if (!session || !['RUNNING', 'EXPIRING_SOON'].includes(session.Status)) {
        await connection.rollback();
        connection.release();
        return { billed: false, reason: "Session not active for billing" };
      }

      const studentId = session.StudentId || session.UserId;

      // Check if user is Admin or has email for wallet lookup
      const [userRows] = await connection.query(
        `SELECT Role, AuthType, Email FROM Users WHERE UserId = ? OR Email = ? LIMIT 1`,
        [studentId, studentId]
      ).catch(() => [[]]);
      const userRole = String(userRows?.[0]?.Role || '').toLowerCase();
      const userEmail = userRows?.[0]?.Email || (String(studentId).includes('@') ? studentId : null);
      const isAdmin = userRole.includes('admin') || userRows?.[0]?.AuthType === 'ADMIN';

      if (isAdmin) {
        await connection.commit();
        connection.release();
        return { billed: true, chargedTokens: 0, reason: "Admin user session bypass" };
      }

      const expiresAt = session.ExpiresAt || session.TokenExpiryAt;
      let expiresMs = 0;
      if (expiresAt) {
        expiresMs = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
        if (typeof expiresAt === 'string' && !expiresAt.endsWith('Z') && !expiresAt.includes('+')) {
          const parsedUtc = new Date(expiresAt + 'Z').getTime();
          if (!isNaN(parsedUtc)) {
            expiresMs = Math.max(expiresMs, parsedUtc);
          }
        }
      }
      const isStillWithinAllocatedTime = Boolean(expiresMs > Date.now());

      // 2. Lock Lab Wallet (StudentId + TenantId + LabId)
      const wallet = await studentLabTokenWalletRepository.getWalletForUpdate(
        session.TenantId,
        studentId,
        session.LabId,
        userEmail,
        connection
      );

      // If user has no specific token wallet for this lab
      if (!wallet) {
        if (isStillWithinAllocatedTime) {
          // Lab was launched with allocated duration (demo, practical credit, or course credit) -> keep alive
          await connection.commit();
          connection.release();
          return { billed: true, chargedTokens: 0, reason: "Active session running within allocated duration without token wallet" };
        } else {
          // Duration expired and no wallet to deduct from -> stop
          await connection.query(
            `UPDATE lab_sessions SET Status = 'STOPPING', EndedAt = CURRENT_TIMESTAMP, UpdatedAt = CURRENT_TIMESTAMP WHERE SessionId = ?`,
            [sessionId]
          );
          await connection.commit();
          connection.release();

          notificationService.emitTokenExhausted({
            tenantId: session.TenantId,
            studentId,
            labId: session.LabId,
            sessionId
          });
          runtimeStopService.stopSessionContainers(sessionId).catch(e => console.error(e));
          return { billed: true, chargedTokens: 0, status: 'STOPPING' };
        }
      }

      const now = new Date();
      const startedAt = session.StartedAt ? new Date(session.StartedAt) : now;
      const actualElapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
      const billedSeconds = Number(session.BilledSeconds || 0);
      const unbilledSeconds = actualElapsedSeconds - billedSeconds;

      const tokensToCharge = Math.floor(unbilledSeconds / 60);

      // No full 60-second minute reached -> return early
      if (tokensToCharge === 0) {
        await connection.commit();
        connection.release();
        return { billed: true, chargedTokens: 0, unbilledSeconds };
      }

      const availableTokens = Number(wallet?.RemainingTokens || 0);
      const actualTokensToCharge = Math.min(tokensToCharge, availableTokens);

      if (actualTokensToCharge <= 0 && availableTokens <= 0 && !isStillWithinAllocatedTime) {
        // Zero balance and allocated duration ended - transition to STOPPING
        await connection.query(
          `UPDATE lab_sessions SET Status = 'STOPPING', EndedAt = CURRENT_TIMESTAMP, UpdatedAt = CURRENT_TIMESTAMP WHERE SessionId = ?`,
          [sessionId]
        );
        await connection.commit();
        connection.release();

        notificationService.emitTokenExhausted({
          tenantId: session.TenantId,
          studentId,
          labId: session.LabId,
          sessionId
        });
        runtimeStopService.stopSessionContainers(sessionId).catch(e => console.error(e));
        return { billed: true, chargedTokens: 0, status: 'STOPPING' };
      }

      const balanceBefore = availableTokens;
      const balanceAfter = Math.max(0, balanceBefore - actualTokensToCharge);
      const newBilledTokens = Number(session.BilledTokens || 0) + actualTokensToCharge;
      const newBilledSeconds = billedSeconds + (actualTokensToCharge * 60);
      const idempotencyKey = `session_${sessionId}:token_${newBilledTokens}`;

      // 3. Deduct from lab wallet
      if (actualTokensToCharge > 0) {
        await studentLabTokenWalletRepository.consumeWalletTokens(session.TenantId, studentId, session.LabId, actualTokensToCharge, userEmail, connection);

        // 4. Insert Immutable Ledger Entry
        await studentLabTokenTransactionRepository.createTransaction(
          {
            tenantId: session.TenantId,
            studentId,
            labId: session.LabId,
            transactionType: 'CONSUMPTION',
            tokens: actualTokensToCharge,
            referenceType: 'SESSION',
            referenceId: sessionId,
            description: `Consumed ${actualTokensToCharge} token(s) for runtime`,
            idempotencyKey
          },
          connection
        );

        // 5. Insert Telemetry Usage Record if table exists
        try {
          await labTokenUsageRepository.insertUsage(
            {
              tenantId: session.TenantId,
              studentId,
              labId: session.LabId,
              labSessionId: sessionId,
              walletId: wallet.Id,
              tokensUsed: actualTokensToCharge,
              runtimeSeconds: actualTokensToCharge * 60,
              balanceBefore,
              balanceAfter,
              billingSequence: newBilledTokens,
              idempotencyKey
            },
            connection
          );
        } catch (e) {}
      }

      // 6. Threshold Warning Check (<= 10 tokens) & Reset Flag if balance > 10
      let warningSentFlag = session.LowTokenWarningSent || session.LowBalanceWarningSent || 0;
      let lowBalanceTriggered = false;

      if (balanceAfter > 10) {
        warningSentFlag = 0;
      } else if (balanceAfter <= 10 && !warningSentFlag) {
        warningSentFlag = 1;
        lowBalanceTriggered = true;
      }

      // 7. Zero Balance Auto Stop Check: Only stop if wallet balance is 0 AND the session allocated duration has expired!
      let zeroBalanceExhausted = false;
      let nextStatus = session.Status;
      if (balanceAfter === 0 && !isStillWithinAllocatedTime) {
        zeroBalanceExhausted = true;
        nextStatus = 'STOPPING';
      }

      // 8. Update Session
      await connection.query(
        `UPDATE lab_sessions
         SET BilledTokens = ?,
             BilledSeconds = ?,
             LastBilledAt = ?,
             LowTokenWarningSent = ?,
             Status = ?,
             EndedAt = IF(? = 'STOPPING', CURRENT_TIMESTAMP, EndedAt),
             UpdatedAt = CURRENT_TIMESTAMP
         WHERE SessionId = ?`,
        [newBilledTokens, newBilledSeconds, now, warningSentFlag, nextStatus, nextStatus, sessionId]
      );

      await connection.commit();
      connection.release();

      // 9. Notifications & Events
      notificationService.emitBalanceUpdated({
        tenantId: session.TenantId,
        studentId,
        labId: session.LabId,
        remainingTokens: balanceAfter
      });

      if (lowBalanceTriggered) {
        notificationService.emitLowBalanceWarning({
          tenantId: session.TenantId,
          studentId,
          labId: session.LabId,
          remainingTokens: balanceAfter
        });
      }

      if (zeroBalanceExhausted) {
        notificationService.emitTokenExhausted({
          tenantId: session.TenantId,
          studentId,
          labId: session.LabId,
          sessionId
        });
        runtimeStopService.stopSessionContainers(sessionId).catch(e => console.error(e));
      }

      return {
        billed: true,
        chargedTokens: actualTokensToCharge,
        balanceBefore,
        balanceAfter,
        status: nextStatus
      };
    } catch (err) {
      if (connection) {
        try { await connection.rollback(); connection.release(); } catch (e) {}
      }
      throw err;
    }
  }

  async finalizeSessionBilling(sessionId) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const [sessionRows] = await connection.query(
        `SELECT SessionId, TenantId, UserId, LabId, BilledSeconds, BilledTokens, StartedAt, LastBilledAt, Status, ExpiresAt, TokenExpiryAt
         FROM lab_sessions
         WHERE SessionId = ? FOR UPDATE`,
        [sessionId]
      );

      const session = sessionRows[0];
      if (!session || ['STOPPING', 'STOPPED', 'FAILED'].includes(session.Status)) {
        await connection.rollback();
        connection.release();
        return { finalized: true, chargedTokens: 0 };
      }

      const studentId = session.StudentId || session.UserId;

      const [userRows] = await connection.query(
        `SELECT Role, AuthType, Email FROM Users WHERE UserId = ? OR Email = ? LIMIT 1`,
        [studentId, studentId]
      ).catch(() => [[]]);
      const userEmail = userRows?.[0]?.Email || (String(studentId).includes('@') ? studentId : null);

      const wallet = await studentLabTokenWalletRepository.getWalletForUpdate(
        session.TenantId,
        studentId,
        session.LabId,
        userEmail,
        connection
      );

      const now = new Date();
      const startedAt = session.StartedAt ? new Date(session.StartedAt) : now;
      const actualElapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
      const billedSeconds = Number(session.BilledSeconds || 0);
      const unbilledSeconds = actualElapsedSeconds - billedSeconds;

      const tokensToCharge = Math.floor(unbilledSeconds / 60);

      const availableTokens = Number(wallet?.RemainingTokens || 0);
      const actualTokensToCharge = wallet ? Math.min(tokensToCharge, availableTokens) : 0;

      let balanceBefore = availableTokens;
      let balanceAfter = availableTokens;

      if (wallet && actualTokensToCharge > 0) {
        balanceAfter = Math.max(0, balanceBefore - actualTokensToCharge);
        const newBilledTokens = Number(session.BilledTokens || 0) + actualTokensToCharge;
        const newBilledSeconds = billedSeconds + (actualTokensToCharge * 60);
        const idempotencyKey = `session_${sessionId}:token_${newBilledTokens}:final`;

        await studentLabTokenWalletRepository.consumeWalletTokens(session.TenantId, studentId, session.LabId, actualTokensToCharge, userEmail, connection);

        await studentLabTokenTransactionRepository.createTransaction(
          {
            tenantId: session.TenantId,
            studentId,
            labId: session.LabId,
            transactionType: 'CONSUMPTION',
            tokens: actualTokensToCharge,
            referenceType: 'SESSION',
            referenceId: sessionId,
            description: `Finalized session billing (${actualTokensToCharge} token/s)`,
            idempotencyKey
          },
          connection
        );

        await connection.query(
          `UPDATE lab_sessions
           SET BilledTokens = ?,
               BilledSeconds = ?,
               LastBilledAt = ?,
               Status = 'STOPPING',
               EndedAt = CURRENT_TIMESTAMP,
               UpdatedAt = CURRENT_TIMESTAMP
           WHERE SessionId = ?`,
          [newBilledTokens, newBilledSeconds, now, sessionId]
        );
      } else {
        await connection.query(
          `UPDATE lab_sessions
           SET Status = 'STOPPING',
               EndedAt = CURRENT_TIMESTAMP,
               UpdatedAt = CURRENT_TIMESTAMP
           WHERE SessionId = ?`,
          [sessionId]
        );
      }

      await connection.commit();
      connection.release();

      return {
        finalized: true,
        chargedTokens: actualTokensToCharge,
        balanceBefore,
        balanceAfter
      };
    } catch (err) {
      if (connection) {
        try { await connection.rollback(); connection.release(); } catch (e) {}
      }
      throw err;
    }
  }
}

export const usageBillingService = new UsageBillingService();
export default usageBillingService;
