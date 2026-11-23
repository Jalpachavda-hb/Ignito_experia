import crypto from "crypto";
import { promisify } from "util";
import bcrypt from "bcryptjs";
import { hashPassword as hashStrong, verifyPassword as verifyStrong } from "../lib/password.js";

const pbkdf2 = promisify(crypto.pbkdf2);

/**
 * Hash a new password. New hashes use the same strong format as lib/password.js
 * (PBKDF2-SHA512, 100,000 iterations). Async: runs off the event loop.
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  return hashStrong(password);
}

/**
 * Verify a password against any stored format still found in the database:
 *   - "$argon2id$..." (PBKDF2-SHA512, 100k iterations)
 *   - bcrypt "$2a$/$2b$/$2y$" (Owner Dashboard tenant provisioning)
 *   - legacy "salt:hash" (PBKDF2-SHA512, 1,000 iterations)
 * Async: MUST be awaited. A missing await would make every check pass.
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;
  try {
    if (storedHash.startsWith("$argon2id$")) {
      return await verifyStrong(password, storedHash);
    }
    if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
      return await bcrypt.compare(password, storedHash);
    }
    if (storedHash.includes(":")) {
      const [salt, hash] = storedHash.split(":");
      if (!salt || !hash || !/^[0-9a-f]+$/i.test(hash)) return false;
      const stored = Buffer.from(hash, "hex");
      const calc = await pbkdf2(password, salt, 1000, 64, "sha512");
      return stored.length === calc.length && crypto.timingSafeEqual(stored, calc);
    }
  } catch {
    return false;
  }
  return false;
}
