import { ok } from "../lib/apigw.js";
import { badRequest, unauthorized, notFound } from "../lib/errors.js";
import paymentService from "../services/PaymentService.js";
import paymentSettlementService from "../services/PaymentSettlementService.js";
import tokenOrderRepository from "../repositories/TokenOrderRepository.js";

export const tokenOrderCreateHandler = async ({ body, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const tenantId = auth.tenantId || auth.universityId || auth.tenant_id || "TEN000001";
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

  const result = await paymentService.verifyPayment({
    orderId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
  });

  return ok(result);
};

export const tokenOrderWebhookHandler = async ({ body, headers }) => {
  try {
    const event = body?.event;
    const payload = body?.payload;

    if (event === "payment.captured" || event === "order.paid") {
      const paymentEntity = payload?.payment?.entity;
      const orderId = paymentEntity?.notes?.orderId || paymentEntity?.order_id;
      const razorpayPaymentId = paymentEntity?.id;
      const razorpaySignature = headers?.["x-razorpay-signature"];

      if (paymentEntity && paymentEntity.order_id) {
        await paymentSettlementService.settleOrder({
          gatewayOrderId: paymentEntity.order_id,
          razorpayPaymentId,
          razorpaySignature
        });
      }
    }
    return ok({ status: "ok" });
  } catch (err) {
    console.error("[TokenOrderWebhook] Error processing webhook:", err);
    return ok({ status: "error", message: err.message });
  }
};

export const tokenOrderListHandler = async ({ queryStringParameters, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const tenantId = auth.tenantId || auth.universityId || auth.tenant_id || "TEN000001";
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
