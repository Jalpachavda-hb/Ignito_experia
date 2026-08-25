-- Migration 012: Lab Credit Consumption, Session Duration & Extension Management Schema

USE `ignito_experia`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Create or ensure credit_wallets table
CREATE TABLE IF NOT EXISTS `credit_wallets` (
  `WalletId` INT AUTO_INCREMENT PRIMARY KEY,
  `TenantId` VARCHAR(64) NOT NULL,
  `UserId` INT NOT NULL,
  `TotalPurchasedCredits` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `ConsumedCredits` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `ReservedCredits` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `Balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `Status` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_wallet_user_tenant_unique` (`UserId`, `TenantId`),
  INDEX `idx_wallet_tenant` (`TenantId`),
  CONSTRAINT `FK_CreditWallet_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users`(`UserId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create or ensure credit_transactions table
CREATE TABLE IF NOT EXISTS `credit_transactions` (
  `TransactionId` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `TenantId` VARCHAR(64) NOT NULL,
  `UserId` INT NOT NULL,
  `Type` ENUM('PURCHASE', 'DEDUCTION', 'LAB_USAGE', 'LAB_EXTENSION', 'REFUND', 'BONUS', 'ADJUSTMENT') NOT NULL,
  `Source` VARCHAR(100) NOT NULL DEFAULT 'STUDENT_PORTAL',
  `Credits` DECIMAL(10,2) NOT NULL,
  `Amount` DECIMAL(10,2) DEFAULT 0.00,
  `Currency` VARCHAR(10) DEFAULT 'INR',
  `PaymentReference` VARCHAR(255) NULL,
  `LabId` VARCHAR(100) NULL,
  `LabSessionId` VARCHAR(100) NULL,
  `IdempotencyKey` VARCHAR(255) NULL,
  `Status` VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
  `MetadataJson` JSON NULL,
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_txn_idempotency` (`IdempotencyKey`),
  INDEX `idx_txn_user_tenant` (`UserId`, `TenantId`),
  INDEX `idx_txn_payment_ref` (`PaymentReference`),
  CONSTRAINT `FK_CreditTxn_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users`(`UserId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create lab_sessions table
CREATE TABLE IF NOT EXISTS `lab_sessions` (
  `SessionId` VARCHAR(100) PRIMARY KEY,
  `TenantId` VARCHAR(64) NOT NULL,
  `UserId` INT NOT NULL,
  `LabId` VARCHAR(100) NOT NULL,
  `AllocatedCredits` INT NOT NULL DEFAULT 0,
  `AllocatedDurationMinutes` INT NOT NULL DEFAULT 0,
  `FinalCreditsConsumed` DECIMAL(10,2) NULL,
  `StartedAt` DATETIME NOT NULL,
  `ExpiresAt` DATETIME NOT NULL,
  `EndedAt` DATETIME NULL,
  `Status` ENUM('PENDING', 'STARTING', 'RUNNING', 'EXPIRING_SOON', 'STOPPING', 'COMPLETED', 'EXPIRED', 'FAILED') NOT NULL DEFAULT 'STARTING',
  `TenMinuteWarningSent` TINYINT(1) NOT NULL DEFAULT 0,
  `TaskArn` VARCHAR(255) NULL,
  `ContainerId` VARCHAR(255) NULL,
  `RuntimeUrl` VARCHAR(255) NULL,
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `IDX_LabSess_User_Tenant` (`UserId`, `TenantId`),
  INDEX `IDX_LabSess_Status_Expires` (`Status`, `ExpiresAt`),
  CONSTRAINT `FK_LabSession_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users`(`UserId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
