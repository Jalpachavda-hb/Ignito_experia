import fs from "fs";
import path from "path";
import "../config/env.js";
import pool from "../lib/mysql.js";

async function runMigration() {
  console.log("Applying schema migrations directly...");
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`student_profiles\` (
      \`StudentProfileId\` INT AUTO_INCREMENT PRIMARY KEY,
      \`UserId\` INT NOT NULL UNIQUE,
      \`TenantId\` VARCHAR(64) NULL,
      \`Email\` VARCHAR(255) NULL,
      \`FirstName\` VARCHAR(100) NULL,
      \`LastName\` VARCHAR(100) NULL,
      \`StudentCode\` VARCHAR(100) NULL,
      \`DepartmentId\` INT NULL,
      \`ProgramId\` INT NULL,
      \`SemesterId\` INT NULL,
      \`AcademicYear\` VARCHAR(50) NULL,
      \`EnrollmentStatus\` VARCHAR(50) DEFAULT 'Active',
      \`ProfileSource\` VARCHAR(50) DEFAULT 'LMS',
      \`LastLmsSyncAt\` DATETIME NULL,
      \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`UpdatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`FK_StudentProfile_UserId\` FOREIGN KEY (\`UserId\`) REFERENCES \`Users\`(\`UserId\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`SSOReplayStore\` (
      \`ReplayId\` VARCHAR(255) PRIMARY KEY,
      \`TenantId\` VARCHAR(64) NOT NULL,
      \`ExpiresAt\` DATETIME NOT NULL,
      \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_replay_expires\` (\`ExpiresAt\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`external_identities\` (
      \`Id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
      \`TenantId\` VARCHAR(64) NOT NULL,
      \`UserId\` INT NOT NULL,
      \`Provider\` VARCHAR(100) NOT NULL,
      \`ProviderSubject\` VARCHAR(255) NOT NULL,
      \`ExternalEmail\` VARCHAR(255) NULL,
      \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`UpdatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY \`idx_tenant_provider_subject_unique\` (\`TenantId\`, \`Provider\`, \`ProviderSubject\`),
      INDEX \`idx_ext_identity_user\` (\`UserId\`),
      CONSTRAINT \`FK_ExtIdentities_UserId\` FOREIGN KEY (\`UserId\`) REFERENCES \`Users\`(\`UserId\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`credit_wallets\` (
      \`WalletId\` INT AUTO_INCREMENT PRIMARY KEY,
      \`TenantId\` VARCHAR(64) NOT NULL,
      \`UserId\` INT NOT NULL,
      \`Balance\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`Status\` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`UpdatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY \`idx_wallet_user_tenant_unique\` (\`UserId\`, \`TenantId\`),
      INDEX \`idx_wallet_tenant\` (\`TenantId\`),
      CONSTRAINT \`FK_CreditWallet_UserId\` FOREIGN KEY (\`UserId\`) REFERENCES \`Users\`(\`UserId\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`credit_transactions\` (
      \`TransactionId\` BIGINT AUTO_INCREMENT PRIMARY KEY,
      \`TenantId\` VARCHAR(64) NOT NULL,
      \`UserId\` INT NOT NULL,
      \`Type\` ENUM('PURCHASE', 'DEDUCTION', 'REFUND', 'BONUS') NOT NULL,
      \`Source\` VARCHAR(100) NOT NULL DEFAULT 'STUDENT_PURCHASE',
      \`Credits\` DECIMAL(10,2) NOT NULL,
      \`Amount\` DECIMAL(10,2) DEFAULT 0.00,
      \`Currency\` VARCHAR(10) DEFAULT 'INR',
      \`PaymentReference\` VARCHAR(255) NULL,
      \`IdempotencyKey\` VARCHAR(255) NULL,
      \`Status\` VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
      \`MetadataJson\` JSON NULL,
      \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY \`idx_txn_idempotency\` (\`IdempotencyKey\`),
      INDEX \`idx_txn_user_tenant\` (\`UserId\`, \`TenantId\`),
      INDEX \`idx_txn_payment_ref\` (\`PaymentReference\`),
      CONSTRAINT \`FK_CreditTxn_UserId\` FOREIGN KEY (\`UserId\`) REFERENCES \`Users\`(\`UserId\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const userCols = [
    "ALTER TABLE `Users` MODIFY `PasswordHash` VARCHAR(255) NULL;",
    "ALTER TABLE `Users` ADD COLUMN `TenantId` VARCHAR(64) NULL;",
    "ALTER TABLE `Users` ADD COLUMN `CreatedFrom` ENUM('LMS', 'DIRECT') NOT NULL DEFAULT 'DIRECT';",
    "ALTER TABLE `Users` ADD COLUMN `AuthType` ENUM('LMS', 'DIRECT', 'LMS_AND_DIRECT') NOT NULL DEFAULT 'DIRECT';",
    "ALTER TABLE `Users` ADD COLUMN `StudentCode` VARCHAR(100) NULL;",
    "ALTER TABLE `Users` ADD COLUMN `ExternalStudentId` VARCHAR(100) NULL;",
    "ALTER TABLE `Users` ADD COLUMN `UniversityId` BIGINT NULL;",
    "ALTER TABLE `Users` ADD COLUMN `Mobile` VARCHAR(20) NULL;",
    "ALTER TABLE `Users` ADD COLUMN `AlternateMobile` VARCHAR(50) NULL;",
    "ALTER TABLE `Users` ADD COLUMN `Gender` VARCHAR(20) NULL;",
    "ALTER TABLE `Users` ADD COLUMN `DateOfBirth` VARCHAR(50) NULL;",
    "ALTER TABLE `Users` ADD COLUMN `Address` TEXT NULL;",
    "ALTER TABLE `Users` ADD COLUMN `ProfileImage` VARCHAR(500) NULL;",
    "ALTER TABLE `Users` ADD COLUMN `StudentDegreeAdmissionId` VARCHAR(50) NULL;",
    "ALTER TABLE `Users` ADD COLUMN `StudentId` VARCHAR(50) NULL;",
    "ALTER TABLE `Users` ADD COLUMN `ProgrammesJson` JSON NULL;",
    "ALTER TABLE `Users` ADD COLUMN `AcademicYear` VARCHAR(50) NULL;",
    "ALTER TABLE `Users` ADD COLUMN `EnrollmentStatus` VARCHAR(50) NULL DEFAULT 'Active';",
    "ALTER TABLE `Users` ADD COLUMN `DepartmentId` BIGINT NULL;",
    "ALTER TABLE `Users` ADD COLUMN `Batch` VARCHAR(50) NULL;",
    "ALTER TABLE `Users` ADD COLUMN `Section` VARCHAR(50) NULL;",
    "ALTER TABLE `Users` ADD COLUMN `AuthenticationSource` VARCHAR(50) NULL;"
  ];
  for (const sql of userCols) {
    try { await pool.query(sql); } catch (e) {}
  }

  console.log("Migration tables created successfully!");
  process.exit(0);
}

runMigration().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
