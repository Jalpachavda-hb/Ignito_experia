/**
 * Secure checkout behind the legacy /payments/razorpay/create-order and /verify routes.
 *
 * Before: the browser chose the amount AND the number of tokens, and /verify credited whatever
 * the browser sent (plus an optional userEmail / tenantId of another account).
 * Now: prices come from ignito_experia_owner.labs.BaseTokenPrice (price per 60 tokens, the
 * same rule the wallet page shows), the order is stored in token_orders / token_order_items,
 * and /verify settles that stored order through PaymentSettlementService (signature + Razorpay
 * capture + amount check, ownership check, exactly-once crediting).
 */
import crypto from "crypto";
import pool from "../lib/mysql.js";
import { badRequest } from "../lib/errors.js";
import { createRazorpayOrder } from "../lib/razorpayClient.js";
import tokenOrderRepository from "../repositories/TokenOrderRepository.js";
import paymentSettlementService from "./PaymentSettlementService.js";
import { resolveAuthTenantId } from "../lib/studentTenant.js";
import { invalidateStudentLabAccess } from "./StudentLabAccessService.js";

export const MAX_TOKENS_PER_ITEM = 100000;
export const MAX_ITEMS = 50;

export const canonicalLabKey = (value) =>
  String(value || "").toLowerCase().trim().replace(/^lab-/, "").replace(/-lab$/, "");

/** Same formula the wallet page uses: round(tokens * pricePer60 / 60), in rupees. */
export function priceForTokens(tokens, pricePer60) {
  return Math.round(Number(tokens) * (Number(pricePer60) / 60));
}

async function loadPurchasableLabs(db = pool) {
  const [rows] = await db.query(
    "SELECT `LabId`, `LabCode`, `Title`, `BaseTokenPrice`, `Status`, `IsDeleted` FROM `ignito_experia_owner`.`labs` WHERE `IsDeleted` = 0"
  );
  return rows.filter((r) => String(r.Status || "").toLowerCase() === "active");
}

function findLab(labs, requested) {
  const raw = String(requested || "").trim().toLowerCase();
  if (!raw) return null;
  const key = canonicalLabKey(raw);
  return (
    labs.find((l) => String(l.LabId) === raw) ||
    labs.find((l) => String(l.LabCode || "").toLowerCase() === raw) ||
    labs.find((l) => canonicalLabKey(l.LabCode) === key) ||
    null
  );
}

/** Turns the browser's cart into server-priced lines. Exported for tests. */
export function priceCart(requestedItems, labs) {
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    throw badRequest("Choose at least one lab to buy tokens for");
  }
  if (requestedItems.length > MAX_ITEMS) throw badRequest("Too many items in one order");

  const merged = new Map();
  for (const item of requestedItems) {
    const lab = findLab(labs, item?.labId ?? item?.id ?? item?.labCode);
    if (!lab) throw badRequest(`Lab ${String(item?.labId || "").slice(0, 60)} is not available for purchase`);
    const tokens = Number(item?.tokens ?? item?.tokenQuantity);
    if (!Number.isInteger(tokens) || tokens <= 0 || tokens > MAX_TOKENS_PER_ITEM) {
      throw badRequest("Token quantity must be a whole number between 1 and 100000");
    }
    const prev = merged.get(lab.LabId);
    merged.set(lab.LabId, { lab, tokens: (prev?.tokens || 0) + tokens });
  }

  const lines = [];
  for (const { lab, tokens } of merged.values()) {
    const pricePer60 = Number(lab.BaseTokenPrice);
    if (!Number.isFinite(pricePer60) || pricePer60 < 0) throw badRequest(`Lab ${lab.LabCode} has no price`);
    const lineTotal = priceForTokens(tokens, pricePer60);
    lines.push({
      labId: lab.LabCode,
      labName: lab.Title || lab.LabCode,
      tokens,
      unitPrice: pricePer60,
      lineTotal,
    });
  }
  const totalAmount = lines.reduce((s, l) => s + l.lineTotal, 0);
  const totalTokens = lines.reduce((s, l) => s + l.tokens, 0);
  if (Math.round(totalAmount * 100) < 100) throw badRequest("Minimum payment amount is ₹1");
  return { lines, totalAmount, totalTokens };
}

class LabTokenCheckoutService {
  async createOrder({ auth, items }) {
    const studentId = Number(auth?.userId);
    if (!Number.isFinite(studentId) || studentId <= 0) throw badRequest("A student account is required");
    // Direct students keep their PLATFORM bucket, as before.
    const tenantId = await resolveAuthTenantId(auth, { fallback: "PLATFORM" });

    const labs = await loadPurchasableLabs();
    const { lines, totalAmount, totalTokens } = priceCart(items, labs);

    const orderNumber = `TOK-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomInt(100000, 999999)}`;
    const { keyId, order: rzpOrder } = await createRazorpayOrder({
      amountInPaise: Math.round(totalAmount * 100),
      receipt: orderNumber,
      notes: { tenantId: String(tenantId), studentId: String(studentId), orderNumber, tokens: String(totalTokens) },
    });

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const orderId = await tokenOrderRepository.createOrder({
        tenantId,
        studentId,
        orderNumber,
        totalAmount,
        totalTokens,
        currency: "INR",
        razorpayOrderId: rzpOrder.id,
        idempotencyKey: `order_${orderNumber}`,
      }, connection);
      for (const line of lines) {
        await tokenOrderRepository.addOrderItem({
          orderId,
          labId: line.labId,
          labNameSnapshot: String(line.labName).slice(0, 255),
          tokenQuantity: line.tokens,
          unitPriceAmount: line.unitPrice,
          lineTotalAmount: line.lineTotal,
        }, connection);
      }
      await connection.commit();
      return {
        orderId: rzpOrder.id,
        razorpayOrderId: rzpOrder.id,
        orderRecordId: orderId,
        orderNumber,
        amount: rzpOrder.amount,
        amountInRupees: totalAmount,
        currency: rzpOrder.currency || "INR",
        key: keyId,
        totalTokens,
        items: lines,
      };
    } catch (err) {
      try { await connection.rollback(); } catch { /* ignore */ }
      throw err;
    } finally {
      connection.release();
    }
  }

  async verify({ auth, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    if (!razorpayOrderId || !String(razorpayOrderId).startsWith("order_")) {
      throw badRequest("A Razorpay order id is required");
    }
    if (!razorpayPaymentId || !razorpaySignature) {
      throw badRequest("Razorpay payment id and signature are required");
    }
    const result = await paymentSettlementService.settleOrder({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      expectedStudentId: Number(auth.userId),
    });
    const order = await tokenOrderRepository.getOrderByRazorpayOrderId(razorpayOrderId);
    await invalidateStudentLabAccess(auth.userId);
    const creditsAdded = (order?.items || []).reduce((s, i) => s + Number(i.TokenQuantity || 0), 0);
    return {
      verified: true,
      alreadyProcessed: Boolean(result?.alreadyProcessed),
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId,
      creditsAdded,
      items: (order?.items || []).map((i) => ({ labId: i.LabId, tokens: Number(i.TokenQuantity || 0) })),
      message: "Payment verified with Razorpay and lab tokens were added.",
    };
  }
}

export const labTokenCheckoutService = new LabTokenCheckoutService();
export default labTokenCheckoutService;
