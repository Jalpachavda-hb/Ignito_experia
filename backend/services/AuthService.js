import crypto from "crypto";
import userRepository from "../repositories/UserRepository.js";
import sessionRepository from "../repositories/SessionRepository.js";
import refreshTokenRepository from "../repositories/RefreshTokenRepository.js";
import { auditService } from "./AuditService.js";
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
   
    const user = await userRepository.insert({
      fullName: fullName || "New User",
      email,
      passwordHash,
      role: role || "Student",
      status: "Active"
    });
 
    return user;
  }


  

  async login({ email, password, ipAddress, browser, os, device }) {
    if (!email || !password) {
      throw badRequest("Email and password are required");
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw unauthorized("Invalid email or password");
    }

    if (user.Status !== "Active") {
      throw unauthorized(`Your account is ${user.Status}. Please contact support.`);
    }

    const isPasswordValid = verifyPassword(password, user.PasswordHash);
    if (!isPasswordValid) {
      throw unauthorized("Invalid email or password");
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      await userRepository.updateLastLogin(user.UserId);

      const permissions = await loadUserPermissions(user.RoleId, connection);
      const sessionId = crypto.randomUUID();

      const accessToken = signAccessToken({
        id: user.UserId,
        name: user.FullName,
        email: user.Email,
        role: user.Role,
        roleId: user.RoleId,
        source: "DIRECT"
      });

      const refreshTokenRaw = crypto.randomBytes(40).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(refreshTokenRaw).digest("hex");
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // We no longer require StudentProfileId for Sessions. We use UserId for all sessions.
      await sessionRepository.insert({
        SessionId: sessionId,
        UserId: user.UserId,
        AuthenticationSource: 'DIRECT',
        IPAddress: ipAddress,
        Browser: browser,
        OS: os,
        Device: device
      }, connection);

      // Using legacy UserRefreshTokens natively, but keeping naming consistent in Repo
      await refreshTokenRepository.insert({
        UserId: user.UserId,
        SessionId: sessionId,
        TokenHash: tokenHash,
        ExpiresAt: expiresAt
      }, connection);

      await connection.commit();
      connection.release();

      // Async Audit
      if (auditService) {
        auditService.log({
          SessionId: sessionId,
          UserId: user.UserId,
          AuthenticationSource: 'DIRECT',
          Action: 'LOGIN',
          Description: 'User logged in directly',
          IPAddress: ipAddress,
          Browser: browser,
          OS: os,
          Device: device
        }).catch(console.error);
      }

      return {
        user: {
          id: user.UserId,
          name: user.FullName,
          email: user.Email,
          role: user.Role,
          roleId: user.RoleId ?? null,
          status: user.Status,
          permissions,
        },
        accessToken,
        refreshToken: refreshTokenRaw,
      };
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  }

  async refresh({ refreshToken, ipAddress, browser, os, device }) {
    if (!refreshToken) throw unauthorized("Refresh token is required");

    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const dbToken = await refreshTokenRepository.findByTokenHash(tokenHash);
      if (!dbToken) {
        throw unauthorized("Invalid or expired refresh token");
      }

      const session = await sessionRepository.findById(dbToken.SessionId);
      if (!session || session.Status !== 'Active') {
        throw unauthorized("Session is no longer active");
      }

      const sessionId = crypto.randomUUID();
      const newRefreshTokenRaw = crypto.randomBytes(40).toString("hex");
      const newTokenHash = crypto.createHash("sha256").update(newRefreshTokenRaw).digest("hex");
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await refreshTokenRepository.revoke(dbToken.Id, connection);
      
      await sessionRepository.insert({
        SessionId: sessionId,
        UserId: dbToken.UserId,
        AuthenticationSource: session.AuthenticationSource,
        IPAddress: ipAddress,
        Browser: browser,
        OS: os,
        Device: device
      }, connection);

      await refreshTokenRepository.insert({
        UserId: dbToken.UserId,
        SessionId: sessionId,
        TokenHash: newTokenHash,
        ExpiresAt: expiresAt
      }, connection);

      await sessionRepository.markLogout(session.SessionId, connection);

      await connection.commit();
      connection.release();

      if (auditService) {
        auditService.log({
          SessionId: sessionId,
          UserId: dbToken.UserId,
          AuthenticationSource: session.AuthenticationSource,
          Action: 'TOKEN_REFRESH',
          Description: 'Refresh token rotated successfully',
          IPAddress: ipAddress,
          Browser: browser,
          OS: os,
          Device: device
        }).catch(console.error);
      }

      return {
        accessToken: "placeholder_new_access_token",
        refreshToken: newRefreshTokenRaw,
      };
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  }

  async logout(refreshToken) {
    if (!refreshToken) return;
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const dbToken = await refreshTokenRepository.findByTokenHash(tokenHash);
      if (dbToken) {
        await refreshTokenRepository.revoke(dbToken.Id, connection);
        const session = await sessionRepository.findById(dbToken.SessionId);
        if (session) {
            await sessionRepository.markLogout(session.SessionId, connection);
        }
      }

      await connection.commit();
      connection.release();
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  }
}


export const authService = new AuthService();
export default authService;
