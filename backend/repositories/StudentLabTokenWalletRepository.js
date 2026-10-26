import pool from "../lib/mysql.js";
import { canonicalLabKey } from "../lib/labIdentity.js";
import studentLabTokenTransactionRepository from "./StudentLabTokenTransactionRepository.js";

function labIdKeys(labId, hint = "") {
  const raw = String(labId || "").toLowerCase().trim();
  const clean = raw.replace(/^lab-/, "").replace(/-lab$/, "");
  const canonical = canonicalLabKey(labId, hint);
  return [...new Set([canonical, clean, raw].filter(Boolean))];
}

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
    const keys = await this.keysForStudent(canonicalStudentId, studentId, email, labIdKeys(labId));
    return this.findWalletRow(canonicalStudentId, studentId, email, keys, db, false);
  }

  async getWalletForUpdate(tenantId, studentId, labId, userEmail = null, db = pool) {
    if (userEmail && typeof userEmail === 'object' && userEmail.query) {
      db = userEmail;
      userEmail = null;
    }
    if (!studentId || !labId) return null;
    const { canonicalStudentId, email } = await this.resolveCanonicalStudent(studentId, userEmail, db);
    const keys = await this.keysForStudent(canonicalStudentId, studentId, email, labIdKeys(labId));
    return this.findWalletRow(canonicalStudentId, studentId, email, keys, db, true);
  }

  async keysForStudent(canonicalStudentId, studentId, email, keys) {
    const expanded = new Set(keys);
    const aliases = await studentLabTokenTransactionRepository
      .getPurchaseAliases([canonicalStudentId, studentId, email])
      .catch(() => new Map());
    for (const [alias, key] of aliases) {
      if (expanded.has(key)) expanded.add(alias);
    }
    return [...expanded];
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

  async creditWalletTokens(tenantId, studentId, labId, tokensToAdd, db = pool, labName = null) {
    const { canonicalStudentId, userId, tenantId: userTenant } = await this.resolveCanonicalStudent(studentId, null, db);
    const keys = labIdKeys(labId, labName);
    const storedLabId = keys[0] || String(labId);
    const tokens = Number(tokensToAdd) || 0;
    const effTenantId = tenantId || userTenant || 'DEFAULT';

    // A student has one balance per lab. Credit the row that already exists (university
    // allocation rows may live under another tenant key) instead of opening a parallel row,
    // otherwise summaries and billing see two disconnected balances for the same lab.
    const placeholders = keys.map(() => "?").join(", ");
    const [existingRows] = await db.query(
      `SELECT Id FROM student_lab_token_wallets
       WHERE StudentId IN (?, ?)
         AND (
           LOWER(LabId) IN (${placeholders})
           OR LOWER(REPLACE(REPLACE(LabId, 'lab-', ''), '-lab', '')) IN (${placeholders})
         )
       ORDER BY (LOWER(LabId) = ?) DESC, (TenantId = ?) DESC, Id ASC
       LIMIT 1 FOR UPDATE`,
      [canonicalStudentId, String(studentId), ...keys, ...keys, storedLabId, effTenantId]
    );

    if (existingRows.length > 0) {
      await db.query(
        `UPDATE student_lab_token_wallets
         SET TotalPurchasedTokens = TotalPurchasedTokens + ?,
             RemainingTokens = CASE WHEN (CAST(TotalPurchasedTokens AS SIGNED) + ?) >= CAST(ConsumedTokens AS SIGNED)
                                    THEN (CAST(TotalPurchasedTokens AS SIGNED) + ?) - CAST(ConsumedTokens AS SIGNED)
                                    ELSE 0 END,
             Version = Version + 1,
             UpdatedAt = CURRENT_TIMESTAMP
         WHERE Id = ?`,
        [tokens, tokens, tokens, existingRows[0].Id]
      );
    } else {
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
        [effTenantId, canonicalStudentId, storedLabId, tokens, tokens]
      );
    }

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

    return await this.getWallet(effTenantId, canonicalStudentId, storedLabId, null, db);
  }

  async findWalletRow(canonicalStudentId, studentId, email, keys, db, lock) {
    const list = (keys || []).filter(Boolean);
    if (!list.length) return null;
    const placeholders = list.map(() => "?").join(", ");
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
         AND (
           LOWER(LabId) IN (${placeholders})
           OR LOWER(REPLACE(REPLACE(LabId, 'lab-', ''), '-lab', '')) IN (${placeholders})
         )
       ORDER BY (CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED)) DESC, Id DESC
       LIMIT 1${lock ? " FOR UPDATE" : ""}`,
      [canonicalStudentId, String(studentId), email, email, ...list, ...list]
    );
    return rows[0] || null;
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
