import crypto from "crypto";
import axios from "axios";
import { badRequest } from "./errors.js";

export function getRazorpayKeys() {
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (!keyId || !keySecret) {
    throw badRequest("Razorpay keys are not configured on the server");
  }
  return { keyId, keySecret };
}

function authHeaders() {
  const { keyId, keySecret } = getRazorpayKeys();
  return {
    keyId,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
  };
}

function signaturesMatch(expected, actual) {
  const left = Buffer.from(String(expected));
  const right = Buffer.from(String(actual || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function verifyCheckoutSignature(orderId, paymentId, signature) {
  const { keySecret } = getRazorpayKeys();
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  if (!signaturesMatch(expected, signature)) {
    throw badRequest("Invalid Razorpay payment signature. Verification failed.");
  }
}

export async function createRazorpayOrder({ amountInPaise, receipt, notes }) {
  const { keyId, headers } = authHeaders();
  try {
    const response = await axios.post(
      "https://api.razorpay.com/v1/orders",
      {
        amount: amountInPaise,
        currency: "INR",
        receipt,
        payment_capture: 1,
        notes,
      },
      { headers, timeout: 15000 }
    );
    return { keyId, order: response.data };
  } catch (error) {
    const description =
      error?.response?.data?.error?.description ||
      error.message ||
      "Razorpay order creation failed";
    throw badRequest(description);
  }
}

export async function fetchRazorpayPayment(paymentId) {
  const { headers } = authHeaders();
  try {
    const response = await axios.get(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
      { headers, timeout: 15000 }
    );
    return response.data;
  } catch (error) {
    const description =
      error?.response?.data?.error?.description ||
      "Could not confirm this payment with Razorpay";
    throw badRequest(description);
  }
}

export function assertPaymentMatches({ payment, orderId, amountInPaise }) {
  if (!payment || payment.order_id !== orderId) {
    throw badRequest("Payment does not match the Razorpay order");
  }
  const status = String(payment.status || "");
  if (status !== "captured" && status !== "authorized") {
    throw badRequest(`Payment is not complete (status: ${status || "unknown"})`);
  }
  if (Number(payment.amount) !== Number(amountInPaise)) {
    throw badRequest("Paid amount does not match the order");
  }
}
