import pool from "../lib/mysql.js";

class TokenOrderRepository {
  async createOrder({
    tenantId,
    studentId,
    orderNumber,
    totalAmount,
    currency = 'INR',
    razorpayOrderId = null,
    idempotencyKey = null,
    quoteExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
  }, db = pool) {
    const [result] = await db.query(
      `INSERT INTO token_orders
       (TenantId, StudentId, OrderNumber, Status, Currency, TotalAmount, RazorpayOrderId, IdempotencyKey, QuoteExpiresAt)
       VALUES (?, ?, ?, 'PENDING_PAYMENT', ?, ?, ?, ?, ?)`,
      [tenantId, String(studentId), orderNumber, currency, Number(totalAmount) || 0, razorpayOrderId, idempotencyKey, quoteExpiresAt]
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
    await db.query(
      `INSERT INTO token_order_items
       (OrderId, LabId, PackageId, LabNameSnapshot, TokenQuantity, UnitPriceAmount, LineTotalAmount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        String(labId),
        packageId ? String(packageId) : null,
        labNameSnapshot,
        Number(tokenQuantity) || 0,
        Number(unitPriceAmount) || 0,
        Number(lineTotalAmount) || 0
      ]
    );
  }

  async getOrderById(orderId, db = pool) {
    const [rows] = await db.query(
      `SELECT Id, TenantId, StudentId, OrderNumber, Status, Currency, TotalAmount, RazorpayOrderId, RazorpayPaymentId, IdempotencyKey, QuoteExpiresAt, PaidAt, CreditedAt, CreatedAt
       FROM token_orders
       WHERE Id = ?`,
      [orderId]
    );
    if (!rows[0]) return null;
    const order = rows[0];
    order.items = await this.getOrderItems(order.Id, db);
    return order;
  }

  async getOrderForUpdate(orderId, db = pool) {
    const [rows] = await db.query(
      `SELECT Id, TenantId, StudentId, OrderNumber, Status, Currency, TotalAmount, RazorpayOrderId, RazorpayPaymentId, IdempotencyKey, QuoteExpiresAt, PaidAt, CreditedAt, CreatedAt
       FROM token_orders
       WHERE Id = ? FOR UPDATE`,
      [orderId]
    );
    if (!rows[0]) return null;
    const order = rows[0];
    order.items = await this.getOrderItems(order.Id, db);
    return order;
  }

  async getOrderByRazorpayOrderId(razorpayOrderId, db = pool) {
    const [rows] = await db.query(
      `SELECT Id, TenantId, StudentId, OrderNumber, Status, Currency, TotalAmount, RazorpayOrderId, RazorpayPaymentId, IdempotencyKey, QuoteExpiresAt, PaidAt, CreditedAt, CreatedAt
       FROM token_orders
       WHERE RazorpayOrderId = ?`,
      [razorpayOrderId]
    );
    if (!rows[0]) return null;
    const order = rows[0];
    order.items = await this.getOrderItems(order.Id, db);
    return order;
  }

  async getOrderItems(orderId, db = pool) {
    const [rows] = await db.query(
      `SELECT Id, OrderId, LabId, PackageId, LabNameSnapshot, TokenQuantity, UnitPriceAmount, LineTotalAmount, CreatedAt
       FROM token_order_items
       WHERE OrderId = ?`,
      [orderId]
    );
    return rows;
  }

  async markOrderPaid(orderId, razorpayPaymentId, paidAt = new Date(), db = pool) {
    await db.query(
      `UPDATE token_orders
       SET Status = 'PAID', RazorpayPaymentId = ?, PaidAt = ?
       WHERE Id = ? AND Status = 'PENDING_PAYMENT'`,
      [razorpayPaymentId, paidAt, orderId]
    );
  }

  async markOrderCredited(orderId, razorpayPaymentId, creditedAt = new Date(), db = pool) {
    await db.query(
      `UPDATE token_orders
       SET Status = 'TOKEN_CREDITED', RazorpayPaymentId = COALESCE(RazorpayPaymentId, ?), CreditedAt = ?
       WHERE Id = ?`,
      [razorpayPaymentId, creditedAt, orderId]
    );
  }

  async markOrderFailed(orderId, db = pool) {
    await db.query(
      `UPDATE token_orders
       SET Status = 'FAILED'
       WHERE Id = ?`,
      [orderId]
    );
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

    for (const order of rows) {
      order.items = await this.getOrderItems(order.Id, db);
    }
    return rows;
  }
}

export const tokenOrderRepository = new TokenOrderRepository();
export default tokenOrderRepository;
