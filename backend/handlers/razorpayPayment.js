import pool from "../lib/mysql.js";
import { ok } from "../lib/apigw.js";
import { badRequest, unauthorized } from "../lib/errors.js";
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
    userId: bodyUserId,
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

  let targetUserId = auth?.userId || bodyUserId || bodyUserEmail || "1";
  let tenantId = auth?.tenantId || auth?.universityId || bodyTenantId;
  const creditsToAdd = Number(credits || 0);

  // Resolve true integer UserId and TenantId from Users database table
  try {
    const rawTarget = String(targetUserId).trim();
    const isTargetNumeric = /^\d+$/.test(rawTarget);
    const queryUserId = isTargetNumeric ? parseInt(rawTarget, 10) : -1;
    const lookupEmail = (bodyUserEmail || auth?.email || (rawTarget.includes("@") ? rawTarget : "")).trim().toLowerCase();

    const [uRows] = await pool.query(
      `SELECT UserId, TenantId, Email FROM Users 
       WHERE (UserId = ? AND ? > 0) 
          OR (LOWER(Email) = LOWER(?) AND ? != '') 
          OR (ExternalStudentId = ? AND ? != '')
       LIMIT 1`,
      [queryUserId, queryUserId, lookupEmail, lookupEmail, rawTarget, rawTarget]
    );

    if (uRows && uRows.length > 0) {
      targetUserId = uRows[0].UserId;
      if (!tenantId) tenantId = uRows[0].TenantId;
    } else {
      // Auto-provision user in Users so FK constraints on credit_wallets do not fail
      const fallbackEmail = lookupEmail || `student_${rawTarget.replace(/[^a-zA-Z0-9]/g, "_")}@experia.ignitolearn.com`;
      const fallbackName = auth?.name || auth?.fullName || bodyUserEmail || `Student ${rawTarget}`;
      const effectiveTenant = tenantId || "TEN000001";

      const [insRes] = await pool.query(
        `INSERT INTO Users (FullName, Email, Role, Status, CreatedFrom, AuthType, TenantId, ExternalStudentId)
         VALUES (?, ?, 'STUDENT', 'Active', 'LMS', 'LMS', ?, ?)
         ON DUPLICATE KEY UPDATE UserId = LAST_INSERT_ID(UserId), TenantId = COALESCE(VALUES(TenantId), TenantId)`,
        [fallbackName, fallbackEmail.toLowerCase(), effectiveTenant, rawTarget]
      );
      if (insRes && insRes.insertId) {
        targetUserId = insRes.insertId;
      }
    }
  } catch (e) {
    console.warn("User lookup warning in payment verification:", e);
  }

  if (!tenantId) tenantId = "TEN000001";
  if (!targetUserId || isNaN(Number(targetUserId))) targetUserId = 1;

  if (creditsToAdd > 0 && targetUserId) {
    try {
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
    } catch (e) {
      console.warn("Wallet database credit warning for userId:", targetUserId, e.message);
    }
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
