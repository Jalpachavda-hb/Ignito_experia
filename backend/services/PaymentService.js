import crypto from "crypto";
import pool from "../lib/mysql.js";
import labTokenPackageRepository from "../repositories/LabTokenPackageRepository.js";
import tokenOrderRepository from "../repositories/TokenOrderRepository.js";
import paymentSettlementService from "./PaymentSettlementService.js";
import { badRequest, notFound } from "../lib/errors.js";

const getRazorpayInstance = async () => {
  try {
    const { default: Razorpay } = await import("razorpay");
    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_1DP5mmOlF5G5ag";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "6gm7L9wLL2mAAfaTZ3IJz8Wj";
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  } catch (err) {
    console.warn("[PaymentService] Razorpay package not loaded:", err.message);
    return null;
  }
};

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

    // 2. Create Razorpay order
    let razorpayOrderId = null;
    try {
      const razorpay = await getRazorpayInstance();
      if (razorpay) {
        const rzpOrder = await razorpay.orders.create({
          amount: Math.round(calculatedTotalAmount * 100), // amount in paise
          currency: "INR",
          receipt: orderNumber,
          notes: { tenantId, studentId: String(studentId), orderNumber }
        });
        razorpayOrderId = rzpOrder.id;
      } else {
        razorpayOrderId = `rzp_order_mock_${Date.now()}`;
      }
    } catch (rzpErr) {
      console.warn("[PaymentService] Razorpay order creation warning (using mock order ID):", rzpErr.message);
      razorpayOrderId = `rzp_order_mock_${Date.now()}`;
    }

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
        keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_1DP5mmOlF5G5ag",
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
