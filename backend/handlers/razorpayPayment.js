import pool from "../lib/mysql.js";
import { ok } from "../lib/apigw.js";
import { badRequest } from "../lib/errors.js";
import creditWalletService from "../services/CreditWalletService.js";
import {
  assertPaymentMatches,
  createRazorpayOrder,
  fetchRazorpayPayment,
  verifyCheckoutSignature,
} from "../lib/razorpayClient.js";

/**
 * POST /api/payments/razorpay/create-order
 * Creates a real Razorpay order. The secret never leaves the server.
 */
export const createRazorpayOrderHandler = async ({ auth, body = {} }) => {
  const { amountInRupees, amount, labId, labName, credits, items } = body;
  const targetAmount = Number(amountInRupees || amount);

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    throw badRequest("Valid payment amount in Rupees is required");
  }

  const amountInPaise = Math.round(targetAmount * 100);
  if (amountInPaise < 100) {
    throw badRequest("Minimum payment amount is ₹1");
  }

  const receiptId = `rcpt_${Date.now()}`;
  const notes = {
    labId: String(labId || "default").slice(0, 200),
    labName: String(labName || "Virtual Lab Top-Up").slice(0, 200),
    userId: String(auth?.userId || "student"),
    credits: String(credits || targetAmount),
    itemCount: String(Array.isArray(items) ? items.length : 0),
  };
  const { keyId, order } = await createRazorpayOrder({
    amountInPaise,
    receipt: receiptId,
    notes,
  });

  return ok({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    key: keyId,
  });
};

/**
 * POST /api/payments/razorpay/verify
 * Credits tokens only after Razorpay signature and payment status both match.
 */
export const verifyRazorpaySignatureHandler = async ({ auth, body = {} }) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    credits,
    amount,
    labId,
    labName,
    items,
    userEmail: bodyUserEmail,
    tenantId: bodyTenantId,
  } = body;

  if (!razorpay_order_id || !String(razorpay_order_id).startsWith("order_")) {
    throw badRequest("A Razorpay order id is required");
  }
  if (!razorpay_payment_id || !razorpay_signature) {
    throw badRequest("Razorpay payment id and signature are required");
  }

  verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

  const paidAmountRupees = Number(amount);
  if (!Number.isFinite(paidAmountRupees) || paidAmountRupees <= 0) {
    throw badRequest("Payment amount is required");
  }

  const payment = await fetchRazorpayPayment(razorpay_payment_id);
  assertPaymentMatches({
    payment,
    orderId: razorpay_order_id,
    amountInPaise: Math.round(paidAmountRupees * 100),
  });

  let targetUserId = auth?.userId;
  let tenantId = auth?.tenantId || auth?.universityId || bodyTenantId;
  const creditsToAdd = Number(credits || 0);

  try {
    const rawTarget = String(targetUserId || "").trim();
    const isTargetNumeric = /^\d+$/.test(rawTarget);
    const queryUserId = isTargetNumeric ? parseInt(rawTarget, 10) : -1;
    const lookupEmail = (bodyUserEmail || auth?.email || "").trim().toLowerCase();

    const [uRows] = await pool.query(
      `SELECT UserId, TenantId, Email FROM Users
       WHERE (UserId = ? AND ? > 0)
          OR (LOWER(Email) = LOWER(?) AND ? != '')
       LIMIT 1`,
      [queryUserId, queryUserId, lookupEmail, lookupEmail]
    );

    if (uRows && uRows.length > 0) {
      targetUserId = uRows[0].UserId;
      if (!tenantId) tenantId = uRows[0].TenantId;
    }
  } catch (e) {
    console.warn("User lookup warning in payment verification:", e.message);
  }

  if (!tenantId) tenantId = "TEN000001";
  if (!targetUserId || Number.isNaN(Number(targetUserId))) {
    throw badRequest("Could not match this payment to a student account");
  }

  if (creditsToAdd > 0) {
    await creditWalletService.processPurchase({
      userId: targetUserId,
      tenantId,
      credits: creditsToAdd,
      amount: paidAmountRupees,
      currency: "INR",
      paymentReference: razorpay_payment_id,
      idempotencyKey: razorpay_order_id,
      labId: labId || null,
      labName: labName || null,
      items: Array.isArray(items) ? items : null,
    });
  }

  return ok({
    verified: true,
    paymentId: razorpay_payment_id,
    orderId: razorpay_order_id,
    creditsAdded: creditsToAdd,
    status: payment.status,
    message: "Payment verified with Razorpay and wallet updated.",
  });
};
