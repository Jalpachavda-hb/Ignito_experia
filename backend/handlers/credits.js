import { ok } from "../lib/apigw.js";
import { unauthorized, badRequest } from "../lib/errors.js";
import creditWalletService from "../services/CreditWalletService.js";

export const getWalletHandler = async ({ auth }) => {
  if (!auth || !auth.userId) {
    throw unauthorized("Authentication required");
  }
  const tenantId = auth.tenantId || auth.universityId;
  if (!tenantId) {
    throw badRequest("Tenant context missing from session");
  }

  const wallet = await creditWalletService.getWallet(auth.userId, tenantId);
  return ok({
    success: true,
    wallet: {
      walletId: wallet.WalletId,
      tenantId: wallet.TenantId,
      userId: wallet.UserId,
      balance: Number(wallet.Balance),
      status: wallet.Status
    }
  });
};

export const purchaseCreditsHandler = async ({ auth, body = {} }) => {
  if (!auth || !auth.userId) {
    throw unauthorized("Authentication required");
  }
  const tenantId = auth.tenantId || auth.universityId;
  if (!tenantId) {
    throw badRequest("Tenant context missing from session");
  }

  const { credits, amount, currency, paymentReference, idempotencyKey } = body;
  if (!credits || credits <= 0) {
    throw badRequest("Credits amount must be a positive number.");
  }

  const result = await creditWalletService.processPurchase({
    userId: auth.userId,
    tenantId,
    credits,
    amount,
    currency: currency || "INR",
    paymentReference: paymentReference || `PAY-${Date.now()}`,
    idempotencyKey: idempotencyKey || body.referenceId || null
  });

  return ok({
    success: true,
    ...result
  });
};

export const getTransactionHistoryHandler = async ({ auth, queryStringParameters = {} }) => {
  if (!auth || !auth.userId) {
    throw unauthorized("Authentication required");
  }
  const tenantId = auth.tenantId || auth.universityId;
  if (!tenantId) {
    throw badRequest("Tenant context missing from session");
  }

  const limit = Number(queryStringParameters.limit || 50);
  const offset = Number(queryStringParameters.offset || 0);

  const transactions = await creditWalletService.getTransactionHistory(auth.userId, tenantId, limit, offset);
  return ok({
    success: true,
    transactions: transactions.map(t => ({
      transactionId: t.TransactionId,
      tenantId: t.TenantId,
      userId: t.UserId,
      type: t.Type,
      source: t.Source,
      credits: Number(t.Credits),
      amount: Number(t.Amount),
      currency: t.Currency,
      paymentReference: t.PaymentReference,
      idempotencyKey: t.IdempotencyKey,
      status: t.Status,
      createdAt: t.CreatedAt
    }))
  });
};
