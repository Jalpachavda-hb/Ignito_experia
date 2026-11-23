import { ok } from "../lib/apigw.js";
import { unauthorized, badRequest, forbidden } from "../lib/errors.js";
import creditWalletService from "../services/CreditWalletService.js";
import { resolveAuthTenantId } from "../lib/studentTenant.js";

export const getWalletHandler = async ({ auth }) => {
  if (!auth || !auth.userId) {
    throw unauthorized("Authentication required");
  }
  const tenantId = await resolveAuthTenantId(auth, { fallback: "DEFAULT" });

  const wallet = await creditWalletService.getWallet(auth.userId, tenantId);
  return ok({
    success: true,
    wallet: {
      walletId: wallet?.WalletId || 0,
      tenantId: wallet?.TenantId || tenantId,
      userId: wallet?.UserId || auth.userId,
      balance: Number(wallet?.Balance || 0),
      status: wallet?.Status || 'ACTIVE'
    }
  });
};

export const purchaseCreditsHandler = async ({ auth, body = {} }) => {
  if (!auth || !auth.userId) {
    throw unauthorized("Authentication required");
  }
  const tenantId = await resolveAuthTenantId(auth, { fallback: "DEFAULT" });

  // This route used to add any number of credits with no payment at all. Purchases must go
  // through the Razorpay checkout (/payments/razorpay/create-order + /verify), which prices the
  // order on the server and credits tokens only after Razorpay confirms the capture.
  void tenantId;
  void body;
  throw forbidden("Credits can only be bought through the payment checkout.");
};

export const getTransactionHistoryHandler = async ({ auth, queryStringParameters = {} }) => {
  if (!auth || !auth.userId) {
    throw unauthorized("Authentication required");
  }
  const tenantId = await resolveAuthTenantId(auth, { fallback: "DEFAULT" });

  const limit = Number(queryStringParameters.limit || 50);
  const offset = Number(queryStringParameters.offset || 0);

  const transactions = await creditWalletService.getTransactionHistory(auth.userId, tenantId, limit, offset, auth.email);
  return ok({
    success: true,
    transactions: (transactions || []).map(t => ({
      transactionId: t.TransactionId,
      tenantId: t.TenantId,
      userId: t.UserId,
      type: t.Type,
      source: t.Source,
      credits: Number(t.Credits || 0),
      amount: Number(t.Amount || 0),
      currency: t.Currency || 'INR',
      paymentReference: t.PaymentReference,
      idempotencyKey: t.IdempotencyKey,
      status: t.Status,
      createdAt: t.CreatedAt,
      labId: t.labId || t.LabId || null,
      labName: t.labName || null,
      description: t.description || null
    }))
  });
};
