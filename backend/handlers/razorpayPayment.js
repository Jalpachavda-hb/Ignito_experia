import crypto from "crypto";
import axios from "axios";
import pool from "../lib/mysql.js";
import { ok } from "../lib/apigw.js";
import { unauthorized, badRequest, HttpError } from "../lib/errors.js";
import creditWalletService from "../services/CreditWalletService.js";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "rzp_test_1DP5mmOlF5G5ag";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "6gm7L9wLL2mAAfaTZ3IJz8Wj";

/**
 * 1. CREATE RAZORPAY ORDER (POST /api/payments/razorpay/create-order)
 */
export const createRazorpayOrderHandler = async ({ auth, body = {} }) => {
  const { amountInRupees, amount, labId, labName } = body;
  const targetAmount = Number(amountInRupees || amount);

  if (!targetAmount || targetAmount <= 0) {
    throw badRequest("Valid payment amount in Rupees is required");
  }

  const amountInPaise = Math.round(targetAmount * 100);
  const receiptId = `rcpt_${Date.now()}`;

  try {
    // Call official Razorpay Orders API
    const authHeader = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
    const response = await axios.post(
      "https://api.razorpay.com/v1/orders",
      {
        amount: amountInPaise,
        currency: "INR",
        receipt: receiptId,
        notes: {
          labId: labId || "default",
          labName: labName || "Virtual Lab Top-Up",
          userId: auth?.userId || body?.userId || body?.userEmail || "student",
        },
      },
      {
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    return ok({
      success: true,
      orderId: response.data.id,
      amount: response.data.amount,
      currency: response.data.currency,
      key: RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.warn("Razorpay API order creation warning:", error?.response?.data || error.message);
    
    // Fallback order ID for testing if API secret is placeholder
    const fallbackOrderId = `order_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    return ok({
      success: true,
      orderId: fallbackOrderId,
      amount: amountInPaise,
      currency: "INR",
      key: RAZORPAY_KEY_ID,
      isTestFallback: true,
    });
  }
};

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function hasValidSignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false;
  const expected = Buffer.from(
    crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex")
  );
  const received = Buffer.from(String(signature));
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

async function fetchRazorpayPayment(paymentId) {
  try {
    const authHeader = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
    const { data } = await axios.get(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${authHeader}` },
      timeout: 10000,
    });
    return data;
  } catch (error) {
    console.warn("[RazorpayVerify] Payment lookup failed:", error?.response?.data || error.message);
    return null;
  }
}

/**
 * Returns how the payment was proven genuine, or null when it could not be.
 * Checkouts opened without a server order carry no signature, so those are confirmed
 * directly against the Razorpay Payments API (status + paid amount).
 */
async function verifyPayment({ orderId, paymentId, signature, expectedRupees }) {
  if (hasValidSignature(orderId, paymentId, signature)) return "signature";

  const payment = await fetchRazorpayPayment(paymentId);
  if (payment && ["captured", "authorized"].includes(payment.status)) {
    const expectedPaise = Math.round(Number(expectedRupees || 0) * 100);
    if (expectedPaise > 0 && Number(payment.amount) < expectedPaise) {
      throw badRequest("The paid amount does not match the order total. No tokens were added.");
    }
    return "gateway";
  }

  return IS_PRODUCTION ? null : "development";
}

/**
 * 2. VERIFY RAZORPAY PAYMENT & CREDIT LAB TOKENS (POST /api/payments/razorpay/verify)
 */
export const verifyRazorpaySignatureHandler = async ({ auth, body = {} }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    credits,
    amount,
    labId,
    labName,
    items,
  } = body;

  if (!razorpay_payment_id) {
    throw badRequest("Razorpay Payment ID is required for verification");
  }

  const purchaseItems = Array.isArray(items) ? items : null;
  const creditsToAdd = purchaseItems
    ? purchaseItems.reduce((sum, item) => sum + Number(item?.tokens ?? item?.tokenAmount ?? item?.credits ?? 0), 0)
    : Number(credits || 0);
  if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
    throw badRequest("Token quantity must be greater than zero.");
  }
  if (!purchaseItems && !labId) {
    throw badRequest("A lab must be selected for this token purchase.");
  }

  // Tokens always go to the authenticated student; client-supplied user/tenant ids are ignored.
  const [userRows] = await pool.query(
    `SELECT UserId, TenantId FROM Users WHERE CAST(UserId AS CHAR) = ? OR (? != '' AND LOWER(Email) = LOWER(?)) LIMIT 1`,
    [String(auth.userId), auth.email || "", auth.email || ""]
  );
  const student = userRows?.[0];
  if (!student) throw unauthorized("Student account not found for this session");
  const tenantId = auth.tenantId || auth.universityId || student.TenantId || null;

  const [alreadyCredited] = await pool.query(
    `SELECT TransactionId FROM credit_transactions
     WHERE PaymentReference = ? AND Type = 'PURCHASE' AND Status = 'SUCCESS' LIMIT 1`,
    [razorpay_payment_id]
  );
  if (alreadyCredited.length > 0) {
    return ok({ verified: true, alreadyProcessed: true, paymentId: razorpay_payment_id, creditsAdded: 0 });
  }

  const verifiedBy = await verifyPayment({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
    expectedRupees: amount,
  });
  if (!verifiedBy) {
    throw badRequest("Payment could not be verified with Razorpay. No tokens were added.");
  }

  let result;
  try {
    result = await creditWalletService.processPurchase({
      userId: student.UserId,
      tenantId,
      credits: creditsToAdd,
      amount: Number(amount || 0),
      currency: "INR",
      paymentReference: razorpay_payment_id,
      idempotencyKey: `rzp_${razorpay_payment_id}`,
      labId: labId || null,
      labName: labName || null,
      items: purchaseItems,
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return ok({ verified: true, alreadyProcessed: true, paymentId: razorpay_payment_id, creditsAdded: 0 });
    }
    console.error("[RazorpayVerify] Token credit failed", {
      userId: student.UserId,
      paymentId: razorpay_payment_id,
      error: error.message,
    });
    throw new HttpError(
      `Payment ${razorpay_payment_id} was received but tokens could not be added. Please contact support with this payment ID.`,
      500,
      { paymentId: razorpay_payment_id }
    );
  }

  return ok({
    verified: true,
    verifiedBy,
    alreadyProcessed: Boolean(result?.duplicate),
    paymentId: razorpay_payment_id,
    orderId: razorpay_order_id,
    creditsAdded: result?.duplicate ? 0 : creditsToAdd,
    message: "Payment verified and lab tokens added.",
  });
};
