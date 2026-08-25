import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ownerAuthRepository } from "../repositories/ownerAuthRepository.js";
import { getDbPool } from "../config/db.js";
import { ENV } from "../config/env.js";

class AuthService {
  async login(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();

    // 1. Check Super Owner Users Table
    const owner = await ownerAuthRepository.findByEmail(cleanEmail);
    if (owner) {
      const isValid = await bcrypt.compare(password, owner.PasswordHash);
      if (!isValid) throw new Error("Invalid email or password");

      const payload = {
        ownerId: owner.OwnerId,
        email: owner.Email,
        fullName: owner.FullName || 'Platform Owner',
        phoneNumber: owner.PhoneNumber || '',
        designation: owner.Designation || 'Platform Owner',
        organization: owner.Organization || 'Ignito Experia Owner',
        avatarUrl: owner.AvatarUrl || '',
        role: owner.Role || 'owner',
      };

      const token = jwt.sign(payload, ENV.jwtSecret, { expiresIn: ENV.jwtExpiresIn });
      return { token, user: payload };
    }

    // 2. Check Tenants Table directly for Tenant Admin matching AdminEmail
    const pool = getDbPool();
    if (pool) {
      const [tenantRows] = await pool.execute(
        `SELECT 
          DbId,
          TenantId,
          Name as TenantName,
          Slug as TenantSlug,
          AdminFullName,
          AdminEmail,
          AdminPasswordHash,
          AdminPhone,
          Status as TenantStatus
        FROM tenants
        WHERE LOWER(AdminEmail) = ?`,
        [cleanEmail]
      );

      if (tenantRows.length > 0) {
        const tenantAdmin = tenantRows[0];
        const isValid = await bcrypt.compare(password, tenantAdmin.AdminPasswordHash);
        if (!isValid) throw new Error("Invalid email or password");

        if ((tenantAdmin.TenantStatus || '').toUpperCase() !== 'ACTIVE') {
          throw new Error("University Tenant account is inactive");
        }

        const payload = {
          userId: tenantAdmin.DbId,
          email: tenantAdmin.AdminEmail,
          fullName: tenantAdmin.AdminFullName,
          phoneNumber: tenantAdmin.AdminPhone,
          role: 'TENANT_ADMIN',
          tenantId: tenantAdmin.TenantId,
          tenantSlug: tenantAdmin.TenantSlug,
          tenantName: tenantAdmin.TenantName,
        };

        const token = jwt.sign(payload, ENV.jwtSecret, { expiresIn: ENV.jwtExpiresIn });
        return { token, user: payload };
      }
    }

    throw new Error("Invalid email or password");
  }

  async getProfile(ownerId) {
    const owner = await ownerAuthRepository.findById(ownerId);
    if (!owner) throw new Error("Owner user not found");
    return {
      ownerId: owner.OwnerId,
      fullName: owner.FullName || 'Platform Owner',
      email: owner.Email,
      phoneNumber: owner.PhoneNumber || '',
      designation: owner.Designation || 'Platform Owner',
      organization: owner.Organization || 'Ignito Experia Owner',
      avatarUrl: owner.AvatarUrl || '',
      role: owner.Role || 'owner',
    };
  }

  async updateProfile(ownerId, profileData) {
    const updatePayload = {
      fullName: profileData.fullName,
      email: profileData.email,
      phoneNumber: profileData.phoneNumber || profileData.mobile,
      designation: profileData.designation,
      organization: profileData.organization,
      avatarUrl: profileData.avatarUrl,
    };

    if (profileData.password) {
      updatePayload.passwordHash = await bcrypt.hash(profileData.password, 10);
    }

    const updated = await ownerAuthRepository.updateOwnerProfile(ownerId, updatePayload);
    if (!updated) throw new Error("Failed to update profile");

    const userPayload = {
      ownerId: updated.OwnerId,
      email: updated.Email,
      fullName: updated.FullName || 'Platform Owner',
      phoneNumber: updated.PhoneNumber || '',
      designation: updated.Designation || 'Platform Owner',
      organization: updated.Organization || 'Ignito Experia Owner',
      avatarUrl: updated.AvatarUrl || '',
      role: updated.Role || 'owner',
    };

    const token = jwt.sign(userPayload, ENV.jwtSecret, { expiresIn: ENV.jwtExpiresIn });
    return { user: userPayload, token };
  }

  decodeToken(token) {
    return jwt.verify(token, ENV.jwtSecret);
  }
}


export const authService = new AuthService();
