import userRepository from "../repositories/UserRepository.js";
import { hashPassword } from "../utils/crypto.js";
import { badRequest } from "../lib/errors.js";

class UserService {
  async getAllUsers() {
    return await userRepository.getAll();
  }

  async getUserById(userId) {
    return await userRepository.findById(userId);
  }

  async createUser(userData) {
    const { name, email, password, role, programId, semesterId, createdBy } = userData;
    if (!email) throw badRequest("Email is required");

    // Check if user already exists
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw badRequest("Email is already registered");
    }

    const passwordHash = hashPassword(password || "password123");
    return await userRepository.insert({
      fullName: name || "New User",
      email,
      passwordHash,
      role: role || "Student",
      status: "Active",
      programId: programId ? parseInt(programId, 10) : null,
      semesterId: semesterId ? parseInt(semesterId, 10) : null,
      createdBy: createdBy ? parseInt(createdBy, 10) : null
    });
  }

  async updateUserStatus(userId, status, updatedBy) {
    const allowedStatuses = ["Active", "Inactive", "Suspended", "Pending"];
    if (!allowedStatuses.includes(status)) {
      throw badRequest(`Invalid status. Allowed values are: ${allowedStatuses.join(", ")}`);
    }
    return await userRepository.updateStatus(userId, status, updatedBy);
  }
}

export const userService = new UserService();
export default userService;
