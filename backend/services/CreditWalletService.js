import pool from "../lib/mysql.js";
import creditWalletRepository from "../repositories/CreditWalletRepository.js";
import { badRequest, forbidden } from "../lib/errors.js";

class CreditWalletService {
  async getWallet(userId, tenantId) {
    if (!userId || !tenantId) {
      throw badRequest("UserId and TenantId are required to retrieve wallet.");
    }
    let wallet = await creditWalletRepository.getWallet(userId, tenantId);
    if (!wallet) {
      // Auto-initialize zero-balance wallet for authenticated user in tenant
      await creditWalletRepository.createWallet({ userId, tenantId, initialBalance: 0.00 });
      wallet = await creditWalletRepository.getWallet(userId, tenantId);
    }
    return wallet;
  }

  async processPurchase({
    userId,
    tenantId,
    credits,
    amount,
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

    // 1. Idempotency Check
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
      // Ensure wallet exists & lock row
      let wallet = await creditWalletRepository.getWalletForUpdate(userId, tenantId, connection);
      if (!wallet) {
        await creditWalletRepository.createWallet({ userId, tenantId, initialBalance: 0.00 }, connection);
        wallet = await creditWalletRepository.getWalletForUpdate(userId, tenantId, connection);
      }

      const newBalance = Number(wallet.Balance) + Number(credits);
      await creditWalletRepository.updateBalance(wallet.WalletId, newBalance, connection);

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
        metadataJson: { previousBalance: wallet.Balance, newBalance }
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

  async deductCredits({ userId, tenantId, creditsToDeduct, labCode, sessionId }) {
    if (!userId || !tenantId) {
      throw badRequest("UserId and TenantId are required for credit deduction.");
    }
    const deductAmount = Number(creditsToDeduct || 0);
    if (deductAmount <= 0) {
      return { success: true, deducted: 0 };
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const wallet = await creditWalletRepository.getWalletForUpdate(userId, tenantId, connection);
      if (!wallet || Number(wallet.Balance) < deductAmount) {
        throw forbidden(`Insufficient credit balance. Current balance: ${wallet ? wallet.Balance : 0}, Required: ${deductAmount}`);
      }

      const newBalance = Number(wallet.Balance) - deductAmount;
      await creditWalletRepository.updateBalance(wallet.WalletId, newBalance, connection);

      await creditWalletRepository.insertTransaction({
        tenantId,
        userId,
        type: 'DEDUCTION',
        source: 'LAB_EXECUTION',
        credits: deductAmount,
        amount: 0.00,
        currency: 'INR',
        paymentReference: sessionId || null,
        status: 'SUCCESS',
        metadataJson: { labCode, sessionId, previousBalance: wallet.Balance, newBalance }
      }, connection);

      await connection.commit();
      connection.release();

      return {
        success: true,
        previousBalance: wallet.Balance,
        newBalance,
        deducted: deductAmount
      };
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  }

  async getTransactionHistory(userId, tenantId, limit = 50, offset = 0) {
    return await creditWalletRepository.getTransactions(userId, tenantId, limit, offset);
  }
}

export const creditWalletService = new CreditWalletService();
export default creditWalletService;
