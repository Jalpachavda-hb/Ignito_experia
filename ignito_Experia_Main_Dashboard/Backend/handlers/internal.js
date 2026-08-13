import bcrypt from 'bcryptjs';
import { getDbPool } from '../config/db.js';

/**
 * GET /api/internal/tenants/by-slug/:slug
 * Resolves tenant info by slug for VLab application.
 * Returns only non-sensitive tenant identity info.
 */
export async function internalTenantBySlugHandler(req, res) {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Slug parameter is required' });
    }

    const pool = getDbPool();
    if (!pool) {
      return res.status(500).json({ success: false, message: 'Database connection pool unavailable' });
    }

    const [rows] = await pool.execute(
      `SELECT TenantId, Name, Slug, OfficialDomain, LogoUrl, Status 
       FROM tenants 
       WHERE LOWER(Slug) = ?`,
      [slug.toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: `Tenant not found for domain '${slug}'` });
    }

    const tenant = rows[0];

    return res.status(200).json({
      success: true,
      tenantId: tenant.TenantId,
      name: tenant.Name,
      slug: tenant.Slug,
      officialDomain: tenant.OfficialDomain,
      logoUrl: tenant.LogoUrl,
      status: tenant.Status,
    });
  } catch (error) {
    console.error('Error in internalTenantBySlugHandler:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
}

/**
 * POST /api/internal/auth/tenant-login
 * Authenticates Tenant Administrator against Owner DB identity system.
 * Validates Tenant status, User status, Role = TENANT_ADMIN, and password hash.
 */
export async function internalTenantLoginHandler(req, res) {
  try {
    const { tenantId, email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const pool = getDbPool();
    if (!pool) {
      return res.status(500).json({ success: false, message: 'Database connection pool unavailable' });
    }

    // 1. Check tenants table directly (Primary Tenant Admin)
    let tenantRows = [];
    if (tenantId) {
      [tenantRows] = await pool.execute(
        `SELECT DbId, TenantId, Name, Slug, Status, AdminFullName, AdminEmail, AdminPasswordHash 
         FROM tenants 
         WHERE TenantId = ? AND LOWER(AdminEmail) = ?`,
        [tenantId, cleanEmail]
      );
    } else {
      [tenantRows] = await pool.execute(
        `SELECT DbId, TenantId, Name, Slug, Status, AdminFullName, AdminEmail, AdminPasswordHash 
         FROM tenants 
         WHERE LOWER(AdminEmail) = ?`,
        [cleanEmail]
      );
    }

    if (tenantRows.length > 0) {
      const tenant = tenantRows[0];

      if ((tenant.Status || '').toUpperCase() !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: `This university account (${tenant.Name}) is currently unavailable. Please contact the platform administrator.`,
        });
      }

      if (!tenant.AdminPasswordHash) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      const isValid = bcrypt.compareSync(password, tenant.AdminPasswordHash);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      return res.status(200).json({
        success: true,
        userId: tenant.DbId,
        tenantId: tenant.TenantId,
        role: 'TENANT_ADMIN',
        name: tenant.AdminFullName || 'Tenant Administrator',
        email: tenant.AdminEmail,
        tenantName: tenant.Name,
        tenantSlug: tenant.Slug,
      });
    }

    // 2. Check user_tenant_mapping + users table (Backward compatibility)
    const [userRows] = await pool.execute(
      `SELECT u.UserId, u.Email, u.PasswordHash, u.FullName, u.Status as UserStatus,
              t.DbId as TenantDbId, t.TenantId, t.Name as TenantName, t.Slug as TenantSlug, t.Status as TenantStatus, utm.Role
       FROM users u
       JOIN user_tenant_mapping utm ON u.UserId = utm.UserId
       JOIN tenants t ON utm.TenantId = t.TenantId
       WHERE LOWER(u.Email) = ? AND utm.Role = 'TENANT_ADMIN' ${tenantId ? 'AND t.TenantId = ?' : ''}`,
      tenantId ? [cleanEmail, tenantId] : [cleanEmail]
    );

    if (userRows.length > 0) {
      const u = userRows[0];

      if ((u.TenantStatus || '').toUpperCase() !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: `This university account (${u.TenantName}) is currently unavailable. Please contact the platform administrator.`,
        });
      }

      if ((u.UserStatus || '').toUpperCase() !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: 'Your administrator account is inactive. Please contact the platform administrator.',
        });
      }

      const isValid = bcrypt.compareSync(password, u.PasswordHash);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      // Auto sync into tenants table
      try {
        await pool.execute(
          `UPDATE tenants 
           SET AdminEmail = ?, AdminPasswordHash = ?, AdminFullName = ?
           WHERE DbId = ?`,
          [u.Email, u.PasswordHash, u.FullName, u.TenantDbId]
        );
      } catch (e) {}

      return res.status(200).json({
        success: true,
        userId: u.UserId,
        tenantId: u.TenantId,
        role: 'TENANT_ADMIN',
        name: u.FullName || 'Tenant Administrator',
        email: u.Email,
        tenantName: u.TenantName,
        tenantSlug: u.TenantSlug,
      });
    }

    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  } catch (error) {
    console.error('Error in internalTenantLoginHandler:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
}
