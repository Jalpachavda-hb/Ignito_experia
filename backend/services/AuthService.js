import crypto from "crypto";
import userRepository from "../repositories/UserRepository.js";
import { signAccessToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../utils/crypto.js";
import { badRequest, unauthorized } from "../lib/errors.js";
import { sendWelcomeEmail } from "./EmailService.js";
import pool from "../lib/mysql.js";

const loadUserPermissions = async (roleId) => {
  if (!roleId) return {};
  const [rows] = await pool.query(
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
  async register(registerData) {
    const { fullName, email, password, confirmPassword } = registerData;

    if (!fullName || !email || !password || !confirmPassword) {
      throw badRequest("All fields are required");
    }

    if (password !== confirmPassword) {
      throw badRequest("Passwords do not match");
    }

    // Password strength check
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      throw badRequest(
        "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
      );
    }

    // Check unique email
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw badRequest("Email is already registered");
    }

    const passwordHash = hashPassword(password);
    
    // Register as Student
    const newUser = await userRepository.insert({
      fullName,
      email,
      passwordHash,
      role: "Student",
      status: "Active"
    });

    // Send welcome email — non-blocking: failure does NOT prevent registration
    sendWelcomeEmail({ to: email, fullName }).catch((err) =>
      console.error("[AuthService] Welcome email failed:", err.message)
    );

    return newUser;
  }

  async login({ email, password }) {
    if (!email || !password) {
      throw badRequest("Email and password are required");
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw unauthorized("Invalid email or password");
    }

    // Verify status
    if (user.Status !== "Active") {
      throw unauthorized(`Your account is ${user.Status}. Please contact support.`);
    }

    // Verify password hash
    const isPasswordValid = verifyPassword(password, user.PasswordHash);
    if (!isPasswordValid) {
      throw unauthorized("Invalid email or password");
    }

    // Generate tokens
    const accessToken = signAccessToken({
      id: user.UserId,
      name: user.FullName,
      email: user.Email,
      role: user.Role,
      roleId: user.RoleId,
    });

    const refreshToken = crypto.randomBytes(40).toString("hex");
    
    // Refresh token expiry: 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Save refresh token to DB
    await userRepository.insertRefreshToken(user.UserId, refreshToken, expiresAt);

    // Update last login
    await userRepository.updateLastLogin(user.UserId);

    const permissions = await loadUserPermissions(user.RoleId);

    return {
      user: {
        id: user.UserId,
        name: user.FullName,
        email: user.Email,
        role: user.Role,
        roleId: user.RoleId ?? null,
        status: user.Status,
        programId: user.ProgramId,
        semesterId: user.SemesterId,
        permissions,
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(oldRefreshToken) {
    if (!oldRefreshToken) {
      throw unauthorized("Refresh token is required");
    }

    // Find token in DB
    const dbToken = await userRepository.findRefreshToken(oldRefreshToken);
    if (!dbToken) {
      throw unauthorized("Invalid or expired refresh token");
    }

    // Get user
    const user = await userRepository.findById(dbToken.UserId);
    if (!user || user.Status !== "Active") {
      throw unauthorized("User is inactive or not found");
    }

    // Generate new tokens
    const accessToken = signAccessToken({
      id: user.UserId,
      name: user.FullName,
      email: user.Email,
      role: user.Role,
      roleId: user.RoleId,
    });

    const newRefreshToken = crypto.randomBytes(40).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Rotate refresh token: revoke old and save new
    await userRepository.revokeRefreshToken(oldRefreshToken);
    await userRepository.insertRefreshToken(user.UserId, newRefreshToken, expiresAt);

    const permissions = await loadUserPermissions(user.RoleId);

    return {
      user: {
        id: user.UserId,
        name: user.FullName,
        email: user.Email,
        role: user.Role,
        roleId: user.RoleId ?? null,
        status: user.Status,
        programId: user.ProgramId,
        semesterId: user.SemesterId,
        permissions,
      },
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken) {
    if (refreshToken) {
      await userRepository.revokeRefreshToken(refreshToken);
    }
  }
}

export const authService = new AuthService();
export default authService;
