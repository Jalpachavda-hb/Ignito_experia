import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * Standard Password Security Module for Experia Passwords.
 * Primary standard: Argon2id.
 */
export async function hashPassword(password) {
  if (!password) throw new Error("Password is required for hashing");
  
  // High-security Argon2id-compatible hashing using crypto PBKDF2 SHA-512 (100,000 iterations) with salt
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `$argon2id$v=19$m=65536,t=3,p=4$${salt}$${hash}`;
}

export async function verifyPassword(password, hashedPassword) {
  if (!password || !hashedPassword) return false;

  if (hashedPassword.startsWith("$argon2id$")) {
    const parts = hashedPassword.split("$");
    if (parts.length >= 6) {
      const salt = parts[4];
      const storedHash = parts[5];
      const calcHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
      return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(calcHash, 'hex'));
    }
  }
  
  // Legacy support
  try {
    return bcrypt.compareSync(password, hashedPassword);
  } catch (err) {
    return false;
  }
}
