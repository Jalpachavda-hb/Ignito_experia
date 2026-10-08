import pool from "../lib/mysql.js";

class CreditWalletRepository {
  /**
   * Retrieves tenant-isolated credit wallet.
   * MUST ALWAYS be resolved by UserId + TenantId.
   */
  async getWallet(userId, tenantId, db = pool) {
    if (!userId) {
      throw new Error("CreditWalletRepository requires UserId.");
    }
    const targetTenant = tenantId || 'DEFAULT';
    const [rows] = await db.query(
      `SELECT WalletId, TenantId, UserId, TotalPurchasedCredits, ConsumedCredits, ReservedCredits, Balance, Status, CreatedAt, UpdatedAt
       FROM credit_wallets
       WHERE UserId = ? AND (TenantId = ? OR TenantId IS NULL OR TenantId = 'DEFAULT')
       ORDER BY WalletId DESC LIMIT 1`,
      [userId, targetTenant]
    );
    if (!rows[0]) return null;
    const w = rows[0];
    const balance = Number(w.Balance || 0);
    const reserved = Number(w.ReservedCredits || 0);
    w.AvailableCredits = Math.max(0, balance - reserved);
    return w;
  }

  /**
   * Retrieves wallet with an explicit FOR UPDATE row lock for atomic transaction processing.
   */
  async getWalletForUpdate(userId, tenantId, db) {
    if (!userId) {
      throw new Error("CreditWalletRepository requires UserId.");
    }
    const targetTenant = tenantId || 'DEFAULT';
    const [rows] = await db.query(
      `SELECT WalletId, TenantId, UserId, TotalPurchasedCredits, ConsumedCredits, ReservedCredits, Balance, Status, CreatedAt, UpdatedAt
       FROM credit_wallets
       WHERE UserId = ? AND (TenantId = ? OR TenantId IS NULL OR TenantId = 'DEFAULT') FOR UPDATE`,
      [userId, targetTenant]
    );
    if (!rows[0]) return null;
    const w = rows[0];
    const balance = Number(w.Balance || 0);
    const reserved = Number(w.ReservedCredits || 0);
    w.AvailableCredits = Math.max(0, balance - reserved);
    return w;
  }

  async createWallet({ userId, tenantId, initialBalance = 0.00 }, db = pool) {
    if (!userId || !tenantId) {
      throw new Error("Wallet creation requires UserId and TenantId.");
    }
    const [result] = await db.query(
      `INSERT INTO credit_wallets (UserId, TenantId, Balance, TotalPurchasedCredits, ConsumedCredits, ReservedCredits, Status)
       VALUES (?, ?, ?, ?, 0.00, 0.00, 'ACTIVE')
       ON DUPLICATE KEY UPDATE Balance = Balance`,
      [userId, tenantId, initialBalance, initialBalance]
    );
    return result.insertId || (await this.getWallet(userId, tenantId, db)).WalletId;
  }

  async updateBalance(walletId, newBalance, options = {}, db = pool) {
    const { consumedCredits, totalPurchasedCredits } = options;
    const updates = ["Balance = ?", "UpdatedAt = CURRENT_TIMESTAMP"];
    const params = [newBalance];

    if (consumedCredits !== undefined) {
      updates.push("ConsumedCredits = ?");
      params.push(consumedCredits);
    }
    if (totalPurchasedCredits !== undefined) {
      updates.push("TotalPurchasedCredits = ?");
      params.push(totalPurchasedCredits);
    }

    params.push(walletId);
    await db.query(
      `UPDATE credit_wallets SET ${updates.join(", ")} WHERE WalletId = ?`,
      params
    );
  }

  async findTransactionByIdempotencyKey(idempotencyKey, db = pool) {
    if (!idempotencyKey) return null;
    const [rows] = await db.query(
      `SELECT TransactionId, TenantId, UserId, Type, Source, Credits, Amount, Currency, PaymentReference, LabId, LabSessionId, IdempotencyKey, Status, CreatedAt
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
    source = 'STUDENT_PORTAL',
    credits,
    amount = 0.00,
    currency = 'INR',
    paymentReference = null,
    labId = null,
    labSessionId = null,
    idempotencyKey = null,
    status = 'SUCCESS',
    metadataJson = null
  }, db = pool) {
    const [result] = await db.query(
      `INSERT INTO credit_transactions 
       (TenantId, UserId, Type, Source, Credits, Amount, Currency, PaymentReference, LabId, LabSessionId, IdempotencyKey, Status, MetadataJson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        userId,
        type,
        source,
        credits,
        amount,
        currency,
        paymentReference,
        labId,
        labSessionId,
        idempotencyKey,
        status,
        metadataJson ? JSON.stringify(metadataJson) : null
      ]
    );
    return result.insertId;
  }

  async getTransactions(userId, tenantId, limit = 50, offset = 0, userEmail = null, db = pool) {
    const sId = userId != null ? String(userId).trim() : '';
    const email = userEmail != null ? String(userEmail).trim().toLowerCase() : '';

    const query = `SELECT TransactionId, TenantId, UserId, Type, Source, Credits, Amount, Currency, PaymentReference, LabId, LabSessionId, IdempotencyKey, Status, MetadataJson, CreatedAt
       FROM credit_transactions
       WHERE (UserId = ? 
              OR (? != '' AND LOWER(CAST(UserId AS CHAR)) = ?)
              OR (? != '' AND UserId IN (SELECT UserId FROM Users WHERE LOWER(Email) = ? OR CAST(UserId AS CHAR) = ?))
              OR (? != '' AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(MetadataJson, '$.userEmail'))) = ?)
              OR (? != '' AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(MetadataJson, '$.studentEmail'))) = ?))
         AND Type NOT IN ('USAGE', 'CONSUMPTION', 'DEDUCTION', 'LAB_USAGE')
         AND (Source IS NULL OR Source NOT IN ('SESSION_USAGE', 'LAB_RUNTIME'))
       ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`;
    const params = [
      sId,
      sId, sId.toLowerCase(),
      email, email, email,
      email, email,
      email, email,
      Number(limit), Number(offset)
    ];

    const [rows] = await db.query(query, params);
    return rows;
  }
}

export const creditWalletRepository = new CreditWalletRepository();
export default creditWalletRepository;
