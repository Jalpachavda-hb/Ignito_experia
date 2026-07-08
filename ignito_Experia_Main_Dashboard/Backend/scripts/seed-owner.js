/**
 * Run this script to generate the bcrypt hash for the owner user password.
 * Usage: node scripts/seed-owner.js
 * Then copy the hash into schema.sql or run the INSERT directly in MySQL.
 */
import bcrypt from "bcryptjs";
import pool from "../config/db.js";

const OWNER_EMAIL = "owner@ignito.com";
const OWNER_PASSWORD = "Owner@1234";
const OWNER_NAME = "Platform Owner";

async function seedOwner() {
  console.log("Generating password hash...");
  const hash = await bcrypt.hash(OWNER_PASSWORD, 10);
  console.log("Hash:", hash);

  try {
    const [result] = await pool.query(
      `INSERT INTO owner_users (FullName, Email, PasswordHash, Role, Status)
       VALUES (?, ?, ?, 'owner', 'active')
       ON DUPLICATE KEY UPDATE PasswordHash = VALUES(PasswordHash)`,
      [OWNER_NAME, OWNER_EMAIL, hash]
    );
    console.log(`Owner user seeded: ${OWNER_EMAIL} (affected rows: ${result.affectedRows})`);
  } catch (err) {
    console.error("Failed to seed owner:", err.message);
    console.log("\nRun this SQL manually instead:");
    console.log(`INSERT INTO owner_users (FullName, Email, PasswordHash, Role, Status)`);
    console.log(`VALUES ('${OWNER_NAME}', '${OWNER_EMAIL}', '${hash}', 'owner', 'active')`);
    console.log(`ON DUPLICATE KEY UPDATE PasswordHash = '${hash}';`);
  }

  process.exit(0);
}

seedOwner();
