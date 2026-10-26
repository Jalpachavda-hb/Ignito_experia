import pool from "../lib/mysql.js";
import { canonicalLabKey } from "../lib/labIdentity.js";

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

  /** Total tokens bought per lab (keyed by clean lab id) across every identity the student is known by. */
  async getPurchasedTokensByLab(studentIds, db = pool) {
    const ids = [...new Set((studentIds || []).filter(Boolean).map(String))];
    if (!ids.length) return new Map();
    const [rows] = await db.query(
      `SELECT LabId, Description, COALESCE(SUM(Tokens), 0) AS Tokens
       FROM student_lab_token_transactions
       WHERE StudentId IN (?) AND TransactionType = 'PURCHASE'
       GROUP BY LabId, Description`,
      [ids]
    );
    const totals = new Map();
    for (const row of rows) {
      const key = canonicalLabKey(row.LabId, row.Description);
      if (!key) continue;
      totals.set(key, (totals.get(key) || 0) + (Number(row.Tokens) || 0));
    }
    return totals;
  }

  /** Maps every stored purchase lab id onto the lab family used by course cards. */
  async getPurchaseAliases(studentIds, db = pool) {
    const ids = [...new Set((studentIds || []).filter(Boolean).map(String))];
    const aliasToKey = new Map();
    if (!ids.length) return aliasToKey;
    const [rows] = await db.query(
      `SELECT LabId, Description
       FROM student_lab_token_transactions
       WHERE StudentId IN (?) AND TransactionType = 'PURCHASE'`,
      [ids]
    );
    for (const row of rows) {
      const key = canonicalLabKey(row.LabId, row.Description);
      if (!key) continue;
      const raw = String(row.LabId || "").toLowerCase().trim();
      const clean = raw.replace(/^lab-/, "").replace(/-lab$/, "");
      if (raw) aliasToKey.set(raw, key);
      if (clean) aliasToKey.set(clean, key);
      aliasToKey.set(key, key);
    }
    return aliasToKey;
  }

  async getByReferenceIds(referenceIds, db = pool) {
    const ids = [...new Set((referenceIds || []).filter(Boolean).map(String))];
    if (!ids.length) return [];
    const placeholders = ids.map(() => "?").join(",");
    const [rows] = await db.query(
      `SELECT Id, StudentId, LabId, TransactionType, Tokens, Description, ReferenceType, ReferenceId, CreatedAt
       FROM student_lab_token_transactions
       WHERE ReferenceId IN (${placeholders})`,
      ids
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
