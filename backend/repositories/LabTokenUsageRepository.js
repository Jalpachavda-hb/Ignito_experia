import pool from "../lib/mysql.js";

class LabTokenUsageRepository {
  async findByIdempotencyKey(idempotencyKey, db = pool) {
    if (!idempotencyKey) return null;
    const [rows] = await db.query(
      `SELECT Id, TenantId, StudentId, LabId, LabSessionId, WalletId, TokensUsed, RuntimeSeconds, BalanceBefore, BalanceAfter, BillingSequence, IdempotencyKey, CreatedAt
       FROM lab_token_usage
       WHERE IdempotencyKey = ?`,
      [idempotencyKey]
    );
    return rows[0] || null;
  }

  async insertUsage({
    tenantId,
    studentId,
    labId,
    labSessionId,
    walletId,
    tokensUsed,
    runtimeSeconds,
    balanceBefore,
    balanceAfter,
    billingSequence,
    idempotencyKey
  }, db = pool) {
    const [result] = await db.query(
      `INSERT INTO lab_token_usage
       (TenantId, StudentId, LabId, LabSessionId, WalletId, TokensUsed, RuntimeSeconds, BalanceBefore, BalanceAfter, BillingSequence, IdempotencyKey)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        String(studentId),
        labId,
        labSessionId,
        walletId,
        Number(tokensUsed),
        Number(runtimeSeconds),
        Number(balanceBefore),
        Number(balanceAfter),
        Number(billingSequence),
        idempotencyKey
      ]
    );
    return result.insertId;
  }

  async getStudentLabUsage(tenantId, studentId, labId = null, limit = 50, offset = 0, db = pool) {
    let sql = `SELECT Id, TenantId, StudentId, LabId, LabSessionId, WalletId, TokensUsed, RuntimeSeconds, BalanceBefore, BalanceAfter, BillingSequence, IdempotencyKey, CreatedAt
               FROM lab_token_usage
               WHERE TenantId = ? AND StudentId = ?`;
    const params = [tenantId, String(studentId)];

    if (labId) {
      sql += ` AND LabId = ?`;
      params.push(labId);
    }

    sql += ` ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await db.query(sql, params);
    return rows;
  }
}

export const labTokenUsageRepository = new LabTokenUsageRepository();
export default labTokenUsageRepository;
