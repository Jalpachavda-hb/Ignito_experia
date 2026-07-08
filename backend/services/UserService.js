import userRepository from "../repositories/UserRepository.js";
import { hashPassword } from "../utils/crypto.js";
import { badRequest } from "../lib/errors.js";

class UserService {
  async getAllUsers(params) {
    const result = await userRepository.getAll(params);
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 10;
    const totalPages = Math.ceil(result.total / pageSize) || 1;

    return {
      data: result.data,
      pagination: {
        total: result.total,
        page,
        pageSize,
        totalPages
      }
    };
  }

  async getUserById(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw badRequest("User not found");
    return user;
  }

  async createUser(userData) {
    const { fullName, email, phoneNumber, roleId, status, enrollmentNumber, programId, semesterId, password, createdBy } = userData;
    if (!email) throw badRequest("Email is required");
    if (!roleId) throw badRequest("Role is required");

    // Check if user already exists
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw badRequest("Email is already registered");
    }

    const passwordHash = hashPassword(password || "password123");
    
    return await userRepository.insert({
      fullName: fullName || "New User",
      email,
      phoneNumber,
      passwordHash,
      roleId,
      status: status || "Active",
      enrollmentNumber,
      programId: programId ? parseInt(programId, 10) : null,
      semesterId: semesterId ? parseInt(semesterId, 10) : null,
      createdBy: createdBy ? parseInt(createdBy, 10) : null
    });
  }

  async updateUser(userId, userData) {
    const user = await userRepository.findById(userId);
    if (!user) throw badRequest("User not found");
    
    return await userRepository.update(userId, userData);
  }

  async updateUserStatus(userId, status, updatedBy) {
    const allowedStatuses = ["Active", "Inactive", "Suspended", "Pending"];
    if (!allowedStatuses.includes(status)) {
      throw badRequest(`Invalid status. Allowed values are: ${allowedStatuses.join(", ")}`);
    }
    return await userRepository.updateStatus(userId, status, updatedBy);
  }

  async deleteUser(userId, deletedBy) {
    return await userRepository.delete(userId, deletedBy);
  }

  async addCredits(userId, amount) {
    if (!amount || amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }
    return await userRepository.addCredits(userId, amount);
  }

  async resetPassword(userId, newPassword) {
    const user = await userRepository.findById(userId);
    if (!user) throw badRequest("User not found");
    if (!newPassword) throw badRequest("New password is required");

    const passwordHash = hashPassword(newPassword);
    await userRepository.updatePassword(userId, passwordHash);
    return { success: true, message: "Password reset successfully" };
  }

  async importUsers(usersList, createdBy) {
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of usersList) {
      try {
        if (!user.email) {
          failed++;
          continue;
        }
        
        // Skip duplicate email
        const existing = await userRepository.findByEmail(user.email);
        if (existing) {
          skipped++;
          continue;
        }

        // Ideally, validate roleId, semester, program etc here.
        if (!user.roleId) {
          failed++;
          continue;
        }

        await this.createUser({
          ...user,
          createdBy,
          password: "password123" // default password for imported users
        });
        
        imported++;
      } catch (err) {
        failed++;
      }
    }

    return { imported, skipped, failed };
  }
}

export const userService = new UserService();
export default userService;
