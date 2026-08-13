import { ok } from "../lib/apigw.js";
import { unauthorized } from "../lib/errors.js";
import pool from "../lib/mysql.js";
import { ENV } from "../config/env.js";

export const internalOwnerStudentsHandler = async ({ headers = {}, queryStringParameters = {} }) => {
  const serviceToken = headers['x-internal-service-token'] || headers['X-Internal-Service-Token'];
  if (!serviceToken || serviceToken !== ENV.internalServiceToken) {
    throw unauthorized("Unauthorized internal service access");
  }

  const tenantFilter = queryStringParameters.tenantId || null;

  let query = `
    SELECT 
      u.UserId,
      u.FullName,
      u.Email,
      u.AuthType,
      u.CreatedFrom,
      u.Status as UserStatus,
      u.CreatedAt as UserCreatedAt,
      utm.TenantId,
      t.Name as TenantName,
      t.Slug as TenantSlug,
      COALESCE(w.Balance, 0) as CreditBalance,
      COALESCE(SUM(CASE WHEN ct.Type = 'PURCHASE' THEN ct.Credits ELSE 0 END), 0) as TotalPurchasedCredits,
      COALESCE(SUM(CASE WHEN ct.Type = 'PURCHASE' THEN ct.Amount ELSE 0 END), 0) as TotalAmountPaid,
      MAX(CASE WHEN ct.Type = 'PURCHASE' THEN ct.CreatedAt ELSE NULL END) as LastPurchaseAt
    FROM Users u
    LEFT JOIN user_tenant_mapping utm ON u.UserId = utm.UserId
    LEFT JOIN tenants t ON utm.TenantId = t.TenantId
    LEFT JOIN credit_wallets w ON u.UserId = w.UserId AND w.TenantId = utm.TenantId
    LEFT JOIN credit_transactions ct ON u.UserId = ct.UserId AND ct.TenantId = utm.TenantId
  `;

  const params = [];
  if (tenantFilter) {
    query += ` WHERE utm.TenantId = ?`;
    params.push(tenantFilter);
  }

  query += ` GROUP BY u.UserId, utm.TenantId ORDER BY u.CreatedAt DESC`;

  const [rows] = await pool.query(query, params);

  return ok({
    success: true,
    students: rows.map(r => ({
      userId: `EXP${10000 + r.UserId}`,
      rawUserId: r.UserId,
      fullName: r.FullName,
      email: r.Email,
      authType: r.AuthType,
      createdFrom: r.CreatedFrom,
      status: r.UserStatus,
      createdAt: r.UserCreatedAt,
      tenantId: r.TenantId || 'GLOBAL',
      tenantName: r.TenantName || 'Experia Direct',
      tenantSlug: r.TenantSlug || 'experia',
      creditBalance: Number(r.CreditBalance),
      totalPurchasedCredits: Number(r.TotalPurchasedCredits),
      totalAmountPaid: Number(r.TotalAmountPaid),
      lastPurchaseAt: r.LastPurchaseAt
    }))
  });
};
