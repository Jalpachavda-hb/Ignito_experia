import crypto from "crypto";
import pool from "../lib/mysql.js";
import tokenOrderRepository from "../repositories/TokenOrderRepository.js";
import studentLabTokenWalletRepository from "../repositories/StudentLabTokenWalletRepository.js";
import studentLabTokenTransactionRepository from "../repositories/StudentLabTokenTransactionRepository.js";
import notificationService from "./NotificationService.js";
import { badRequest, notFound } from "../lib/errors.js";

class PaymentSettlementService {
  async settleOrder({ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    let connection = null;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // 1. Fetch and Lock Order
      let order = null;
      if (orderId) {
        order = await tokenOrderRepository.getOrderForUpdate(orderId, connection);
      } else if (razorpayOrderId) {
        order = await tokenOrderRepository.getOrderByRazorpayOrderId(razorpayOrderId, connection);
        if (order) {
          order = await tokenOrderRepository.getOrderForUpdate(order.Id, connection);
        }
      }

      if (!order) {
        await connection.rollback();
        connection.release();
        throw notFound("Order not found");
      }

      // Idempotency Guard: If already processed and credited, return immediately
      if (order.Status === "TOKEN_CREDITED" || order.Status === "PAID") {
        await connection.rollback();
        connection.release();
        console.log(`[PaymentSettlementService] Order ${order.Id} (${order.OrderNumber}) is already processed (${order.Status}). Skipping.`);
        return { success: true, alreadyProcessed: true, orderId: order.Id };
      }

      // 2. Validate Gateway Signature if provided
      const keySecret = process.env.RAZORPAY_KEY_SECRET || "6gm7L9wLL2mAAfaTZ3IJz8Wj";
      if (razorpaySignature && order.RazorpayOrderId && !order.RazorpayOrderId.startsWith("rzp_order_mock_")) {
        const generatedSignature = crypto
          .createHmac("sha256", keySecret)
          .update(`${order.RazorpayOrderId}|${razorpayPaymentId}`)
          .digest("hex");

        if (generatedSignature !== razorpaySignature) {
          await tokenOrderRepository.markOrderFailed(order.Id, connection);
          await connection.commit();
          connection.release();
          throw badRequest("Payment signature verification failed");
        }
      }

      const paymentIdToSave = razorpayPaymentId || `pay_mock_${Date.now()}`;

      // 3. Atomically Credit Each Lab Wallet & Write Immutable Ledger Entries
      for (const item of order.items) {
        const labId = item.LabId;
        const tokensToAdd = Number(item.TokenQuantity || 0);

        // Credit Wallet (StudentId + TenantId + LabId)
        const updatedWallet = await studentLabTokenWalletRepository.creditWalletTokens(
          order.TenantId,
          order.StudentId,
          labId,
          tokensToAdd,
          connection
        );

        // Write Immutable Idempotent Ledger Entry
        const idempotencyKey = `order_${order.Id}_lab_${labId}_item_${item.Id}`;
        await studentLabTokenTransactionRepository.createTransaction(
          {
            tenantId: order.TenantId,
            studentId: order.StudentId,
            labId,
            transactionType: "PURCHASE",
            tokens: tokensToAdd,
            referenceType: "ORDER",
            referenceId: order.OrderNumber,
            description: `Purchased ${tokensToAdd} tokens for ${item.LabNameSnapshot || 'Virtual Lab'}`,
            idempotencyKey
          },
          connection
        );

        // Real-time Notification Event
        notificationService.emitBalanceUpdated({
          tenantId: order.TenantId,
          studentId: order.StudentId,
          labId,
          remainingTokens: updatedWallet.RemainingTokens
        });

        // 4. Reset LowTokenWarningSent flag if session is currently RUNNING so student gets next warning when low
        await connection.query(
          `UPDATE lab_sessions
           SET LowTokenWarningSent = 0
           WHERE TenantId = ? AND StudentId = ? AND LabId = ? AND Status = 'RUNNING'`,
          [order.TenantId, String(order.StudentId), String(labId)]
        );
      }

      // Mark Order as TOKEN_CREDITED
      await tokenOrderRepository.markOrderCredited(order.Id, paymentIdToSave, new Date(), connection);

      await connection.commit();
      connection.release();

      console.log(`[PaymentSettlementService] Successfully settled order ${order.Id} (${order.OrderNumber}).`);
      return { success: true, alreadyProcessed: false, orderId: order.Id };

    } catch (err) {
      if (connection) {
        try {
          await connection.rollback();
          connection.release();
        } catch (e) {}
      }
      console.error("[PaymentSettlementService] Settlement error:", err);
      throw err;
    }
  }
}

export const paymentSettlementService = new PaymentSettlementService();
export default paymentSettlementService;
