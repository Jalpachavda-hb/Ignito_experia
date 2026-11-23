import { ok } from "../lib/apigw.js";
import { unauthorized } from "../lib/errors.js";
import labTokenCheckoutService from "../services/LabTokenCheckoutService.js";

/**
 * POST /api/payments/razorpay/create-order
 * Body: { items: [{ labId, tokens }] }. Prices are computed on the server from the lab catalog;
 * any amount/credits the browser sends are ignored. The order is stored before checkout opens.
 */
export const createRazorpayOrderHandler = async ({ auth, body = {} }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  let items = body.items;
  // Single-lab callers that send { labId, credits } instead of items[].
  if ((!Array.isArray(items) || items.length === 0) && body.labId && body.credits) {
    items = [{ labId: body.labId, tokens: Number(body.credits) }];
  }
  const order = await labTokenCheckoutService.createOrder({ auth, items });
  return ok(order);
};

/**
 * POST /api/payments/razorpay/verify
 * Credits tokens only for the stored order that belongs to the caller, after the checkout
 * signature, Razorpay capture status and amount all match. Body fields such as credits,
 * amount, userEmail and tenantId are ignored.
 */
export const verifyRazorpaySignatureHandler = async ({ auth, body = {} }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const result = await labTokenCheckoutService.verify({
    auth,
    razorpayOrderId: body.razorpay_order_id,
    razorpayPaymentId: body.razorpay_payment_id,
    razorpaySignature: body.razorpay_signature,
  });
  return ok(result);
};
