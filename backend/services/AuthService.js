import crypto from "crypto";
import userRepository from "../repositories/UserRepository.js";
import sessionRepository from "../repositories/SessionRepository.js";
import refreshTokenRepository from "../repositories/RefreshTokenRepository.js";
import { signAccessToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../utils/crypto.js";
import { badRequest, unauthorized } from "../lib/errors.js";
import pool from "../lib/mysql.js";

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
    const permissions = await loadUserPermissions(userPayload.roleId || 1, connection);
    const sessionId = crypto.randomUUID();

    const accessToken = signAccessToken({
      id: userPayload.id,
      name: userPayload.name,
      email: userPayload.email,
      role: userPayload.role,
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
      UserId: userPayload.dbUserId || 1,
      AuthenticationSource: 'DIRECT',
      IPAddress: sessionMeta.ipAddress,
      Browser: sessionMeta.browser,
      OS: sessionMeta.os,
      Device: sessionMeta.device
    }, connection);

    await refreshTokenRepository.insert({
      UserId: userPayload.dbUserId || 1,
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
        id: userPayload.id,
        name: userPayload.name,
        email: userPayload.email,
        role: userPayload.role,
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
    const { fullName, email, password, role } = userData;
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
      status: "Active"
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
      if (parts.length > 1 && parts[0] !== "www" && parts[0] !== "localhost") {
        slug = parts[0];
      }
    }

    // 2. Resolve Tenant from Owner Tenant API
    let resolvedTenantId = null;
    if (slug) {
      try {
        const tenantRes = await fetch(`http://localhost:4000/api/internal/tenants/by-slug/${slug.toLowerCase()}`);
        if (tenantRes.ok) {
          const tenantData = await tenantRes.json();
          if (tenantData.success) {
            if ((tenantData.status || '').toUpperCase() !== "ACTIVE") {
              throw unauthorized("This university account is currently unavailable. Please contact the platform administrator.");
            }
            resolvedTenantId = tenantData.tenantId;
          }
        }
      } catch (err) {
        if (err.status || err.statusCode) throw err;
      }
    }

    // 3. Backend-to-Backend Authentication via Owner Internal Auth API
    try {
      const ownerAuthRes = await fetch("http://localhost:4000/api/internal/auth/tenant-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: resolvedTenantId, email: cleanEmail, password })
      });

      if (ownerAuthRes.ok) {
        const authData = await ownerAuthRes.json();
        if (authData.success) {
          return await createVLabSession({
            userPayload: {
              id: authData.userId || authData.tenantId,
              dbUserId: authData.userId || 1,
              name: authData.name || "Tenant Administrator",
              email: authData.email,
              role: "SuperAdmin",
              roleId: 1,
              tenantId: authData.tenantId,
              tenantSlug: authData.tenantSlug || slug,
              tenantName: authData.tenantName,
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
          role: "SuperAdmin",
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

    if ((user.Status || '').toUpperCase() !== "ACTIVE") {
      throw unauthorized(`Your account is ${user.Status}. Please contact support.`);
    }

    if (!verifyPassword(password, user.PasswordHash)) {
      throw unauthorized("Invalid email or password");
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
