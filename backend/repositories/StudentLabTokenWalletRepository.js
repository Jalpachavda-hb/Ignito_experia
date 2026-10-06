import pool from "../lib/mysql.js";

class StudentLabTokenWalletRepository {
  async resolveCanonicalStudent(studentId, userEmail = null, db = pool) {
    if (!studentId) return { canonicalStudentId: null, userId: null, email: null, tenantId: null };
    const sId = String(studentId).trim();
    const isNum = /^\d+$/.test(sId);
    const numId = isNum ? parseInt(sId, 10) : -1;
    const email = userEmail ? String(userEmail).toLowerCase().trim() : (sId.includes("@") ? sId.toLowerCase().trim() : null);

    try {
      const [uRows] = await db.query(
        `SELECT UserId, Email, TenantId FROM Users 
         WHERE (UserId = ? AND ? > 0) 
            OR (LOWER(Email) = LOWER(?) AND ? IS NOT NULL) 
            OR (ExternalStudentId = ? AND ? != '')
         LIMIT 1`,
        [numId, numId, email, email, sId, sId]
      );
      if (uRows && uRows.length > 0) {
        return {
          canonicalStudentId: String(uRows[0].UserId),
          userId: uRows[0].UserId,
          email: uRows[0].Email,
          tenantId: uRows[0].TenantId
        };
      }
    } catch (_) {}

    return {
      canonicalStudentId: sId,
      userId: isNum && numId > 0 ? numId : null,
      email: email || null,
      tenantId: null
    };
  }

  async getWallet(tenantId, studentId, labId, userEmail = null, db = pool) {
    if (userEmail && typeof userEmail === 'object' && userEmail.query) {
      db = userEmail;
      userEmail = null;
    }
    if (!studentId || !labId) return null;
    const { canonicalStudentId, email } = await this.resolveCanonicalStudent(studentId, userEmail, db);
    const rawLabId = String(labId).toLowerCase().trim();
    const cleanLabId = rawLabId.replace(/^lab-/, '').replace(/-lab$/, '');

    const [rows] = await db.query(
      `SELECT Id, TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, 
              CASE WHEN CAST(TotalPurchasedTokens AS SIGNED) >= CAST(ConsumedTokens AS SIGNED) 
                   THEN CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED) 
                   ELSE 0 END AS RemainingTokens, 
              Version, CreatedAt, UpdatedAt
       FROM student_lab_token_wallets
       WHERE (
         StudentId = ? 
         OR StudentId = ?
         OR (? IS NOT NULL AND LOWER(StudentId) = LOWER(?))
       )
         AND (LOWER(LabId) = ? OR LOWER(LabId) = ? OR LOWER(REPLACE(REPLACE(LabId, 'lab-', ''), '-lab', '')) = ?)
       ORDER BY (CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED)) DESC, Id DESC LIMIT 1`,
      [canonicalStudentId, String(studentId), email, email, rawLabId, cleanLabId, cleanLabId]
    );
    return rows[0] || null;
  }

  async getWalletForUpdate(tenantId, studentId, labId, userEmail = null, db = pool) {
    if (userEmail && typeof userEmail === 'object' && userEmail.query) {
      db = userEmail;
      userEmail = null;
    }
    if (!studentId || !labId) return null;
    const { canonicalStudentId, email } = await this.resolveCanonicalStudent(studentId, userEmail, db);
    const rawLabId = String(labId).toLowerCase().trim();
    const cleanLabId = rawLabId.replace(/^lab-/, '').replace(/-lab$/, '');

    const [rows] = await db.query(
      `SELECT Id, TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, 
              CASE WHEN CAST(TotalPurchasedTokens AS SIGNED) >= CAST(ConsumedTokens AS SIGNED) 
                   THEN CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED) 
                   ELSE 0 END AS RemainingTokens, 
              Version, CreatedAt, UpdatedAt
       FROM student_lab_token_wallets
       WHERE (
         StudentId = ? 
         OR StudentId = ?
         OR (? IS NOT NULL AND LOWER(StudentId) = LOWER(?))
       )
         AND (LOWER(LabId) = ? OR LOWER(LabId) = ? OR LOWER(REPLACE(REPLACE(LabId, 'lab-', ''), '-lab', '')) = ?)
       ORDER BY (CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED)) DESC, Id DESC LIMIT 1 FOR UPDATE`,
      [canonicalStudentId, String(studentId), email, email, rawLabId, cleanLabId, cleanLabId]
    );
    return rows[0] || null;
  }

  async getAllWalletsForStudent(tenantId, studentId, userEmail = null, db = pool) {
    if (userEmail && typeof userEmail === 'object' && userEmail.query) {
      db = userEmail;
      userEmail = null;
    }
    const { canonicalStudentId, email } = await this.resolveCanonicalStudent(studentId, userEmail, db);
    const [rows] = await db.query(
      `SELECT Id, TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, 
              CASE WHEN CAST(TotalPurchasedTokens AS SIGNED) >= CAST(ConsumedTokens AS SIGNED) 
                   THEN CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED) 
                   ELSE 0 END AS RemainingTokens, 
              Version, CreatedAt, UpdatedAt
       FROM student_lab_token_wallets
       WHERE StudentId = ? 
          OR StudentId = ?
          OR (? IS NOT NULL AND LOWER(StudentId) = LOWER(?))
       ORDER BY LabId ASC`,
      [canonicalStudentId, String(studentId), email, email]
    );
    return rows;
  }

  async creditWalletTokens(tenantId, studentId, labId, tokensToAdd, db = pool) {
    const { canonicalStudentId, userId, tenantId: userTenant } = await this.resolveCanonicalStudent(studentId, null, db);
    const rawLabId = String(labId).toLowerCase().trim();
    const cleanLabId = rawLabId.replace(/^lab-/, '').replace(/-lab$/, '');
    const tokens = Number(tokensToAdd) || 0;
    const effTenantId = tenantId || userTenant || 'DEFAULT';

    await db.query(
      `INSERT INTO student_lab_token_wallets (TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, RemainingTokens, Version)
       VALUES (?, ?, ?, ?, 0, ?, 1)
       ON DUPLICATE KEY UPDATE 
         TotalPurchasedTokens = TotalPurchasedTokens + VALUES(TotalPurchasedTokens), 
         RemainingTokens = CASE WHEN (CAST(TotalPurchasedTokens AS SIGNED) + CAST(VALUES(TotalPurchasedTokens) AS SIGNED)) >= CAST(ConsumedTokens AS SIGNED)
                                THEN (CAST(TotalPurchasedTokens AS SIGNED) + CAST(VALUES(TotalPurchasedTokens) AS SIGNED)) - CAST(ConsumedTokens AS SIGNED)
                                ELSE 0 END,
         Version = Version + 1, 
         UpdatedAt = CURRENT_TIMESTAMP`,
      [effTenantId, canonicalStudentId, cleanLabId, tokens, tokens]
    );

    // Also update credit_wallets to keep total balance in sync
    if (userId) {
      try {
        await db.query(
          `INSERT INTO credit_wallets (TenantId, UserId, TotalPurchasedCredits, ConsumedCredits, ReservedCredits, Balance, Status)
           VALUES (?, ?, ?, 0.00, 0.00, ?, 'ACTIVE')
           ON DUPLICATE KEY UPDATE
             TotalPurchasedCredits = TotalPurchasedCredits + VALUES(TotalPurchasedCredits),
             Balance = Balance + VALUES(Balance),
             UpdatedAt = CURRENT_TIMESTAMP`,
          [effTenantId, userId, tokens, tokens]
        );
      } catch (e) {
        console.warn("[creditWalletTokens] credit_wallets sync notice:", e.message);
      }
    }

    return await this.getWallet(effTenantId, canonicalStudentId, cleanLabId, null, db);
  }

  async consumeWalletTokens(tenantId, studentId, labId, tokensToDeduct, userEmail = null, db = pool, walletId = null) {
    if (userEmail && typeof userEmail === 'object' && userEmail.query) {
      db = userEmail;
      userEmail = null;
    }
    const { canonicalStudentId, userId, email } = await this.resolveCanonicalStudent(studentId, userEmail, db);
    const rawLabId = String(labId).toLowerCase().trim();
    const cleanLabId = rawLabId.replace(/^lab-/, '').replace(/-lab$/, '');
    const tokens = Number(tokensToDeduct) || 0;

    let targetWalletId = walletId;
    if (!targetWalletId) {
      const w = await this.getWalletForUpdate(tenantId, canonicalStudentId, cleanLabId, email, db);
      if (w) targetWalletId = w.Id;
    }

    if (targetWalletId) {
      await db.query(
        `UPDATE student_lab_token_wallets
         SET ConsumedTokens = ConsumedTokens + ?,
             RemainingTokens = CASE WHEN CAST(TotalPurchasedTokens AS SIGNED) >= (CAST(ConsumedTokens AS SIGNED) + CAST(? AS SIGNED))
                                    THEN CAST(TotalPurchasedTokens AS SIGNED) - (CAST(ConsumedTokens AS SIGNED) + CAST(? AS SIGNED))
                                    ELSE 0 END,
             Version = Version + 1,
             UpdatedAt = CURRENT_TIMESTAMP
         WHERE Id = ?`,
        [tokens, tokens, tokens, targetWalletId]
      );
    } else {
      await db.query(
        `UPDATE student_lab_token_wallets
         SET ConsumedTokens = ConsumedTokens + ?,
             RemainingTokens = CASE WHEN CAST(TotalPurchasedTokens AS SIGNED) >= (CAST(ConsumedTokens AS SIGNED) + CAST(? AS SIGNED))
                                    THEN CAST(TotalPurchasedTokens AS SIGNED) - (CAST(ConsumedTokens AS SIGNED) + CAST(? AS SIGNED))
                                    ELSE 0 END,
             Version = Version + 1,
             UpdatedAt = CURRENT_TIMESTAMP
         WHERE (StudentId = ? OR StudentId = ? OR (? IS NOT NULL AND LOWER(StudentId) = LOWER(?)))
           AND (LOWER(LabId) = ? OR LOWER(LabId) = ?)
         ORDER BY (CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED)) DESC
         LIMIT 1`,
        [tokens, tokens, tokens, canonicalStudentId, String(studentId), email, email, rawLabId, cleanLabId]
      );
    }

    // ALSO deduct from credit_wallets to keep total balance in sync
    try {
      const targetUserId = userId || (canonicalStudentId && /^\d+$/.test(canonicalStudentId) ? Number(canonicalStudentId) : null);
      if (targetUserId) {
        await db.query(
          `UPDATE credit_wallets 
           SET Balance = CASE WHEN CAST(Balance AS SIGNED) >= CAST(? AS SIGNED) THEN Balance - ? ELSE 0.00 END,
               ConsumedCredits = ConsumedCredits + ?,
               UpdatedAt = CURRENT_TIMESTAMP
           WHERE UserId = ?`,
          [tokens, tokens, tokens, targetUserId]
        );
      }
    } catch (e) {}

    return await this.getWallet(tenantId, canonicalStudentId, cleanLabId, email, db);
  }
}

export const studentLabTokenWalletRepository = new StudentLabTokenWalletRepository();
export default studentLabTokenWalletRepository;
