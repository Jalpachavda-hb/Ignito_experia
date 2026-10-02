import pool from "../lib/mysql.js";
import creditWalletRepository from "../repositories/CreditWalletRepository.js";
import studentLabTokenWalletRepository from "../repositories/StudentLabTokenWalletRepository.js";
import studentLabTokenTransactionRepository from "../repositories/StudentLabTokenTransactionRepository.js";
import { badRequest, forbidden } from "../lib/errors.js";

export function displayLabName(labId, labName) {
  const given = String(labName || "").trim();
  const looksLikeId = /^[a-z0-9_-]+$/i.test(given);
  if (given && !looksLikeId && !/^virtual lab$/i.test(given)) {
    return given;
  }
  const clean = String(labId || given || "")
    .toLowerCase()
    .replace(/^lab-/, "")
    .replace(/-lab$/, "");
  if (clean.includes("python")) return "Python Programming Lab";
  if (clean.includes("java")) return "Java Development Lab";
  if (clean.includes("linux")) return "Linux Administration Lab";
  if (clean.includes("android")) return "Android Application Lab";
  if (clean.includes("dotnet") || clean.includes(".net")) return ".NET Technologies Lab";
  if (!clean) return "Virtual Lab";
  return `${clean.toUpperCase()} Lab`;
}

function normalizePurchaseLines({ credits, amount, labId, labName, items }) {
  if (Array.isArray(items) && items.length > 0) {
    return items
      .map((item) => {
        const itemLabId = String(item.labId || item.LabId || "").trim();
        const tokens = Number(item.tokens ?? item.tokenAmount ?? item.credits ?? 0);
        return {
          labId: itemLabId,
          labName: displayLabName(itemLabId, item.labName || item.LabName || item.title),
          tokens,
          amount: Number(item.amountRupees ?? item.amount ?? item.priceAmount ?? 0),
        };
      })
      .filter((item) => item.labId && item.tokens > 0);
  }

  const tokens = Number(credits || 0);
  const resolvedLabId = String(labId || "python");
  return [{
    labId: resolvedLabId,
    labName: displayLabName(resolvedLabId, labName),
    tokens,
    amount: Number(amount || 0),
  }];
}

function parseMetadata(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

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
    labName = null,
    items = null,
    currency = 'INR',
    paymentReference,
    idempotencyKey
  }) {
    if (!userId) {
      throw badRequest("UserId is required for purchase.");
    }
    const effectiveTenantId = tenantId || 'TEN000001';

    const lines = normalizePurchaseLines({ credits, amount, labId, labName, items });
    const totalTokens = lines.reduce((sum, line) => sum + line.tokens, 0);
    const totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);
    if (totalTokens <= 0) {
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
      let wallet = await creditWalletRepository.getWalletForUpdate(userId, effectiveTenantId, connection);
      if (!wallet) {
        await creditWalletRepository.createWallet({ userId, tenantId: effectiveTenantId, initialBalance: 0.00 }, connection);
        wallet = await creditWalletRepository.getWalletForUpdate(userId, effectiveTenantId, connection);
      }

      const newBalance = Number(wallet.Balance) + totalTokens;
      const newTotalPurchased = Number(wallet.TotalPurchasedCredits || 0) + totalTokens;

      await creditWalletRepository.updateBalance(
        wallet.WalletId,
        newBalance,
        { totalPurchasedCredits: newTotalPurchased },
        connection
      );

      const txnId = await creditWalletRepository.insertTransaction({
        tenantId: effectiveTenantId,
        userId,
        type: 'PURCHASE',
        source: 'STUDENT_PURCHASE',
        credits: totalTokens,
        amount: totalAmount || Number(amount || 0),
        currency,
        paymentReference,
        labId: lines.length === 1 ? lines[0].labId : null,
        idempotencyKey,
        status: 'SUCCESS',
        metadataJson: {
          previousBalance: wallet.Balance,
          newBalance,
          labId: lines.length === 1 ? lines[0].labId : null,
          items: lines,
        }
      }, connection);

      for (const line of lines) {
        await studentLabTokenWalletRepository.creditWalletTokens(
          effectiveTenantId,
          userId,
          line.labId,
          line.tokens,
          connection
        );

        const ledgerKey = idempotencyKey
          ? `purchase_${idempotencyKey}_lab_${line.labId}`
          : `purchase_tx_${txnId}_lab_${line.labId}`;
        await studentLabTokenTransactionRepository.createTransaction({
          tenantId,
          studentId: userId,
          labId: line.labId,
          transactionType: 'PURCHASE',
          tokens: line.tokens,
          referenceType: 'PURCHASE',
          referenceId: paymentReference || idempotencyKey || String(txnId),
          description: `${line.labName} (${line.tokens} Tokens)`,
          idempotencyKey: ledgerKey
        }, connection);
      }

      await connection.commit();
      connection.release();

      return {
        success: true,
        transactionId: txnId,
        newBalance,
        creditsPurchased: totalTokens
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

  expandPurchaseRows(rows, labRows) {
    const labByPayment = new Map();
    for (const labRow of labRows || []) {
      const key = String(labRow.ReferenceId || "");
      if (!key) continue;
      if (!labByPayment.has(key)) labByPayment.set(key, []);
      labByPayment.get(key).push(labRow);
    }

    return rows.flatMap((row) => {
      const meta = parseMetadata(row.MetadataJson);
      const metaItems = Array.isArray(meta.items) ? meta.items.filter((item) => item?.labId && Number(item.tokens) > 0) : [];
      if (metaItems.length > 1) {
        return metaItems.map((item) => this.toLabPurchaseRow(row, item.labId, item.labName, Number(item.tokens), Number(item.amount || 0)));
      }

      const matches = (labByPayment.get(String(row.PaymentReference || "")) || [])
        .filter((labRow) => labRow.TransactionType === "PURCHASE" || String(labRow.Description || "").startsWith("Purchased") || String(labRow.Description || "").includes("Tokens"));

      if (matches.length > 1) {
        const tokenSum = matches.reduce((sum, labRow) => sum + Number(labRow.Tokens || 0), 0) || 1;
        const rupees = Number(row.Amount || 0);
        return matches.map((labRow) => {
          const tokens = Number(labRow.Tokens || 0);
          const share = Math.round((tokens / tokenSum) * rupees * 100) / 100;
          return this.toLabPurchaseRow(row, labRow.LabId, null, tokens, share);
        });
      }

      if (matches.length === 1) {
        return [this.toLabPurchaseRow(row, matches[0].LabId, null, Number(matches[0].Tokens || row.Credits), Number(row.Amount || 0))];
      }

      if (metaItems.length === 1) {
        const item = metaItems[0];
        return [this.toLabPurchaseRow(row, item.labId, item.labName, Number(item.tokens), Number(item.amount || row.Amount || 0))];
      }

      const singleLabId = row.LabId || meta.labId || null;
      return [{
        ...row,
        labId: singleLabId,
        labName: singleLabId ? displayLabName(singleLabId) : null,
        description: singleLabId
          ? displayLabName(singleLabId)
          : (row.Type === "PURCHASE" ? "Token purchase" : "Lab session usage"),
      }];
    });
  }

  toLabPurchaseRow(row, labId, labName, tokens, amount) {
    const name = displayLabName(labId, labName);
    const suffix = labId ? `-${labId}` : "";
    return {
      ...row,
      TransactionId: `${row.TransactionId}${suffix}`,
      IdempotencyKey: `${row.IdempotencyKey || row.TransactionId}${suffix}`,
      Credits: tokens,
      Amount: amount,
      LabId: labId,
      labId,
      labName: name,
      description: name,
    };
  }

  async getTransactionHistory(userId, tenantId, limit = 50, offset = 0, userEmail = null) {
    const rows = await creditWalletRepository.getTransactions(userId, tenantId, limit, offset, userEmail);
    const refs = rows.map((row) => row.PaymentReference).filter(Boolean);
    const labRows = await studentLabTokenTransactionRepository.getByReferenceIds(refs);
    const expanded = this.expandPurchaseRows(rows, labRows);

    // Also fetch direct student_lab_token_transactions to ensure 100% visibility of all token transactions
    try {
      const sId = userId != null ? String(userId).trim() : '';
      const email = userEmail != null ? String(userEmail).trim().toLowerCase() : '';
      const [tokenTxns] = await pool.query(
        `SELECT Id, TenantId, StudentId, LabId, TransactionType, Tokens, ReferenceType, ReferenceId, Description, IdempotencyKey, CreatedAt
         FROM student_lab_token_transactions
         WHERE (StudentId = ? OR (? != '' AND LOWER(StudentId) = ?))
         ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`,
        [sId, email, email, Number(limit), Number(offset)]
      ).catch(() => [[]]);

      const seenKeys = new Set(expanded.map(r => r.PaymentReference || r.IdempotencyKey || r.TransactionId));
      for (const t of (tokenTxns || [])) {
        const key = t.ReferenceId || t.IdempotencyKey || t.Id;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const isPurchase = t.TransactionType === 'PURCHASE';
          const cleanLab = String(t.LabId || '').toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
          let labTitle = cleanLab ? `${cleanLab.toUpperCase()} Lab` : 'Virtual Lab';
          if (cleanLab.includes('dbms')) labTitle = 'DBMS & SQL Lab';
          else if (cleanLab.includes('dotnet')) labTitle = 'Web Technology Using .NET';
          else if (cleanLab.includes('linux')) labTitle = 'Linux Administration Lab';
          else if (cleanLab.includes('python')) labTitle = 'Python Programming Lab';
          else if (cleanLab.includes('java')) labTitle = 'Java Development Lab';

          expanded.push({
            TransactionId: t.Id,
            TenantId: t.TenantId,
            UserId: t.StudentId,
            Type: isPurchase ? 'PURCHASE' : 'USAGE',
            Source: isPurchase ? 'STUDENT_PURCHASE' : 'SESSION_USAGE',
            Credits: Number(t.Tokens || 0),
            Amount: Number(t.Tokens || 0),
            Currency: 'INR',
            PaymentReference: t.ReferenceId,
            LabId: t.LabId,
            labId: cleanLab,
            labName: labTitle,
            description: t.Description || labTitle,
            IdempotencyKey: t.IdempotencyKey,
            Status: 'SUCCESS',
            CreatedAt: t.CreatedAt
          });
        }
      }
    } catch (e) {
      console.warn('[CreditWalletService] token transaction merge warning:', e.message);
    }

    return expanded.sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime());
  }
}

export const creditWalletService = new CreditWalletService();
export default creditWalletService;

