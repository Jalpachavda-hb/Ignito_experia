import pool from "../lib/mysql.js";

class StudentLabTokenTransactionRepository {
  async createTransaction({
    tenantId,
    studentId,
    labId,
    transactionType,
    tokens,
    tokenChange = null,
    balanceBefore = 0,
    balanceAfter = 0,
    walletId = null,
    referenceType = 'PURCHASE',
    referenceId = null,
    description = null,
    idempotencyKey
  }, db = pool) {
    let resolvedWalletId = walletId;
    if (!resolvedWalletId) {
      const rawLabId = String(labId).toLowerCase().trim();
      const cleanLabId = rawLabId.replace(/^lab-/, '').replace(/-lab$/, '');
      const [wRows] = await db.query(
        `SELECT Id, CASE WHEN CAST(TotalPurchasedTokens AS SIGNED) >= CAST(ConsumedTokens AS SIGNED) THEN CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED) ELSE 0 END as Balance 
         FROM student_lab_token_wallets 
         WHERE StudentId = ? AND (LOWER(LabId) = ? OR LOWER(LabId) = ? OR LOWER(REPLACE(REPLACE(LabId, 'lab-', ''), '-lab', '')) = ?)
         ORDER BY (CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED)) DESC, Id DESC LIMIT 1`,
        [String(studentId), rawLabId, cleanLabId, cleanLabId]
      );
      if (wRows.length > 0) {
        resolvedWalletId = wRows[0].Id;
        balanceAfter = balanceAfter || wRows[0].Balance;
      } else {
        const [insertW] = await db.query(
          `INSERT INTO student_lab_token_wallets (TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, RemainingTokens, Version)
           VALUES ('DEFAULT', ?, ?, ?, 0, ?, 1)`,
          [String(studentId), cleanLabId, Number(tokens) || 0, Number(tokens) || 0]
        );
        resolvedWalletId = insertW.insertId;
        balanceAfter = Number(tokens) || 0;
      }
    }

    const [result] = await db.query(
      `INSERT INTO student_lab_token_transactions
        (TenantId, StudentId, LabId, WalletId, TransactionType, Tokens, TokenChange, BalanceBefore, BalanceAfter, ReferenceType, ReferenceId, Description, IdempotencyKey)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE Id=Id`,
      [
        tenantId,
        String(studentId),
        String(labId),
        resolvedWalletId,
        transactionType,
        Number(tokens) || 0,
        tokenChange !== null ? tokenChange : (transactionType === 'PURCHASE' ? Number(tokens) : -Number(tokens)),
        Number(balanceBefore) || 0,
        Number(balanceAfter) || 0,
        referenceType || 'PURCHASE',
        referenceId ? String(referenceId) : 'REF',
        description,
        idempotencyKey
      ]
    );
    return result.insertId;
  }

  async getTransactionsForStudent(tenantId, studentId, db = pool) {
    const [rows] = await db.query(
      `SELECT Id, TenantId, StudentId, LabId, TransactionType, Tokens, ReferenceType, ReferenceId, Description, IdempotencyKey, CreatedAt
       FROM student_lab_token_transactions
       WHERE TenantId = ? AND StudentId = ?
       ORDER BY CreatedAt DESC`,
      [tenantId, String(studentId)]
    );
    return rows;
  }

  async getTransactionsForStudentLab(tenantId, studentId, labId, db = pool) {
    const [rows] = await db.query(
      `SELECT Id, TenantId, StudentId, LabId, TransactionType, Tokens, ReferenceType, ReferenceId, Description, IdempotencyKey, CreatedAt
       FROM student_lab_token_transactions
       WHERE TenantId = ? AND StudentId = ? AND LabId = ?
       ORDER BY CreatedAt DESC`,
      [tenantId, String(studentId), String(labId)]
    );
    return rows;
  }
}

export const studentLabTokenTransactionRepository = new StudentLabTokenTransactionRepository();
export default studentLabTokenTransactionRepository;
