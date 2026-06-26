import crypto from "crypto";

/**
 * Generate a secure PBKDF2 hash for a password.
 * @param {string} password 
 * @returns {string} The formatted salt and hash
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored PBKDF2 hash.
 * @param {string} password 
 * @param {string} storedHash 
 * @returns {boolean} True if the password matches, false otherwise
 */
export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, hash] = storedHash.split(":");
  const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return hash === testHash;
}
