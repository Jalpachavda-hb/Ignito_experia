-- ============================================================
-- Ignito Experia Migration 011: Tenant SSO, Identity & Wallet Isolation
-- Database: ignito_experia (Experia / VLab Database)
-- ============================================================

USE `ignito_experia`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table Schema Refactoring
ALTER TABLE `Users`
  MODIFY `PasswordHash` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `CreatedFrom` ENUM('LMS', 'DIRECT') NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN IF NOT EXISTS `AuthType` ENUM('LMS', 'DIRECT', 'LMS_AND_DIRECT') NOT NULL DEFAULT 'DIRECT';

-- 2. Student Profiles Schema Refactoring
ALTER TABLE `student_profiles`
  ADD COLUMN IF NOT EXISTS `TenantId` VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS `LastLmsSyncAt` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `ProfileSource` VARCHAR(50) DEFAULT 'LMS',
  ADD COLUMN IF NOT EXISTS `StudentCode` VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS `AcademicYear` VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS `EnrollmentStatus` VARCHAR(50) DEFAULT 'Active';

-- 3. External Identity Mapping Table
CREATE TABLE IF NOT EXISTS `external_identities` (
  `Id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `TenantId` VARCHAR(64) NOT NULL,
  `UserId` INT NOT NULL,
  `Provider` VARCHAR(100) NOT NULL,
  `ProviderSubject` VARCHAR(255) NOT NULL,
  `ExternalEmail` VARCHAR(255) NULL,
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_tenant_provider_subject_unique` (`TenantId`, `Provider`, `ProviderSubject`),
  INDEX `idx_ext_identity_user` (`UserId`),
  CONSTRAINT `FK_ExtIdentities_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users`(`UserId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tenant-Isolated Credit Wallets Table
CREATE TABLE IF NOT EXISTS `credit_wallets` (
  `WalletId` INT AUTO_INCREMENT PRIMARY KEY,
  `TenantId` VARCHAR(64) NOT NULL,
  `UserId` INT NOT NULL,
  `Balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `Status` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_wallet_user_tenant_unique` (`UserId`, `TenantId`),
  INDEX `idx_wallet_tenant` (`TenantId`),
  CONSTRAINT `FK_CreditWallet_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users`(`UserId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Idempotent Credit Transactions Ledger Table
CREATE TABLE IF NOT EXISTS `credit_transactions` (
  `TransactionId` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `TenantId` VARCHAR(64) NOT NULL,
  `UserId` INT NOT NULL,
  `Type` ENUM('PURCHASE', 'DEDUCTION', 'REFUND', 'BONUS') NOT NULL,
  `Source` VARCHAR(100) NOT NULL DEFAULT 'STUDENT_PURCHASE',
  `Credits` DECIMAL(10,2) NOT NULL,
  `Amount` DECIMAL(10,2) DEFAULT 0.00,
  `Currency` VARCHAR(10) DEFAULT 'INR',
  `PaymentReference` VARCHAR(255) NULL,
  `IdempotencyKey` VARCHAR(255) NULL,
  `Status` VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
  `MetadataJson` JSON NULL,
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_txn_idempotency` (`IdempotencyKey`),
  INDEX `idx_txn_user_tenant` (`UserId`, `TenantId`),
  INDEX `idx_txn_payment_ref` (`PaymentReference`),
  CONSTRAINT `FK_CreditTxn_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users`(`UserId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Protocol-Neutral SSO Replay Store Table
CREATE TABLE IF NOT EXISTS `SSOReplayStore` (
  `ReplayId` VARCHAR(255) PRIMARY KEY,
  `TenantId` VARCHAR(64) NOT NULL,
  `ExpiresAt` DATETIME NOT NULL,
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_replay_expires` (`ExpiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
