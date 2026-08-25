import crypto from "crypto";
import fs from "fs";
import path from "path";
import userRepository from "../repositories/UserRepository.js";
import sessionRepository from "../repositories/SessionRepository.js";
import refreshTokenRepository from "../repositories/RefreshTokenRepository.js";
import { signAccessToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../utils/crypto.js";
import { badRequest, unauthorized } from "../lib/errors.js";
import pool from "../lib/mysql.js";
import { ENV } from "../config/env.js";

import { ROLES } from "../constants/roles.js";

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

    const rawRole = (userPayload.role || "").toUpperCase().replace(/\s+/g, "_");
    const normalizedRole = ["TENANT_ADMIN", "TENANTADMIN", "SUPER_ADMIN", "SUPERADMIN", "ADMIN"].includes(rawRole)
      ? ROLES.TENANT_ADMIN
      : ROLES.STUDENT;

    // Ensure local user record exists in VLab DB for foreign key compliance
    let vlabUserId = userPayload.dbUserId;
    const [vlabUsers] = await connection.query("SELECT UserId, PhoneNumber, ProfileImage FROM Users WHERE LOWER(Email) = ?", [(userPayload.email || '').toLowerCase()]);
    if (!vlabUsers.length) {
      const [insertRes] = await connection.query(
        "INSERT INTO Users (FullName, Email, PasswordHash, Role, Status, PhoneNumber) VALUES (?, ?, 'OWNER_AUTHENTICATED', ?, 'Active', ?)",
        [userPayload.name || 'Tenant Admin', userPayload.email, normalizedRole, adminPhone]
      );
      vlabUserId = insertRes.insertId;
    } else {
      vlabUserId = vlabUsers[0].UserId;
      if (adminPhone && !vlabUsers[0].PhoneNumber) {
        await connection.query(
          "UPDATE Users SET PhoneNumber = COALESCE(PhoneNumber, ?) WHERE UserId = ?",
          [adminPhone, vlabUserId]
        );
      }
    }

    if (userPayload.tenantId) {
      await connection.query(
        `INSERT INTO user_tenant_mapping (UserId, TenantId, Role, Status)
         VALUES (?, ?, ?, 'ACTIVE')
         ON DUPLICATE KEY UPDATE Role = VALUES(Role), Status = 'ACTIVE'`,
        [vlabUserId, userPayload.tenantId, normalizedRole]
      );
    }

    const sessionId = crypto.randomUUID();

    const accessToken = signAccessToken({
      id: vlabUserId,
      userId: vlabUserId,
      name: userPayload.name,
      email: userPayload.email,
      role: normalizedRole,
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
        role: normalizedRole,
        status: userPayload.status || "ACTIVE",
        tenantId: userPayload.tenantId,
        tenantSlug: userPayload.tenantSlug,
        tenantName: userPayload.tenantName,
        profileImage: userPayload.profileImage || (vlabUsers[0] ? vlabUsers[0].ProfileImage : null)
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
    const { fullName, email, password, role, slug, profileImage, photo, mobileNumber, phoneNumber } = userData;
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

    let finalProfileImage = profileImage || photo || null;

    if (finalProfileImage && typeof finalProfileImage === 'string' && finalProfileImage.startsWith('data:image')) {
      try {
        const base64Data = finalProfileImage.replace(/^data:image\/\w+;base64,/, "");
        const filename = `profile_reg_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
        const uploadsDir = path.join(process.cwd(), "uploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const uploadPath = path.join(uploadsDir, filename);
        fs.writeFileSync(uploadPath, Buffer.from(base64Data, 'base64'));
        finalProfileImage = `/uploads/${filename}`;
      } catch (e) {
        console.error("Error saving registration profile image:", e);
        finalProfileImage = null;
      }
    }
 
    const passwordHash = hashPassword(password);
   
    return await userRepository.insert({
      fullName: fullName || "New User",
      email,
      phoneNumber: mobileNumber || phoneNumber || null,
      passwordHash,
      role: ROLES.STUDENT,
      status: "Active",
      createdFrom: "DIRECT",
      authType: "DIRECT",
      profileImage: finalProfileImage
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
        status: user.Status,
        profileImage: user.ProfileImage || null
      },
      sessionMeta
    });
  }

  async refresh({ refreshToken, ipAddress, browser, os, device }) {
    if (!refreshToken) {
      throw unauthorized("Missing refresh token");
    }

    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const storedToken = await refreshTokenRepository.findByTokenHash(tokenHash);

    if (!storedToken) {
      throw unauthorized("Invalid or expired refresh token");
    }

    const connection = await pool.getConnection();
    try {
      await refreshTokenRepository.revoke(storedToken.Id, connection);
      connection.release();
    } catch (err) {
      connection.release();
      throw err;
    }

    let userPayload = null;
    if (storedToken.UserId) {
      const user = await userRepository.findById(storedToken.UserId).catch(() => null);
      if (user) {
        userPayload = {
          id: user.UserId,
          dbUserId: user.UserId,
          name: user.FullName || user.Name,
          email: user.Email,
          role: user.Role || 'Student',
          roleId: user.RoleId || 1,
          tenantId: user.TenantId || null,
          status: user.Status || 'Active'
        };
      } else {
        const [tenantRows] = await pool.query(
          "SELECT * FROM tenants WHERE TenantId = ? OR DbId = ?",
          [storedToken.UserId, storedToken.UserId]
        );
        if (tenantRows.length > 0) {
          const tenant = tenantRows[0];
          userPayload = {
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
          };
        }
      }
    }

    if (!userPayload) {
      throw unauthorized("User associated with refresh token not found");
    }

    return await createVLabSession({
      userPayload,
      sessionMeta: { ipAddress, browser, os, device }
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
