import pool from "../lib/mysql.js";

/**
 * token_orders.Status and the token_order_items legacy columns differ between environments
 * (migrations 014 / 016 and the live hotfixes). Instead of assuming one schema, read the real
 * column definitions once and write values the database actually accepts. Strict-mode MySQL 8
 * rejects an unknown ENUM value or a missing NOT NULL column, which used to roll settlement back.
 */
const STATUS_PREFERENCES = {
  pending: ["PENDING_PAYMENT", "PAYMENT_PENDING", "PENDING", "CREATED"],
  credited: ["TOKEN_CREDITED", "PAID"],
  paid: ["PAID"],
  failed: ["FAILED"],
};
let schemaInfoPromise = null;

export function pickStatus(allowed, kind) {
  const prefs = STATUS_PREFERENCES[kind] || [];
  if (!allowed || !allowed.length) return prefs[0];
  return prefs.find((v) => allowed.includes(v)) || prefs[0];
}

export function parseEnum(columnType) {
  const m = /^enum\((.*)\)$/i.exec(String(columnType || ""));
  if (!m) return null;
  return [...m[1].matchAll(/'((?:[^']|'')*)'/g)].map((x) => x[1].replace(/''/g, "'"));
}

async function loadSchemaInfo(db = pool) {
  if (!schemaInfoPromise) {
    schemaInfoPromise = (async () => {
      const [cols] = await db.query(
        `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLUMN_TYPE AS ty
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('token_orders', 'token_order_items')`
      );
      const orderCols = new Set(cols.filter((r) => r.t === "token_orders").map((r) => r.c));
      const itemCols = new Set(cols.filter((r) => r.t === "token_order_items").map((r) => r.c));
      const statusCol = cols.find((r) => r.t === "token_orders" && r.c === "Status");
      return { orderCols, itemCols, statusValues: parseEnum(statusCol?.ty) };
    })().catch((err) => {
      schemaInfoPromise = null;
      console.warn("[TokenOrderRepository] schema probe failed:", err.message);
      return { orderCols: new Set(), itemCols: new Set(), statusValues: null };
    });
  }
  return schemaInfoPromise;
}

export function resetTokenOrderSchemaCache() {
  schemaInfoPromise = null;
}

const ORDER_COLUMNS =
  "Id, TenantId, StudentId, OrderNumber, Status, Currency, TotalAmount, RazorpayOrderId, RazorpayPaymentId, IdempotencyKey, QuoteExpiresAt, PaidAt, CreditedAt, CreatedAt";
const ITEM_COLUMNS =
  "Id, OrderId, LabId, PackageId, LabNameSnapshot, TokenQuantity, UnitPriceAmount, LineTotalAmount, CreatedAt";

const quote = (c) => `\`${c}\``;

class TokenOrderRepository {
  async status(kind, db = pool) {
    const info = await loadSchemaInfo(db);
    return pickStatus(info.statusValues, kind);
  }

  /** Every status value that means "tokens already credited" in this database. */
  async creditedStatuses(db = pool) {
    const info = await loadSchemaInfo(db);
    const all = ["TOKEN_CREDITED", "PAID"];
    return info.statusValues ? all.filter((v) => info.statusValues.includes(v)) : all;
  }

  async createOrder({
    tenantId,
    studentId,
    orderNumber,
    totalAmount,
    currency = 'INR',
    razorpayOrderId = null,
    idempotencyKey = null,
    quoteExpiresAt = new Date(Date.now() + 10 * 60 * 1000),
    totalTokens = null,
  }, db = pool) {
    const info = await loadSchemaInfo(db);
    const cols = ["TenantId", "StudentId", "OrderNumber", "Status", "Currency", "TotalAmount", "RazorpayOrderId", "IdempotencyKey", "QuoteExpiresAt"];
    const vals = [tenantId, String(studentId), orderNumber, pickStatus(info.statusValues, "pending"), currency, Number(totalAmount) || 0, razorpayOrderId, idempotencyKey, quoteExpiresAt];
    if (totalTokens != null && info.orderCols.has("TotalTokens")) { cols.push("TotalTokens"); vals.push(Number(totalTokens) || 0); }
    if (razorpayOrderId && info.orderCols.has("GatewayOrderId")) { cols.push("GatewayOrderId"); vals.push(razorpayOrderId); }
    const [result] = await db.query(
      `INSERT INTO token_orders (${cols.map(quote).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      vals
    );
    return result.insertId;
  }

  async addOrderItem({
    orderId,
    labId,
    packageId = null,
    labNameSnapshot = 'Virtual Lab',
    tokenQuantity,
    unitPriceAmount,
    lineTotalAmount
  }, db = pool) {
    const info = await loadSchemaInfo(db);
    const qty = Number(tokenQuantity) || 0;
    const unit = Number(unitPriceAmount) || 0;
    const line = Number(lineTotalAmount) || 0;
    const cols = ["OrderId", "LabId", "PackageId", "LabNameSnapshot", "TokenQuantity", "UnitPriceAmount", "LineTotalAmount"];
    const vals = [orderId, String(labId), packageId ? String(packageId) : null, labNameSnapshot, qty, unit, line];
    // Legacy duplicates (NOT NULL without default on some databases): fill them with the same values.
    for (const [col, value] of [["TokenAmount", qty], ["TokenAmountSnapshot", qty], ["UnitPrice", unit], ["TotalAmount", line]]) {
      if (info.itemCols.has(col)) { cols.push(col); vals.push(value); }
    }
    await db.query(
      `INSERT INTO token_order_items (${cols.map(quote).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      vals
    );
  }

  async getOrderById(orderId, db = pool) {
    const [rows] = await db.query(`SELECT ${ORDER_COLUMNS} FROM token_orders WHERE Id = ?`, [orderId]);
    if (!rows[0]) return null;
    const order = rows[0];
    order.items = await this.getOrderItems(order.Id, db);
    return order;
  }

  async getOrderForUpdate(orderId, db = pool) {
    const [rows] = await db.query(`SELECT ${ORDER_COLUMNS} FROM token_orders WHERE Id = ? FOR UPDATE`, [orderId]);
    if (!rows[0]) return null;
    const order = rows[0];
    order.items = await this.getOrderItems(order.Id, db);
    return order;
  }

  async getOrderByRazorpayOrderId(razorpayOrderId, db = pool) {
    const [rows] = await db.query(`SELECT ${ORDER_COLUMNS} FROM token_orders WHERE RazorpayOrderId = ?`, [razorpayOrderId]);
    if (!rows[0]) return null;
    const order = rows[0];
    order.items = await this.getOrderItems(order.Id, db);
    return order;
  }

  async getOrderItems(orderId, db = pool) {
    const [rows] = await db.query(`SELECT ${ITEM_COLUMNS} FROM token_order_items WHERE OrderId = ?`, [orderId]);
    return rows;
  }

  async markOrderPaid(orderId, razorpayPaymentId, paidAt = new Date(), db = pool) {
    const info = await loadSchemaInfo(db);
    await db.query(
      `UPDATE token_orders SET Status = ?, RazorpayPaymentId = ?, PaidAt = ? WHERE Id = ? AND Status = ?`,
      [pickStatus(info.statusValues, "paid"), razorpayPaymentId, paidAt, orderId, pickStatus(info.statusValues, "pending")]
    );
  }

  async markOrderCredited(orderId, razorpayPaymentId, creditedAt = new Date(), db = pool) {
    const info = await loadSchemaInfo(db);
    const sets = ["Status = ?", "RazorpayPaymentId = COALESCE(RazorpayPaymentId, ?)", "CreditedAt = ?"];
    const params = [pickStatus(info.statusValues, "credited"), razorpayPaymentId, creditedAt];
    if (info.orderCols.has("PaidAt")) { sets.push("PaidAt = COALESCE(PaidAt, ?)"); params.push(creditedAt); }
    if (info.orderCols.has("GatewayPaymentId")) { sets.push("GatewayPaymentId = COALESCE(GatewayPaymentId, ?)"); params.push(razorpayPaymentId); }
    params.push(orderId);
    await db.query(`UPDATE token_orders SET ${sets.join(", ")} WHERE Id = ?`, params);
  }

  async markOrderFailed(orderId, db = pool) {
    const info = await loadSchemaInfo(db);
    const extra = info.orderCols.has("FailedAt") ? ", FailedAt = NOW()" : "";
    await db.query(`UPDATE token_orders SET Status = ?${extra} WHERE Id = ?`, [pickStatus(info.statusValues, "failed"), orderId]);
  }

  async getStudentOrders(tenantId, studentId, limit = 50, offset = 0, db = pool) {
    const [rows] = await db.query(
      `SELECT Id, TenantId, StudentId, OrderNumber, Status, Currency, TotalAmount, RazorpayOrderId, RazorpayPaymentId, PaidAt, CreditedAt, CreatedAt
       FROM token_orders
       WHERE TenantId = ? AND StudentId = ?
       ORDER BY CreatedAt DESC
       LIMIT ? OFFSET ?`,
      [tenantId, String(studentId), Number(limit) || 50, Number(offset) || 0]
    );

    // One items query for the whole page instead of one per order (N+1).
    const byOrder = new Map(rows.map((o) => { o.items = []; return [String(o.Id), o]; }));
    if (byOrder.size) {
      const ids = [...byOrder.keys()];
      const [items] = await db.query(
        `SELECT ${ITEM_COLUMNS} FROM token_order_items WHERE OrderId IN (${ids.map(() => "?").join(",")}) ORDER BY Id ASC`,
        ids
      );
      for (const item of items) byOrder.get(String(item.OrderId))?.items.push(item);
    }
    return rows;
  }
}

export const tokenOrderRepository = new TokenOrderRepository();
export default tokenOrderRepository;
