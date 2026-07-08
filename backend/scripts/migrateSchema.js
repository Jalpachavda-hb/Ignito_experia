// Deprecated
import "dotenv/config";
import pool from "../lib/mysql.js";

async function runSchemaMigrations() {
  try {
    console.log("Checking and updating Users table schema...");

    // 1. Add IsDeleted, DeletedAt, DeletedBy to Users table
    try {
      await pool.query(`
        ALTER TABLE Users 
        ADD COLUMN IsDeleted BOOLEAN DEFAULT 0,
        ADD COLUMN DeletedAt DATETIME NULL,
        ADD COLUMN DeletedBy INT NULL;
      `);
      console.log("✅ Added soft-delete columns (IsDeleted, DeletedAt, DeletedBy) to Users table.");
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log("ℹ️ Soft-delete columns already exist in Users table.");
      } else {
        throw err;
      }
    }

    try {
      await pool.query(`
        ALTER TABLE Users 
        ADD COLUMN PhoneNumber VARCHAR(50) NULL;
      `);
      console.log("✅ Added PhoneNumber to Users table.");
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log("ℹ️ PhoneNumber column already exists in Users table.");
      } else {
        throw err;
      }
    }

    // 2. Create StudentCreditWallets table if not exists
    console.log("Checking StudentCreditWallets table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS StudentCreditWallets (
        WalletId INT AUTO_INCREMENT PRIMARY KEY,
        UserId INT NOT NULL,
        Balance DECIMAL(10,2) DEFAULT 0.00,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_wallet_user FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE
      );
    `);
    console.log("✅ StudentCreditWallets table is ready.");

    console.log("🎉 All schema migrations completed successfully.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

runSchemaMigrations();
