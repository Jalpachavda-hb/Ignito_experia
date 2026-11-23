import crypto from "crypto";
import { promisify } from "util";
import bcrypt from "bcryptjs";

/**
 * Experia password hashing.
 *
 * Stored format (unchanged, so every existing hash keeps working):
 *   $argon2id$v=19$m=65536,t=3,p=4$<saltHex>$<hashHex>
 * Despite the prefix, the hash is PBKDF2-SHA512, 100,000 iterations, 64-byte key.
 * Legacy bcrypt hashes are still accepted.
 *
 * Both hashing and verification run on libuv's thread pool (crypto.pbkdf2 / bcrypt.compare),
 * so a login no longer blocks the event loop for every other request.
 */
const pbkdf2 = promisify(crypto.pbkdf2);
const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";
const PREFIX = "$argon2id$v=19$m=65536,t=3,p=4$";

export async function hashPassword(password) {
  if (!password) throw new Error("Password is required for hashing");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = (await pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST)).toString("hex");
  return `${PREFIX}${salt}$${hash}`;
}

export async function verifyPassword(password, hashedPassword) {
  if (!password || !hashedPassword) return false;

  if (hashedPassword.startsWith("$argon2id$")) {
    const parts = hashedPassword.split("$");
    if (parts.length >= 6) {
      const salt = parts[4];
      const storedHash = parts[5];
      if (!/^[0-9a-f]+$/i.test(storedHash || "")) return false;
      const stored = Buffer.from(storedHash, "hex");
      const calc = await pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
      return stored.length === calc.length && crypto.timingSafeEqual(stored, calc);
    }
    return false;
  }

  // Legacy bcrypt hashes
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch {
    return false;
  }
}
