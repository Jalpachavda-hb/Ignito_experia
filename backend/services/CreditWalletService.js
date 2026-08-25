import pool from "../lib/mysql.js";
import creditWalletRepository from "../repositories/CreditWalletRepository.js";
import studentLabTokenWalletRepository from "../repositories/StudentLabTokenWalletRepository.js";
import studentLabTokenTransactionRepository from "../repositories/StudentLabTokenTransactionRepository.js";
import { badRequest, forbidden } from "../lib/errors.js";

class CreditWalletService {
  async getWallet(userId, tenantId, db = pool) {
    if (!userId || !tenantId) {
      throw badRequest("UserId and TenantId are required to retrieve wallet.");
    }
    let wallet = await creditWalletRepository.getWallet(userId, tenantId, db);
    if (!wallet) {
      // Auto-initialize zero-balance wallet for authenticated user in tenant
      await creditWalletRepository.createWallet({ userId, tenantId, initialBalance: 0.00 }, db);
      wallet = await creditWalletRepository.getWallet(userId, tenantId, db);
    }
    return wallet;
  }

  async processPurchase({
    userId,
    tenantId,
    credits,
    amount,
    labId = null,
    currency = 'INR',
    paymentReference,
    idempotencyKey
  }) {
    if (!userId || !tenantId) {
      throw badRequest("UserId and TenantId are required for purchase.");
    }
    if (!credits || credits <= 0) {
      throw badRequest("Credits amount must be greater than zero.");
    }

    if (idempotencyKey) {
      const existingTxn = await creditWalletRepository.findTransactionByIdempotencyKey(idempotencyKey);
      if (existingTxn) {
        const wallet = await creditWalletRepository.getWallet(userId, tenantId);
        return {
          duplicate: true,
          message: "Transaction already processed",
          wallet,
          transaction: existingTxn
        };
      }
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      let wallet = await creditWalletRepository.getWalletForUpdate(userId, tenantId, connection);
      if (!wallet) {
        await creditWalletRepository.createWallet({ userId, tenantId, initialBalance: 0.00 }, connection);
        wallet = await creditWalletRepository.getWalletForUpdate(userId, tenantId, connection);
      }

      const newBalance = Number(wallet.Balance) + Number(credits);
      const newTotalPurchased = Number(wallet.TotalPurchasedCredits || 0) + Number(credits);

      await creditWalletRepository.updateBalance(
        wallet.WalletId,
        newBalance,
        { totalPurchasedCredits: newTotalPurchased },
        connection
      );

      const txnId = await creditWalletRepository.insertTransaction({
        tenantId,
        userId,
        type: 'PURCHASE',
        source: 'STUDENT_PURCHASE',
        credits: Number(credits),
        amount: Number(amount || 0),
        currency,
        paymentReference,
        idempotencyKey,
        status: 'SUCCESS',
        metadataJson: { previousBalance: wallet.Balance, newBalance, labId }
      }, connection);

      // AUTOMATICALLY Credit Lab-Specific Token Wallet during purchase
      const targetLabId = labId || 'python';
      await studentLabTokenWalletRepository.creditWalletTokens(tenantId, userId, targetLabId, Number(credits), connection);
      
      const ledgerKey = idempotencyKey ? `purchase_${idempotencyKey}_lab_${targetLabId}` : `purchase_tx_${txnId}_lab_${targetLabId}`;
      await studentLabTokenTransactionRepository.createTransaction({
        tenantId,
        studentId: userId,
        labId: targetLabId,
        transactionType: 'PURCHASE',
        tokens: Number(credits),
        referenceType: 'PURCHASE',
        referenceId: paymentReference || idempotencyKey || String(txnId),
        description: `Purchased ${credits} tokens for lab '${targetLabId}'`,
        idempotencyKey: ledgerKey
      }, connection);

      await connection.commit();
      connection.release();

      return {
        success: true,
        transactionId: txnId,
        newBalance,
        creditsPurchased: Number(credits)
      };
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  }

  async deductCredits({ userId, tenantId, creditsToDeduct, labId, sessionId, transactionType = 'LAB_USAGE', idempotencyKey = null }, externalConnection = null) {
    if (!userId || !tenantId) {
      throw badRequest("UserId and TenantId are required for credit deduction.");
    }
    const deductAmount = Number(creditsToDeduct || 0);
    if (deductAmount <= 0) {
      return { success: true, deducted: 0 };
    }

    const connection = externalConnection || await pool.getConnection();
    const isLocalTxn = !externalConnection;
    if (isLocalTxn) await connection.beginTransaction();

    try {
      let wallet = await creditWalletRepository.getWalletForUpdate(userId, tenantId, connection);
      if (!wallet) {
        await creditWalletRepository.createWallet({ userId, tenantId, initialBalance: 0.00 }, connection);
        wallet = await creditWalletRepository.getWalletForUpdate(userId, tenantId, connection);
      }

      const available = Number(wallet.AvailableCredits);
      if (available < deductAmount) {
        throw forbidden(`Insufficient credit balance. Available: ${available}, Required: ${deductAmount}`);
      }

      const newBalance = Number(wallet.Balance) - deductAmount;
      const newConsumed = Number(wallet.ConsumedCredits || 0) + deductAmount;

      await creditWalletRepository.updateBalance(
        wallet.WalletId,
        newBalance,
        { consumedCredits: newConsumed },
        connection
      );

      const txnId = await creditWalletRepository.insertTransaction({
        tenantId,
        userId,
        type: transactionType,
        source: 'STUDENT_PORTAL',
        credits: deductAmount,
        amount: 0.00,
        currency: 'INR',
        paymentReference: sessionId || null,
        labId,
        labSessionId: sessionId,
        idempotencyKey,
        status: 'SUCCESS',
        metadataJson: { labId, sessionId, previousBalance: wallet.Balance, newBalance }
      }, connection);

      if (isLocalTxn) {
        await connection.commit();
        connection.release();
      }

      return {
        success: true,
        transactionId: txnId,
        previousBalance: wallet.Balance,
        newBalance,
        deducted: deductAmount
      };
    } catch (err) {
      if (isLocalTxn) {
        await connection.rollback();
        connection.release();
      }
      throw err;
    }
  }

  async refundCredits({ userId, tenantId, creditsToRefund, labId, sessionId, reason = "Unused lab time refund", idempotencyKey = null }, externalConnection = null) {
    if (!userId || !tenantId) {
      throw badRequest("UserId and TenantId are required for credit refund.");
    }
    const refundAmount = Number(creditsToRefund || 0);
    if (refundAmount <= 0) {
      return { success: true, refunded: 0 };
    }

    const connection = externalConnection || await pool.getConnection();
    const isLocalTxn = !externalConnection;
    if (isLocalTxn) await connection.beginTransaction();

    try {
      let wallet = await creditWalletRepository.getWalletForUpdate(userId, tenantId, connection);
      if (!wallet) {
        await creditWalletRepository.createWallet({ userId, tenantId, initialBalance: 0.00 }, connection);
        wallet = await creditWalletRepository.getWalletForUpdate(userId, tenantId, connection);
      }

      const newBalance = Number(wallet.Balance) + refundAmount;
      const newConsumed = Math.max(0, Number(wallet.ConsumedCredits || 0) - refundAmount);

      await creditWalletRepository.updateBalance(
        wallet.WalletId,
        newBalance,
        { consumedCredits: newConsumed },
        connection
      );

      const txnId = await creditWalletRepository.insertTransaction({
        tenantId,
        userId,
        type: 'REFUND',
        source: 'STUDENT_PORTAL',
        credits: refundAmount,
        amount: 0.00,
        currency: 'INR',
        paymentReference: sessionId || null,
        labId,
        labSessionId: sessionId,
        idempotencyKey,
        status: 'SUCCESS',
        metadataJson: { reason, labId, sessionId, previousBalance: wallet.Balance, newBalance }
      }, connection);

      if (isLocalTxn) {
        await connection.commit();
        connection.release();
      }

      return {
        success: true,
        transactionId: txnId,
        previousBalance: wallet.Balance,
        newBalance,
        refunded: refundAmount
      };
    } catch (err) {
      if (isLocalTxn) {
        await connection.rollback();
        connection.release();
      }
      throw err;
    }
  }

  async getTransactionHistory(userId, tenantId, limit = 50, offset = 0) {
    return await creditWalletRepository.getTransactions(userId, tenantId, limit, offset);
  }
}

export const creditWalletService = new CreditWalletService();
export default creditWalletService;
