-- Migration 020: Live Hotfix for RuntimeStopWorker, SessionExpiryWorker, and Wallet/Token System
USE `ignito_experia`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Ensure all missing worker & billing columns on lab_sessions table
SET @dbname = DATABASE();
SET @tablename = "lab_sessions";

-- Helper procedure to add columns safely across MySQL versions
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;
DELIMITER $$
CREATE PROCEDURE AddColumnIfNotExists(
    IN tableName VARCHAR(64),
    IN columnName VARCHAR(64),
    IN columnDefinition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = tableName
          AND COLUMN_NAME = columnName
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', tableName, '` ADD COLUMN `', columnName, '` ', columnDefinition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

CALL AddColumnIfNotExists('lab_sessions', 'TokenExpiryAt', 'DATETIME NULL AFTER `StartedAt`');
CALL AddColumnIfNotExists('lab_sessions', 'LastBilledAt', 'DATETIME NULL AFTER `TokenExpiryAt`');
CALL AddColumnIfNotExists('lab_sessions', 'UnbilledSeconds', 'INT NOT NULL DEFAULT 0');
CALL AddColumnIfNotExists('lab_sessions', 'BilledTokens', 'INT NOT NULL DEFAULT 0');
CALL AddColumnIfNotExists('lab_sessions', 'LowBalanceWarningSent', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL AddColumnIfNotExists('lab_sessions', 'StopRequestedAt', 'DATETIME NULL AFTER `EndedAt`');
CALL AddColumnIfNotExists('lab_sessions', 'StopRetryCount', 'INT NOT NULL DEFAULT 0 AFTER `StopRequestedAt`');
CALL AddColumnIfNotExists('lab_sessions', 'LastStopAttemptAt', 'DATETIME NULL AFTER `StopRetryCount`');
CALL AddColumnIfNotExists('lab_sessions', 'StopError', 'TEXT NULL AFTER `LastStopAttemptAt`');
CALL AddColumnIfNotExists('lab_sessions', 'BillingStartedAt', 'DATETIME NULL');
CALL AddColumnIfNotExists('lab_sessions', 'BilledSeconds', 'INT UNSIGNED NOT NULL DEFAULT 0');
CALL AddColumnIfNotExists('lab_sessions', 'LowTokenWarningSent', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL AddColumnIfNotExists('lab_sessions', 'BillingLockUntil', 'DATETIME NULL');
CALL AddColumnIfNotExists('lab_sessions', 'BillingWorkerId', 'VARCHAR(100) NULL');

-- 2. Add indexes for lab_sessions
DROP PROCEDURE IF EXISTS AddIndexIfNotExists;
DELIMITER $$
CREATE PROCEDURE AddIndexIfNotExists(
    IN tableName VARCHAR(64),
    IN indexName VARCHAR(64),
    IN indexDefinition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = tableName
          AND INDEX_NAME = indexName
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', tableName, '` ADD INDEX `', indexName, '` ', indexDefinition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

CALL AddIndexIfNotExists('lab_sessions', 'IDX_LabSession_Expiry', '(`Status`, `TokenExpiryAt`)');
CALL AddIndexIfNotExists('lab_sessions', 'IDX_LabSession_Billing', '(`Status`, `LastBilledAt`)');

-- 3. Ensure student_lab_token_wallets table & columns
CREATE TABLE IF NOT EXISTS `student_lab_token_wallets` (
    `Id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `TenantId` VARCHAR(64) NOT NULL,
    `StudentId` VARCHAR(64) NOT NULL,
    `LabId` VARCHAR(100) NOT NULL,
    `TotalPurchasedTokens` INT NOT NULL DEFAULT 0,
    `TotalUsedTokens` INT NOT NULL DEFAULT 0,
    `ConsumedTokens` INT UNSIGNED NOT NULL DEFAULT 0,
    `RemainingTokens` INT NOT NULL DEFAULT 0,
    `CarryOverSeconds` INT NOT NULL DEFAULT 0,
    `Version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
    `Status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `UpdatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`Id`),
    UNIQUE KEY `UQ_StudentLabWallet` (`TenantId`, `StudentId`, `LabId`),
    INDEX `IDX_StudentLabWallet` (`StudentId`, `LabId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CALL AddColumnIfNotExists('student_lab_token_wallets', 'ConsumedTokens', 'INT UNSIGNED NOT NULL DEFAULT 0 AFTER `TotalPurchasedTokens`');
CALL AddColumnIfNotExists('student_lab_token_wallets', 'RemainingTokens', 'INT NOT NULL DEFAULT 0 AFTER `ConsumedTokens`');
CALL AddColumnIfNotExists('student_lab_token_wallets', 'Version', 'BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER `RemainingTokens`');
CALL AddColumnIfNotExists('student_lab_token_wallets', 'CarryOverSeconds', 'INT NOT NULL DEFAULT 0');

-- 4. Ensure credit_wallets and credit_transactions
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
  INDEX `idx_wallet_tenant` (`TenantId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  INDEX `idx_txn_payment_ref` (`PaymentReference`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clean up helper procedures
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;
DROP PROCEDURE IF EXISTS AddIndexIfNotExists;

SET FOREIGN_KEY_CHECKS = 1;
