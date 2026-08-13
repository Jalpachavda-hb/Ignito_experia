import pool from "../lib/mysql.js";

class CreditWalletRepository {
  /**
   * Retrieves tenant-isolated credit wallet.
   * MUST ALWAYS be resolved by UserId + TenantId.
   */
  async getWallet(userId, tenantId, db = pool) {
    if (!userId || !tenantId) {
      throw new Error("CreditWalletRepository requires both UserId and TenantId.");
    }
    const [rows] = await db.query(
      `SELECT WalletId, TenantId, UserId, Balance, Status, CreatedAt, UpdatedAt
       FROM credit_wallets
       WHERE UserId = ? AND TenantId = ?`,
      [userId, tenantId]
    );
    return rows[0] || null;
  }

  /**
   * Retrieves wallet with an explicit FOR UPDATE row lock for atomic transaction processing.
   */
  async getWalletForUpdate(userId, tenantId, db) {
    if (!userId || !tenantId) {
      throw new Error("CreditWalletRepository requires both UserId and TenantId.");
    }
    const [rows] = await db.query(
      `SELECT WalletId, TenantId, UserId, Balance, Status, CreatedAt, UpdatedAt
       FROM credit_wallets
       WHERE UserId = ? AND TenantId = ? FOR UPDATE`,
      [userId, tenantId]
    );
    return rows[0] || null;
  }

  async createWallet({ userId, tenantId, initialBalance = 0.00 }, db = pool) {
    if (!userId || !tenantId) {
      throw new Error("Wallet creation requires UserId and TenantId.");
    }
    const [result] = await db.query(
      `INSERT INTO credit_wallets (UserId, TenantId, Balance, Status)
       VALUES (?, ?, ?, 'ACTIVE')
       ON DUPLICATE KEY UPDATE Balance = Balance`,
      [userId, tenantId, initialBalance]
    );
    return result.insertId || (await this.getWallet(userId, tenantId, db)).WalletId;
  }

  async updateBalance(walletId, newBalance, db = pool) {
    await db.query(
      `UPDATE credit_wallets SET Balance = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE WalletId = ?`,
      [newBalance, walletId]
    );
  }

  async findTransactionByIdempotencyKey(idempotencyKey, db = pool) {
    if (!idempotencyKey) return null;
    const [rows] = await db.query(
      `SELECT TransactionId, TenantId, UserId, Type, Source, Credits, Amount, Currency, PaymentReference, IdempotencyKey, Status, CreatedAt
       FROM credit_transactions
       WHERE IdempotencyKey = ?`,
      [idempotencyKey]
    );
    return rows[0] || null;
  }

  async insertTransaction({
    tenantId,
    userId,
    type,
    source = 'STUDENT_PURCHASE',
    credits,
    amount = 0.00,
    currency = 'INR',
    paymentReference = null,
    idempotencyKey = null,
    status = 'SUCCESS',
    metadataJson = null
  }, db = pool) {
    const [result] = await db.query(
      `INSERT INTO credit_transactions 
       (TenantId, UserId, Type, Source, Credits, Amount, Currency, PaymentReference, IdempotencyKey, Status, MetadataJson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        userId,
        type,
        source,
        credits,
        amount,
        currency,
        paymentReference,
        idempotencyKey,
        status,
        metadataJson ? JSON.stringify(metadataJson) : null
      ]
    );
    return result.insertId;
  }

  async getTransactions(userId, tenantId, limit = 50, offset = 0, db = pool) {
    const [rows] = await db.query(
      `SELECT TransactionId, TenantId, UserId, Type, Source, Credits, Amount, Currency, PaymentReference, IdempotencyKey, Status, CreatedAt
       FROM credit_transactions
       WHERE UserId = ? AND TenantId = ?
       ORDER BY CreatedAt DESC
       LIMIT ? OFFSET ?`,
      [userId, tenantId, Number(limit), Number(offset)]
    );
    return rows;
  }
}

export const creditWalletRepository = new CreditWalletRepository();
export default creditWalletRepository;
