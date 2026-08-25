import pool from "../lib/mysql.js";

class StudentLabTokenWalletRepository {
  async getWallet(tenantId, studentId, labId, db = pool) {
    if (!studentId || !labId) return null;
    const sId = String(studentId);
    const rawLabId = String(labId).toLowerCase().trim();
    const cleanLabId = rawLabId.replace(/^lab-/, '').replace(/-lab$/, '');

    const [rows] = await db.query(
      `SELECT Id, TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, 
              CASE WHEN CAST(TotalPurchasedTokens AS SIGNED) >= CAST(ConsumedTokens AS SIGNED) 
                   THEN CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED) 
                   ELSE 0 END AS RemainingTokens, 
              Version, CreatedAt, UpdatedAt
       FROM student_lab_token_wallets
       WHERE StudentId = ? 
         AND (LOWER(LabId) = ? OR LOWER(LabId) = ? OR LOWER(REPLACE(REPLACE(LabId, 'lab-', ''), '-lab', '')) = ?)
       ORDER BY (CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED)) DESC, Id DESC LIMIT 1`,
      [sId, rawLabId, cleanLabId, cleanLabId]
    );
    return rows[0] || null;
  }

  async getWalletForUpdate(tenantId, studentId, labId, db = pool) {
    if (!studentId || !labId) return null;
    const sId = String(studentId);
    const rawLabId = String(labId).toLowerCase().trim();
    const cleanLabId = rawLabId.replace(/^lab-/, '').replace(/-lab$/, '');

    const [rows] = await db.query(
      `SELECT Id, TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, 
              CASE WHEN CAST(TotalPurchasedTokens AS SIGNED) >= CAST(ConsumedTokens AS SIGNED) 
                   THEN CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED) 
                   ELSE 0 END AS RemainingTokens, 
              Version, CreatedAt, UpdatedAt
       FROM student_lab_token_wallets
       WHERE StudentId = ? 
         AND (LOWER(LabId) = ? OR LOWER(LabId) = ? OR LOWER(REPLACE(REPLACE(LabId, 'lab-', ''), '-lab', '')) = ?)
       ORDER BY (CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED)) DESC, Id DESC LIMIT 1 FOR UPDATE`,
      [sId, rawLabId, cleanLabId, cleanLabId]
    );
    return rows[0] || null;
  }

  async getAllWalletsForStudent(tenantId, studentId, db = pool) {
    const sId = String(studentId);
    const [rows] = await db.query(
      `SELECT Id, TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, 
              CASE WHEN CAST(TotalPurchasedTokens AS SIGNED) >= CAST(ConsumedTokens AS SIGNED) 
                   THEN CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED) 
                   ELSE 0 END AS RemainingTokens, 
              Version, CreatedAt, UpdatedAt
       FROM student_lab_token_wallets
       WHERE StudentId = ?
       ORDER BY LabId ASC`,
      [sId]
    );
    return rows;
  }

  async creditWalletTokens(tenantId, studentId, labId, tokensToAdd, db = pool) {
    const sId = String(studentId);
    const rawLabId = String(labId).toLowerCase().trim();
    const cleanLabId = rawLabId.replace(/^lab-/, '').replace(/-lab$/, '');
    const tokens = Number(tokensToAdd) || 0;

    await db.query(
      `INSERT INTO student_lab_token_wallets (TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, RemainingTokens, Version)
       VALUES ('DEFAULT', ?, ?, ?, 0, ?, 1)
       ON DUPLICATE KEY UPDATE 
         TotalPurchasedTokens = TotalPurchasedTokens + VALUES(TotalPurchasedTokens), 
         RemainingTokens = CASE WHEN (CAST(TotalPurchasedTokens AS SIGNED) + CAST(VALUES(TotalPurchasedTokens) AS SIGNED)) >= CAST(ConsumedTokens AS SIGNED)
                                THEN (CAST(TotalPurchasedTokens AS SIGNED) + CAST(VALUES(TotalPurchasedTokens) AS SIGNED)) - CAST(ConsumedTokens AS SIGNED)
                                ELSE 0 END,
         Version = Version + 1, 
         UpdatedAt = CURRENT_TIMESTAMP`,
      [sId, cleanLabId, tokens, tokens]
    );
    return await this.getWallet(tenantId, studentId, labId, db);
  }

  async consumeWalletTokens(tenantId, studentId, labId, tokensToDeduct, db = pool) {
    const sId = String(studentId);
    const rawLabId = String(labId).toLowerCase().trim();
    const cleanLabId = rawLabId.replace(/^lab-/, '').replace(/-lab$/, '');
    const tokens = Number(tokensToDeduct) || 0;

    await db.query(
      `UPDATE student_lab_token_wallets
       SET ConsumedTokens = ConsumedTokens + ?,
           RemainingTokens = CASE WHEN CAST(TotalPurchasedTokens AS SIGNED) >= (CAST(ConsumedTokens AS SIGNED) + CAST(? AS SIGNED))
                                  THEN CAST(TotalPurchasedTokens AS SIGNED) - (CAST(ConsumedTokens AS SIGNED) + CAST(? AS SIGNED))
                                  ELSE 0 END,
           Version = Version + 1,
           UpdatedAt = CURRENT_TIMESTAMP
       WHERE StudentId = ? 
         AND (LOWER(LabId) = ? OR LOWER(LabId) = ? OR LOWER(REPLACE(REPLACE(LabId, 'lab-', ''), '-lab', '')) = ?)`,
      [tokens, tokens, tokens, sId, rawLabId, cleanLabId, cleanLabId]
    );

    // ALSO deduct from credit_wallets to keep total balance in sync
    try {
      await db.query(
        `UPDATE credit_wallets 
         SET Balance = CASE WHEN CAST(Balance AS SIGNED) >= CAST(? AS SIGNED) THEN Balance - ? ELSE 0.00 END,
             ConsumedCredits = ConsumedCredits + ?,
             UpdatedAt = CURRENT_TIMESTAMP
         WHERE UserId = ?`,
        [tokens, tokens, tokens, sId]
      );
    } catch (e) {}

    return await this.getWallet(tenantId, studentId, labId, db);
  }
}

export const studentLabTokenWalletRepository = new StudentLabTokenWalletRepository();
export default studentLabTokenWalletRepository;
