import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ownerAuthRepository } from "../repositories/ownerAuthRepository.js";
import { ENV } from "../config/env.js";

class AuthService {
  async login(email, password) {
    const owner = await ownerAuthRepository.findByEmail(email);
    if (!owner) throw new Error("Invalid email or password");

    const isValid = await bcrypt.compare(password, owner.PasswordHash);
    if (!isValid) throw new Error("Invalid email or password");

    const payload = {
      ownerId: owner.OwnerId,
      email: owner.Email,
      fullName: owner.Email,
      phoneNumber: owner.PhoneNumber,
      role: owner.Role,
    };

    const token = jwt.sign(payload, ENV.jwtSecret, { expiresIn: ENV.jwtExpiresIn });
    return { token, user: payload };
  }

  decodeToken(token) {
    return jwt.verify(token, ENV.jwtSecret);
  }
}

export const authService = new AuthService();
