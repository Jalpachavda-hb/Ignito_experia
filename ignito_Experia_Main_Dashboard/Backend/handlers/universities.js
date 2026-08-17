import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getDbPool } from '../config/db.js'

const BASE_DOMAIN = process.env.BASE_DOMAIN || 'experia.ignitolearn.com'

/**
 * GET /api/admin/universities
 * List all university tenants with dynamic subdomain resolution and tenant admin info.
 */
export async function universitiesListHandler(req, res) {
  try {
    const pool = getDbPool()
    if (!pool) {
      return res.status(200).json({ success: true, data: [] })
    }

    const [rows] = await pool.execute(`
      SELECT 
        t.TenantId,
        t.Name,
        t.Slug,
        t.OfficialDomain,
        t.LogoUrl,
        t.IntegrationMode,
        t.Status,
        t.SettingsJson,
        t.CreatedDate,
        t.AdminEmail,
        t.AdminFullName as AdminName,
        t.AdminPhone
      FROM tenants t
      ORDER BY t.DbId DESC
    `)

    const formattedData = rows.map((t) => ({
      id: t.TenantId,
      tenantId: t.TenantId,
      name: t.Name,
      code: (t.Slug || 'UNI').toUpperCase().slice(0, 3),
      slug: t.Slug,
      subdomain: `${t.Slug}.${BASE_DOMAIN}`,
      officialDomain: t.OfficialDomain || `${t.Slug}.edu`,
      logoUrl: t.LogoUrl || '',
      integrationMode: t.IntegrationMode || 'LMS',
      mode: t.IntegrationMode === 'LMS' ? 'With LMS' : 'Without LMS',
      status: t.Status ? t.Status.toLowerCase() : 'active',
      email: t.AdminEmail || 'admin@tenant.edu',
      phone: t.AdminPhone || '',
      adminName: t.AdminName || 'Tenant Administrator',
      students: 0,
      faculty: 0,
      credits: '100,000',
      createdDate: t.CreatedDate,
    }))

    return res.status(200).json({
      success: true,
      data: formattedData,
    })
  } catch (error) {
    console.error('Error fetching university tenants:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch university tenants',
      error: error.message,
    })
  }
}

/**
 * POST /api/admin/universities
 * Provision a new University Tenant directly in tenants table.
 */
export async function universitiesCreateHandler(req, res) {
  try {
    const {
      name,
      slug,
      officialDomain,
      logoUrl,
      integrationMode,
      adminName,
      adminEmail,
      adminPhone,
      adminPassword,
    } = req.body || {}

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'University Name is required' })
    }
    if (!slug || !slug.trim()) {
      return res.status(400).json({ success: false, message: 'Subdomain / Slug is required' })
    }
    if (!adminName || !adminName.trim()) {
      return res.status(400).json({ success: false, message: 'Admin Full Name is required' })
    }
    if (!adminEmail || !adminEmail.trim()) {
      return res.status(400).json({ success: false, message: 'Admin Email Address is required' })
    }
    if (!adminPassword || !adminPassword.trim()) {
      return res.status(400).json({ success: false, message: 'Admin Password is required' })
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, '')
    const modeEnum = integrationMode === 'DIRECT' ? 'DIRECT' : 'LMS'

    const pool = getDbPool()
    if (!pool) {
      return res.status(500).json({ success: false, message: 'Database connection pool unavailable' })
    }

    // 1. Check Uniqueness in tenants table
    const [existingNames] = await pool.execute('SELECT DbId FROM tenants WHERE Name = ?', [name.trim()])
    if (existingNames.length > 0) {
      return res.status(400).json({ success: false, message: 'University Name already exists' })
    }

    const [existingSlugs] = await pool.execute('SELECT DbId FROM tenants WHERE Slug = ?', [cleanSlug])
    if (existingSlugs.length > 0) {
      return res.status(400).json({ success: false, message: 'Subdomain / Slug already reserved' })
    }

    const [existingAdminEmails] = await pool.execute('SELECT DbId FROM tenants WHERE AdminEmail = ?', [adminEmail.trim().toLowerCase()])
    if (existingAdminEmails.length > 0) {
      return res.status(400).json({ success: false, message: 'Admin Email Address already registered to another university' })
    }

    // 2. Generate Secure Non-Sequential Tenant ID String Token (e.g. tnt_a8f9b2c3d4e5)
    const tenantId = `tnt_${crypto.randomBytes(6).toString('hex')}`

    // Default configuration settings
    const defaultSettings = JSON.stringify({
      lmsConfigured: false,
      defaultCredits: 100000,
      features: {
        ideAllowed: true,
        terminalAllowed: true,
        jupyterAllowed: true,
      },
    })

    // 3. Hash Password & Insert Tenant Entity directly with Admin details
    const passwordHash = bcrypt.hashSync(adminPassword.trim(), 10)
    const cleanEmail = adminEmail.trim().toLowerCase()
    const cleanPhone = adminPhone ? adminPhone.trim() : null
    const cleanName = adminName.trim()

    await pool.execute(
      `INSERT INTO tenants 
        (TenantId, Name, Slug, OfficialDomain, LogoUrl, IntegrationMode, AdminFullName, AdminEmail, AdminPasswordHash, AdminPhone, Status, SettingsJson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [
        tenantId,
        name.trim(),
        cleanSlug,
        officialDomain ? officialDomain.trim() : null,
        logoUrl ? logoUrl.trim() : null,
        modeEnum,
        cleanName,
        cleanEmail,
        passwordHash,
        cleanPhone,
        defaultSettings,
      ]
    )

    // Sync Tenant Admin into Users table
    try {
      const [existingUsers] = await pool.execute('SELECT UserId FROM Users WHERE LOWER(Email) = ?', [cleanEmail])
      if (existingUsers.length > 0) {
        await pool.execute(
          'UPDATE Users SET FullName = ?, PhoneNumber = COALESCE(?, PhoneNumber), Mobile = COALESCE(?, Mobile) WHERE UserId = ?',
          [cleanName, cleanPhone, cleanPhone, existingUsers[0].UserId]
        )
      } else {
        await pool.execute(
          `INSERT INTO Users (FullName, Email, PasswordHash, Role, Status, PhoneNumber, Mobile)
           VALUES (?, ?, ?, 'TENANT_ADMIN', 'Active', ?, ?)`,
          [cleanName, cleanEmail, passwordHash, cleanPhone, cleanPhone]
        )
      }
    } catch (e) {
      console.warn('Could not sync tenant admin in Users table:', e.message)
    }

    return res.status(201).json({
      success: true,
      message: 'University Tenant provisioned successfully!',
      data: {
        tenantId,
        name: name.trim(),
        slug: cleanSlug,
        subdomain: `${cleanSlug}.${BASE_DOMAIN}`,
        officialDomain: officialDomain || null,
        integrationMode: modeEnum,
        status: 'ACTIVE',
        adminEmail: cleanEmail,
      },
    })
  } catch (error) {
    console.error('Error provisioning university tenant:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to provision university tenant',
      error: error.message,
    })
  }
}

/**
 * PATCH /api/admin/universities/:tenantId/status
 * Toggle Tenant Status ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING')
 */
export async function universitiesStatusHandler(req, res) {
  try {
    const { tenantId } = req.params
    const { status } = req.body || {}

    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']
    const upperStatus = (status || '').toUpperCase()

    if (!validStatuses.includes(upperStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' })
    }

    const pool = getDbPool()
    if (!pool) {
      return res.status(500).json({ success: false, message: 'Database connection pool unavailable' })
    }

    const [result] = await pool.execute('UPDATE tenants SET Status = ?, UpdatedDate = NOW() WHERE TenantId = ?', [upperStatus, tenantId])

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Tenant not found' })
    }

    return res.status(200).json({
      success: true,
      message: `Tenant status updated to ${upperStatus}`,
      tenantId,
      status: upperStatus,
    })
  } catch (error) {
    console.error('Error updating tenant status:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to update tenant status',
      error: error.message,
    })
  }
}

/**
 * PUT /api/admin/universities/:tenantId
 * Update University Tenant details and administrator account directly in tenants table.
 */
export async function universitiesUpdateHandler(req, res) {
  try {
    const { tenantId } = req.params
    const { name, officialDomain, logoUrl, adminName, adminEmail, adminPhone } = req.body || {}

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'University Name is required' })
    }

    const pool = getDbPool()
    if (!pool) {
      return res.status(500).json({ success: false, message: 'Database connection pool unavailable' })
    }

    const cleanEmail = adminEmail ? adminEmail.trim().toLowerCase() : null
    const cleanPhone = adminPhone ? adminPhone.trim() : null
    const cleanName = adminName ? adminName.trim() : null

    // Update Tenant entity directly
    await pool.execute(
      `UPDATE tenants 
       SET Name = ?, OfficialDomain = ?, LogoUrl = ?,
           AdminFullName = COALESCE(?, AdminFullName),
           AdminEmail = COALESCE(?, AdminEmail),
           AdminPhone = COALESCE(?, AdminPhone),
           UpdatedDate = NOW()
       WHERE TenantId = ?`,
      [
        name.trim(),
        officialDomain ? officialDomain.trim() : null,
        logoUrl ? logoUrl.trim() : null,
        cleanName,
        cleanEmail,
        cleanPhone,
        tenantId,
      ]
    )

    // Sync Tenant Admin into Users table
    if (cleanEmail) {
      try {
        await pool.execute(
          `UPDATE Users SET 
             FullName = COALESCE(?, FullName),
             PhoneNumber = COALESCE(?, PhoneNumber),
             Mobile = COALESCE(?, Mobile)
           WHERE LOWER(Email) = ?`,
          [cleanName, cleanPhone, cleanPhone, cleanEmail]
        )
      } catch (e) {
        console.warn('Could not sync user update to Users table:', e.message)
      }
    }

    return res.status(200).json({
      success: true,
      message: 'University tenant updated successfully',
      tenantId,
    })
  } catch (error) {
    console.error('Error updating university tenant:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to update university tenant',
      error: error.message,
    })
  }
}

/**
 * DELETE /api/admin/universities/:tenantId
 * Delete University Tenant, reserved slug, and Tenant Admin account from database.
 */
export async function universitiesDeleteHandler(req, res) {
  try {
    const { tenantId } = req.params

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' })
    }

    const pool = getDbPool()
    if (!pool) {
      return res.status(500).json({ success: false, message: 'Database connection pool unavailable' })
    }

    // 1. Retrieve Tenant details before deletion
    const [tenants] = await pool.execute(
      'SELECT DbId, TenantId, Name, Slug, AdminEmail FROM tenants WHERE TenantId = ? OR DbId = ?',
      [tenantId, tenantId]
    )

    if (tenants.length === 0) {
      return res.status(404).json({ success: false, message: 'University tenant not found' })
    }

    const targetTenant = tenants[0]
    const actualTenantId = targetTenant.TenantId
    const adminEmail = targetTenant.AdminEmail ? targetTenant.AdminEmail.trim().toLowerCase() : null

    // 2. Identify associated user IDs for full data cleanup
    const userIds = new Set()

    if (adminEmail) {
      const [adminUsers] = await pool.execute('SELECT UserId FROM Users WHERE LOWER(TRIM(Email)) = ?', [adminEmail])
      adminUsers.forEach(u => userIds.add(u.UserId))
    }

    const [mappedUsers] = await pool.execute('SELECT UserId FROM user_tenant_mapping WHERE TenantId = ?', [actualTenantId])
    mappedUsers.forEach(u => userIds.add(u.UserId))

    const userIdsArray = Array.from(userIds)

    // 3. Delete tenant mapping, credit wallets, external identities, and SSO replay data
    await pool.execute('DELETE FROM user_tenant_mapping WHERE TenantId = ?', [actualTenantId])
    try { await pool.execute('DELETE FROM credit_wallets WHERE TenantId = ?', [actualTenantId]); } catch (e) {}
    try { await pool.execute('DELETE FROM external_identities WHERE TenantId = ?', [actualTenantId]); } catch (e) {}
    try { await pool.execute('DELETE FROM SSOReplayStore WHERE TenantId = ?', [actualTenantId]); } catch (e) {}

    // 4. Delete active sessions, tokens, and Tenant Admin user credentials
    if (userIdsArray.length > 0) {
      const placeholders = userIdsArray.map(() => '?').join(',')

      try { await pool.execute(`DELETE FROM UserRefreshTokens WHERE UserId IN (${placeholders})`, userIdsArray); } catch (e) {}
      try { await pool.execute(`DELETE FROM RefreshTokens WHERE UserId IN (${placeholders})`, userIdsArray); } catch (e) {}
      try { await pool.execute(`DELETE FROM StudentSessions WHERE UserId IN (${placeholders})`, userIdsArray); } catch (e) {}
      try { await pool.execute(`DELETE FROM StudentCreditWallets WHERE UserId IN (${placeholders})`, userIdsArray); } catch (e) {}

      // Delete Tenant Admin user accounts from Users table
      if (adminEmail) {
        await pool.execute(
          `DELETE FROM Users WHERE UserId IN (${placeholders}) OR LOWER(TRIM(Email)) = ?`,
          [...userIdsArray, adminEmail]
        )
      } else {
        await pool.execute(
          `DELETE FROM Users WHERE UserId IN (${placeholders})`,
          userIdsArray
        )
      }
    } else if (adminEmail) {
      await pool.execute("DELETE FROM Users WHERE LOWER(TRIM(Email)) = ?", [adminEmail])
    }

    // 5. Unlink labs assigned to this tenant
    try {
      await pool.execute('UPDATE Labs SET TenantId = NULL WHERE TenantId = ?', [actualTenantId])
    } catch (e) {}

    // 6. Delete Tenant Entity from tenants table (Releasing reserved Slug & TenantId)
    await pool.execute('DELETE FROM tenants WHERE TenantId = ?', [actualTenantId])

    return res.status(200).json({
      success: true,
      message: `University tenant '${targetTenant.Name}' and administrator account deleted successfully. Subdomain '${targetTenant.Slug}' is released.`,
      tenantId: actualTenantId,
      slug: targetTenant.Slug,
    })
  } catch (error) {
    console.error('Error deleting university tenant:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to delete university tenant',
      error: error.message,
    })
  }
}
