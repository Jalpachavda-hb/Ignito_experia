import pool from "../lib/mysql.js";
import labTokenPackageRepository from "../repositories/LabTokenPackageRepository.js";
import tokenOrderRepository from "../repositories/TokenOrderRepository.js";
import paymentSettlementService from "./PaymentSettlementService.js";
import { createRazorpayOrder } from "../lib/razorpayClient.js";
import { badRequest } from "../lib/errors.js";

class PaymentService {
  async createCombinedOrder({ tenantId, studentId, items }) {
    if (!tenantId || !studentId) {
      throw badRequest("TenantId and StudentId are required");
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw badRequest("Order must contain at least one token package item");
    }

    // 1. Validate packages and calculate authoritative totals
    let calculatedTotalAmount = 0;
    let calculatedTotalTokens = 0;
    const validatedOrderItems = [];

    const packageMap = new Map();
    for (const item of items) {
      const packageId = item.packageId || item.id;
      if (!packageId) throw badRequest("packageId is required for each order item");
      packageMap.set(packageId, (packageMap.get(packageId) || 0) + 1);
    }

    for (const [packageId, qty] of packageMap.entries()) {
      const pkg = await labTokenPackageRepository.getPackageById(packageId);
      if (!pkg || !pkg.IsActive) {
        throw badRequest(`Token package ID ${packageId} is invalid or inactive.`);
      }

      const unitPrice = Number(pkg.PriceAmount);
      const tokenQuantity = Number(pkg.TokenQuantity) * qty;
      const lineTotal = unitPrice * qty;

      calculatedTotalAmount += lineTotal;
      calculatedTotalTokens += tokenQuantity;

      validatedOrderItems.push({
        packageId: pkg.Id,
        labId: pkg.LabId,
        labNameSnapshot: `Lab #${pkg.LabId}`,
        tokenQuantity,
        unitPriceAmount: unitPrice,
        lineTotalAmount: lineTotal
      });
    }

    const orderNumber = `TOK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;

    const amountInPaise = Math.round(calculatedTotalAmount * 100);
    if (amountInPaise < 100) {
      throw badRequest("Minimum payment amount is ₹1");
    }

    const { keyId, order: rzpOrder } = await createRazorpayOrder({
      amountInPaise,
      receipt: orderNumber,
      notes: { tenantId: String(tenantId || ""), studentId: String(studentId), orderNumber },
    });
    const razorpayOrderId = rzpOrder.id;

    // 3. Persist order & snapshot line items in DB
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const orderId = await tokenOrderRepository.createOrder({
        tenantId,
        studentId: Number(studentId),
        orderNumber,
        totalAmount: calculatedTotalAmount,
        currency: "INR",
        razorpayOrderId,
        idempotencyKey: `order_${orderNumber}`
      }, connection);

      for (const orderItem of validatedOrderItems) {
        await tokenOrderRepository.addOrderItem({
          orderId,
          labId: orderItem.labId,
          packageId: orderItem.packageId,
          labNameSnapshot: orderItem.labNameSnapshot,
          tokenQuantity: orderItem.tokenQuantity,
          unitPriceAmount: orderItem.unitPriceAmount,
          lineTotalAmount: orderItem.lineTotalAmount
        }, connection);
      }

      await connection.commit();
      connection.release();

      return {
        orderId,
        orderNumber,
        totalTokens: calculatedTotalTokens,
        totalAmount: calculatedTotalAmount,
        currency: "INR",
        razorpayOrderId,
        gatewayOrderId: razorpayOrderId,
        keyId,
        items: validatedOrderItems
      };
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  }

  async verifyPayment({ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    return await paymentSettlementService.settleOrder({
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    });
  }
}

export const paymentService = new PaymentService();
export default paymentService;
