import { ok } from "../lib/apigw.js";
import { badRequest, unauthorized, notFound } from "../lib/errors.js";
import paymentService from "../services/PaymentService.js";
import paymentSettlementService from "../services/PaymentSettlementService.js";
import tokenOrderRepository from "../repositories/TokenOrderRepository.js";
import { verifyWebhookSignature } from "../lib/razorpayClient.js";
import { resolveAuthTenantId } from "../lib/studentTenant.js";
import { invalidateStudentLabAccess } from "../services/StudentLabAccessService.js";

export const tokenOrderCreateHandler = async ({ body, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const tenantId = await resolveAuthTenantId(auth, { fallback: "PLATFORM" });
  const studentId = auth.userId;

  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest("Order items array is required");
  }

  const orderResult = await paymentService.createCombinedOrder({
    tenantId,
    studentId,
    items
  });

  return ok({
    success: true,
    ...orderResult
  });
};

export const tokenOrderVerifyPaymentHandler = async ({ pathParameters, body, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const orderId = pathParameters?.orderId;
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body || {};

  // Only the student who created the order can settle it (ownership is checked inside the lock).
  const result = await paymentSettlementService.settleOrder({
    orderId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    expectedStudentId: Number(auth.userId),
  });
  await invalidateStudentLabAccess(auth.userId);

  return ok(result);
};

/**
 * POST /token-orders/webhook (no user auth; authenticated by Razorpay's HMAC).
 * Settles the stored order when a payment is captured, so tokens arrive even if the student
 * closed the browser before /verify ran. Settlement re-checks the payment with Razorpay and is
 * idempotent, so a webhook and a /verify for the same order credit tokens only once.
 */
export const tokenOrderWebhookHandler = async ({ body, headers, raw }) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.error("[TokenOrderWebhook] RAZORPAY_WEBHOOK_SECRET is not set; webhook ignored.");
    return { statusCode: 503, body: { success: false, message: "Webhook is not configured" } };
  }
  if (!verifyWebhookSignature(raw?.rawBody, headers?.["x-razorpay-signature"])) {
    return { statusCode: 401, body: { success: false, message: "Invalid webhook signature" } };
  }

  const event = body?.event;
  const paymentEntity = body?.payload?.payment?.entity;
  if ((event === "payment.captured" || event === "order.paid") && paymentEntity?.order_id && paymentEntity?.id) {
    try {
      await paymentSettlementService.settleOrder({
        razorpayOrderId: paymentEntity.order_id,
        razorpayPaymentId: paymentEntity.id,
        fromVerifiedWebhook: true,
      });
    } catch (err) {
      // 404: an order this server did not create (e.g. another environment). Acknowledge it.
      if (err?.statusCode === 404) return ok({ status: "ignored" });
      console.error("[TokenOrderWebhook] settlement failed:", err.message);
      // Non-2xx makes Razorpay retry later.
      return { statusCode: 500, body: { success: false, message: "Settlement failed" } };
    }
  }
  return ok({ status: "ok" });
};

export const tokenOrderListHandler = async ({ queryStringParameters, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const tenantId = await resolveAuthTenantId(auth, { fallback: "PLATFORM" });
  const limit = Math.min(100, Math.max(1, Number(queryStringParameters?.limit || 50)));
  const offset = Math.max(0, Number(queryStringParameters?.offset || 0));

  const orders = await tokenOrderRepository.getStudentOrders(tenantId, auth.userId, limit, offset);
  return ok({ orders });
};

export const tokenOrderGetDetailsHandler = async ({ pathParameters, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const orderId = pathParameters?.orderId;

  const order = await tokenOrderRepository.getOrderById(orderId);
  if (!order) throw notFound("Order not found");

  if (String(order.StudentId) !== String(auth.userId) && auth.role !== "Super Admin" && auth.role !== "OWNER") {
    throw unauthorized("Access denied to order details");
  }

  return ok({ order });
};
