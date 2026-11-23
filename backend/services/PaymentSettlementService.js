import pool from "../lib/mysql.js";
import { assertPaymentMatches, fetchRazorpayPayment, verifyCheckoutSignature } from "../lib/razorpayClient.js";
import tokenOrderRepository from "../repositories/TokenOrderRepository.js";
import studentLabTokenWalletRepository from "../repositories/StudentLabTokenWalletRepository.js";
import studentLabTokenTransactionRepository from "../repositories/StudentLabTokenTransactionRepository.js";
import creditWalletRepository from "../repositories/CreditWalletRepository.js";
import notificationService from "./NotificationService.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";

class PaymentSettlementService {
  /**
   * Credits a paid order exactly once.
   *
   * @param {object} args
   * @param {string|number} [args.orderId]          token_orders.Id
   * @param {string} [args.razorpayOrderId]          Razorpay order id (alias: gatewayOrderId)
   * @param {string} args.razorpayPaymentId
   * @param {string} [args.razorpaySignature]        checkout signature (required unless fromVerifiedWebhook)
   * @param {string|number} [args.expectedStudentId] when set, the order must belong to this student
   * @param {boolean} [args.fromVerifiedWebhook]     the webhook body HMAC was already verified
   */
  async settleOrder({ orderId, razorpayOrderId, gatewayOrderId, razorpayPaymentId, razorpaySignature, expectedStudentId = null, fromVerifiedWebhook = false }) {
    razorpayOrderId = razorpayOrderId || gatewayOrderId || null;
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

      // Ownership: a student may only settle (and see the result of) their own order.
      if (expectedStudentId != null && String(order.StudentId) !== String(expectedStudentId)) {
        await connection.rollback();
        connection.release();
        connection = null;
        throw forbidden("This order belongs to another account");
      }
      // The order must match the Razorpay order the payment was made against.
      if (razorpayOrderId && String(order.RazorpayOrderId || "") !== String(razorpayOrderId)) {
        await connection.rollback();
        connection.release();
        connection = null;
        throw badRequest("Payment does not match this order");
      }

      // Idempotency Guard: If already processed and credited, return immediately
      const creditedStatuses = await tokenOrderRepository.creditedStatuses(connection);
      if (creditedStatuses.includes(order.Status) || order.CreditedAt) {
        await connection.rollback();
        connection.release();
        console.log(`[PaymentSettlementService] Order ${order.Id} (${order.OrderNumber}) is already processed (${order.Status}). Skipping.`);
        return { success: true, alreadyProcessed: true, orderId: order.Id };
      }

      const orderRef = String(order.RazorpayOrderId || "");
      if (!orderRef.startsWith("order_")) {
        await connection.rollback();
        connection.release();
        throw badRequest("This order is not a Razorpay order");
      }
      if (!razorpayPaymentId || (!razorpaySignature && !fromVerifiedWebhook)) {
        await connection.rollback();
        connection.release();
        connection = null;
        throw badRequest("Razorpay payment id and signature are required");
      }

      try {
        if (!fromVerifiedWebhook) {
          verifyCheckoutSignature(orderRef, razorpayPaymentId, razorpaySignature);
        }
        // Always confirm with Razorpay itself: captured, same order, same amount.
        const payment = await fetchRazorpayPayment(razorpayPaymentId);
        assertPaymentMatches({
          payment,
          orderId: orderRef,
          amountInPaise: Math.round(Number(order.TotalAmount) * 100),
        });
      } catch (verifyErr) {
        await tokenOrderRepository.markOrderFailed(order.Id, connection);
        await connection.commit();
        connection.release();
        connection = null;
        throw verifyErr;
      }

      const paymentIdToSave = razorpayPaymentId;

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

        // Write Immutable Idempotent Ledger Entry in student_lab_token_transactions
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

        // Also record in credit_transactions for unified student transaction ledger
        try {
          await creditWalletRepository.insertTransaction({
            tenantId: order.TenantId || 'DEFAULT',
            userId: String(order.StudentId),
            type: 'PURCHASE',
            source: 'STUDENT_PURCHASE',
            credits: tokensToAdd,
            amount: Number(item.LineTotalAmount || 0),
            currency: order.Currency || 'INR',
            paymentReference: paymentIdToSave,
            labId,
            idempotencyKey,
            status: 'SUCCESS',
            metadataJson: {
              orderId: order.Id,
              orderNumber: order.OrderNumber,
              labId,
              labName: item.LabNameSnapshot || `${labId.toUpperCase()} Lab`,
              tokens: tokensToAdd,
              studentId: order.StudentId
            }
          }, connection);
        } catch (txnErr) {
          console.warn("[PaymentSettlementService] credit_transactions sync note:", txnErr.message);
        }

        // Real-time Notification Event
        notificationService.emitBalanceUpdated({
          tenantId: order.TenantId,
          studentId: order.StudentId,
          labId,
          remainingTokens: updatedWallet.RemainingTokens
        });

        // 4. Reset LowTokenWarningSent flag if session is currently RUNNING so student gets next warning when low
        // lab_sessions has no StudentId column (it is UserId). The old query failed on every
        // settlement and rolled the whole credit back.
        await connection.query(
          `UPDATE lab_sessions
           SET LowTokenWarningSent = 0
           WHERE TenantId = ? AND UserId = ? AND LabId = ? AND Status = 'RUNNING'`,
          [order.TenantId, Number(order.StudentId), String(labId)]
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
