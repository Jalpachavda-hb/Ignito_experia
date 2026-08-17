import crypto from "crypto";
import userRepository from "../repositories/UserRepository.js";
import sessionRepository from "../repositories/SessionRepository.js";
import refreshTokenRepository from "../repositories/RefreshTokenRepository.js";
import { signAccessToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../utils/crypto.js";
import { badRequest, unauthorized } from "../lib/errors.js";
import pool from "../lib/mysql.js";
import { ENV } from "../config/env.js";

const loadUserPermissions = async (roleId, connection = pool) => {
  if (!roleId) return {};
  const [rows] = await connection.query(
    "SELECT ModuleCode, CanCreate, CanRead, CanUpdate, CanDelete FROM RolePermissions WHERE RoleId = ?",
    [roleId]
  );
  const perms = {};
  for (const r of rows) {
    perms[r.ModuleCode] = {
      create: Boolean(r.CanCreate),
      read: Boolean(r.CanRead),
      update: Boolean(r.CanUpdate),
      delete: Boolean(r.CanDelete),
    };
  }
  return perms;
};

const createVLabSession = async ({ userPayload, sessionMeta }) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    let adminPhone = userPayload.phone || userPayload.mobile || null;
    if (!adminPhone && userPayload.tenantId) {
      try {
        const [tenantRows] = await connection.query("SELECT AdminPhone FROM tenants WHERE TenantId = ?", [userPayload.tenantId]);
        if (tenantRows.length > 0 && tenantRows[0].AdminPhone) {
          adminPhone = tenantRows[0].AdminPhone;
        }
      } catch (e) {}
    }

    // Ensure local user record exists in VLab DB for foreign key compliance
    let vlabUserId = userPayload.dbUserId;
    const [vlabUsers] = await connection.query("SELECT UserId, PhoneNumber, Mobile FROM Users WHERE LOWER(Email) = ?", [(userPayload.email || '').toLowerCase()]);
    if (!vlabUsers.length) {
      const [insertRes] = await connection.query(
        "INSERT INTO Users (FullName, Email, PasswordHash, Role, Status, PhoneNumber, Mobile) VALUES (?, ?, 'OWNER_AUTHENTICATED', ?, 'Active', ?, ?)",
        [userPayload.name || 'Tenant Admin', userPayload.email, userPayload.role || 'TENANT_ADMIN', adminPhone, adminPhone]
      );
      vlabUserId = insertRes.insertId;
    } else {
      vlabUserId = vlabUsers[0].UserId;
      if (adminPhone && (!vlabUsers[0].PhoneNumber || !vlabUsers[0].Mobile)) {
        await connection.query(
          "UPDATE Users SET PhoneNumber = COALESCE(PhoneNumber, ?), Mobile = COALESCE(Mobile, ?) WHERE UserId = ?",
          [adminPhone, adminPhone, vlabUserId]
        );
      }
    }

    if (userPayload.tenantId) {
      const targetRole = (userPayload.role === 'SuperAdmin' || userPayload.role === 'TENANT_ADMIN') ? 'TENANT_ADMIN' : 'STUDENT';
      await connection.query(
        `INSERT INTO user_tenant_mapping (UserId, TenantId, Role, Status)
         VALUES (?, ?, ?, 'ACTIVE')
         ON DUPLICATE KEY UPDATE Role = VALUES(Role), Status = 'ACTIVE'`,
        [vlabUserId, userPayload.tenantId, targetRole]
      );
    }

    const permissions = await loadUserPermissions(userPayload.roleId || 1, connection);
    const sessionId = crypto.randomUUID();

    const accessToken = signAccessToken({
      id: vlabUserId,
      userId: vlabUserId,
      name: userPayload.name,
      email: userPayload.email,
      role: userPayload.role || 'TENANT_ADMIN',
      roleId: userPayload.roleId || 1,
      tenantId: userPayload.tenantId,
      tenantSlug: userPayload.tenantSlug,
      tenantName: userPayload.tenantName,
      source: "DIRECT"
    });

    const refreshTokenRaw = crypto.randomBytes(40).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(refreshTokenRaw).digest("hex");
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await sessionRepository.insert({
      SessionId: sessionId,
      UserId: vlabUserId,
      AuthenticationSource: 'DIRECT',
      UniversityId: userPayload.tenantId,
      IPAddress: sessionMeta.ipAddress,
      Browser: sessionMeta.browser,
      OS: sessionMeta.os,
      Device: sessionMeta.device
    }, connection);

    await refreshTokenRepository.insert({
      UserId: vlabUserId,
      SessionId: sessionId,
      TokenHash: tokenHash,
      ExpiresAt: expiresAt
    }, connection);

    await connection.commit();
    connection.release();

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      user: {
        id: vlabUserId,
        userId: vlabUserId,
        name: userPayload.name,
        email: userPayload.email,
        role: userPayload.role || 'TENANT_ADMIN',
        roleId: userPayload.roleId || 1,
        status: userPayload.status || "ACTIVE",
        tenantId: userPayload.tenantId,
        tenantSlug: userPayload.tenantSlug,
        tenantName: userPayload.tenantName,
        permissions
      }
    };
  } catch (err) {
    await connection.rollback();
    connection.release();
    throw err;
  }
};

class AuthService {
  async register(userData) {
    const { fullName, email, password, role, slug } = userData;
    if (slug) {
      throw badRequest("Direct registration is not available on university portals. Please register on the main Experia domain.");
    }
    if (!email || !password) {
      throw badRequest("Email and password are required");
    }
 
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw badRequest("Email is already registered");
    }
 
    const passwordHash = hashPassword(password);
   
    return await userRepository.insert({
      fullName: fullName || "New User",
      email,
      passwordHash,
      role: role || "Student",
      status: "Active",
      createdFrom: "DIRECT",
      authType: "DIRECT"
    });
  }

  async login({ email, password, ipAddress, browser, os, device, host, slug: inputSlug }) {
    if (!email || !password) {
      throw badRequest("Email and password are required");
    }

    const cleanEmail = (email || "").trim().toLowerCase();
    const sessionMeta = { ipAddress, browser, os, device };

    // 1. Extract Slug from input or host header
    let slug = inputSlug || "";
    if (!slug && host) {
      const parts = host.split(":")[0].split(".");
      if (parts.length > 1 && parts[0] !== "www" && parts[0] !== "localhost" && parts[0] !== "experia") {
        slug = parts[0];
      }
    }

    // 2. Resolve Tenant from Owner Tenant API over Service-to-Service Auth
    let resolvedTenantId = null;
    let resolvedTenantName = null;
    if (slug) {
      try {
        const tenantRes = await fetch(`http://localhost:4000/api/internal/tenants/by-slug/${slug.toLowerCase()}`, {
          headers: { "X-Internal-Service-Token": ENV.internalServiceToken }
        });
        if (tenantRes.ok) {
          const tenantData = await tenantRes.json();
          if (tenantData.success) {
            if ((tenantData.status || '').toUpperCase() !== "ACTIVE") {
              throw unauthorized("This university account is currently unavailable. Please contact the platform administrator.");
            }
            resolvedTenantId = tenantData.tenantId;
            resolvedTenantName = tenantData.name;
          }
        }
      } catch (err) {
        if (err.status || err.statusCode) throw err;
      }
    }

    // 3. Backend-to-Backend Authentication via Owner Internal Auth API with Service Token
    try {
      const ownerAuthRes = await fetch("http://localhost:4000/api/internal/auth/tenant-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Service-Token": ENV.internalServiceToken
        },
        body: JSON.stringify({ tenantId: resolvedTenantId, email: cleanEmail, password })
      });

      if (ownerAuthRes.ok) {
        const authData = await ownerAuthRes.json();
        if (authData.success) {
          return await createVLabSession({
            userPayload: {
              id: authData.userId || authData.tenantId,
              dbUserId: authData.userId,
              name: authData.name || "Tenant Administrator",
              email: authData.email,
              phone: authData.phone || authData.mobile || null,
              mobile: authData.mobile || authData.phone || null,
              role: authData.role || "TENANT_ADMIN",
              roleId: 1,
              tenantId: authData.tenantId,
              tenantSlug: authData.tenantSlug || slug,
              tenantName: authData.tenantName || resolvedTenantName,
              status: "ACTIVE"
            },
            sessionMeta
          });
        }
      } else if (ownerAuthRes.status === 403) {
        const errorData = await ownerAuthRes.json().catch(() => ({}));
        throw unauthorized(errorData.message || "This university account is currently unavailable. Please contact the platform administrator.");
      }
    } catch (err) {
      if (err.status || err.statusCode) throw err;
    }

    // 4. Local Database Fallback (Direct tenants table lookup if Owner API is unreachable)
    let tenantRows = [];
    if (slug) {
      [tenantRows] = await pool.query(
        "SELECT * FROM tenants WHERE LOWER(AdminEmail) = ? AND LOWER(Slug) = ?",
        [cleanEmail, slug.toLowerCase()]
      );
    } else {
      [tenantRows] = await pool.query(
        "SELECT * FROM tenants WHERE LOWER(AdminEmail) = ?",
        [cleanEmail]
      );
    }

    if (tenantRows.length > 0) {
      const tenant = tenantRows[0];

      if ((tenant.Status || '').toUpperCase() !== "ACTIVE") {
        throw unauthorized("This university account is currently unavailable. Please contact the platform administrator.");
      }

      if (!verifyPassword(password, tenant.AdminPasswordHash)) {
        throw unauthorized("Invalid email or password");
      }

      return await createVLabSession({
        userPayload: {
          id: tenant.TenantId,
          dbUserId: tenant.DbId,
          name: tenant.AdminFullName || "Tenant Administrator",
          email: tenant.AdminEmail,
          phone: tenant.AdminPhone || null,
          mobile: tenant.AdminPhone || null,
          role: "TENANT_ADMIN",
          roleId: 1,
          tenantId: tenant.TenantId,
          tenantSlug: tenant.Slug,
          tenantName: tenant.Name,
          status: tenant.Status
        },
        sessionMeta
      });
    }

    // 5. Fallback: Check users table for regular VLab users / students
    const user = await userRepository.findByEmail(cleanEmail);
    if (!user) {
      throw unauthorized("Invalid email or password");
    }

    if ((user.Status || 'Active').toUpperCase() !== "ACTIVE") {
      throw unauthorized(`Your account is ${user.Status || 'Inactive'}. Please contact support.`);
    }

    if (!verifyPassword(password, user.PasswordHash)) {
      throw unauthorized("Invalid email or password");
    }

    // Tenant Membership Verification for Subdomain Direct Student Login
    const activeTenant = resolvedTenantId || user.TenantId || 'TEN000001';
    if (activeTenant && (user.Role || '').toUpperCase() === 'STUDENT') {
      const [mapping] = await pool.query(
        "SELECT MappingId FROM user_tenant_mapping WHERE UserId = ? AND TenantId = ?",
        [user.UserId, activeTenant]
      );
      if (!mapping.length && user.TenantId !== activeTenant) {
        // Auto-provision mapping if tenant matches user record
        await pool.query(
          "INSERT INTO user_tenant_mapping (UserId, TenantId, Role, Status) VALUES (?, ?, 'STUDENT', 'ACTIVE') ON DUPLICATE KEY UPDATE Status = 'ACTIVE'",
          [user.UserId, activeTenant]
        );
      }
    }

    await userRepository.updateLastLogin(user.UserId);

    return await createVLabSession({
      userPayload: {
        id: user.UserId,
        dbUserId: user.UserId,
        name: user.FullName,
        email: user.Email,
        role: user.Role || 'Student',
        roleId: user.RoleId || 1,
        tenantId: resolvedTenantId,
        status: user.Status
      },
      sessionMeta
    });
  }

  async logout(sessionId) {
    if (!sessionId) return;
    const connection = await pool.getConnection();
    try {
      await refreshTokenRepository.deleteBySessionId(sessionId, connection);
      await sessionRepository.updateEndedAt(sessionId, connection);
    } finally {
      connection.release();
    }
  }
}

export default new AuthService();
