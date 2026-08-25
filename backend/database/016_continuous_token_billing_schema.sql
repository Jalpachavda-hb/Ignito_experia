-- DDL Migration: Continuous Minute-Wise Token Billing Engine
-- Schema version: 016_continuous_token_billing_schema.sql

-- 1. Owner-Managed Dynamic Token Packages per Lab
CREATE TABLE IF NOT EXISTS `lab_token_packages` (
    `Id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `LabId` BIGINT UNSIGNED NOT NULL,
    `TokenQuantity` INT UNSIGNED NOT NULL,
    `PriceAmount` DECIMAL(12,2) NOT NULL,
    `Currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
    `IsActive` TINYINT(1) NOT NULL DEFAULT 1,
    `DisplayOrder` INT NOT NULL DEFAULT 0,
    `CreatedBy` BIGINT UNSIGNED NULL,
    `UpdatedBy` BIGINT UNSIGNED NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `UpdatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `UQ_Lab_Token_Package` (`LabId`, `TokenQuantity`),
    INDEX `IDX_Lab_Package_Active` (`LabId`, `IsActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Student Lab-Specific Token Wallets (StudentId + TenantId + LabId -> One Wallet)
CREATE TABLE IF NOT EXISTS `student_lab_token_wallets` (
    `Id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `TenantId` VARCHAR(64) NOT NULL,
    `StudentId` BIGINT UNSIGNED NOT NULL,
    `LabId` BIGINT UNSIGNED NOT NULL,
    `TotalPurchasedTokens` INT UNSIGNED NOT NULL DEFAULT 0,
    `ConsumedTokens` INT UNSIGNED NOT NULL DEFAULT 0,
    `Version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `UpdatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `UQ_Student_Lab_Wallet` (`TenantId`, `StudentId`, `LabId`),
    INDEX `IDX_Student_Wallet` (`TenantId`, `StudentId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Immutable Token Transactions Ledger (Idempotent Audit Movement)
CREATE TABLE IF NOT EXISTS `student_lab_token_transactions` (
    `Id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `TenantId` VARCHAR(64) NOT NULL,
    `StudentId` BIGINT UNSIGNED NOT NULL,
    `LabId` BIGINT UNSIGNED NOT NULL,
    `TransactionType` ENUM('PURCHASE', 'CONSUMPTION', 'ADJUSTMENT', 'EXPIRE', 'ADMIN_GRANT') NOT NULL,
    `Tokens` INT NOT NULL,
    `ReferenceType` VARCHAR(50) NULL,
    `ReferenceId` VARCHAR(255) NULL,
    `Description` VARCHAR(500) NULL,
    `IdempotencyKey` VARCHAR(255) NOT NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `UQ_Token_Ledger_Idempotency` (`IdempotencyKey`),
    INDEX `IDX_Token_Ledger_Student_Lab` (`TenantId`, `StudentId`, `LabId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Token Orders (Combined Checkout Header)
CREATE TABLE IF NOT EXISTS `token_orders` (
    `Id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `OrderNumber` VARCHAR(100) NOT NULL UNIQUE,
    `TenantId` VARCHAR(64) NOT NULL,
    `StudentId` BIGINT UNSIGNED NOT NULL,
    `Status` ENUM('PENDING_PAYMENT', 'PAID', 'TOKEN_CREDITED', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `Currency` VARCHAR(10) DEFAULT 'INR',
    `TotalAmount` DECIMAL(12,2) NOT NULL,
    `RazorpayOrderId` VARCHAR(255) NULL UNIQUE,
    `RazorpayPaymentId` VARCHAR(255) NULL UNIQUE,
    `IdempotencyKey` VARCHAR(255) NULL UNIQUE,
    `QuoteExpiresAt` DATETIME NOT NULL,
    `PaidAt` DATETIME NULL,
    `CreditedAt` DATETIME NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `IDX_Token_Orders_Student` (`TenantId`, `StudentId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Token Order Items (Immutable Price Snapshots)
CREATE TABLE IF NOT EXISTS `token_order_items` (
    `Id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `OrderId` BIGINT UNSIGNED NOT NULL,
    `LabId` BIGINT UNSIGNED NOT NULL,
    `PackageId` BIGINT UNSIGNED NULL,
    `LabNameSnapshot` VARCHAR(255) NOT NULL,
    `TokenQuantity` INT UNSIGNED NOT NULL,
    `UnitPriceAmount` DECIMAL(12,2) NOT NULL,
    `LineTotalAmount` DECIMAL(12,2) NOT NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`OrderId`) REFERENCES `token_orders`(`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Safely Add Lab Session Billing & Worker Lock Columns (MySQL 8 / MariaDB compatible)
SET @dbname = DATABASE();

SET @tablename = "lab_sessions";

SET @columnname = "BillingStartedAt";
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE
            TABLE_SCHEMA = @dbname
            AND TABLE_NAME = @tablename
            AND COLUMN_NAME = @columnname
    ) > 0,
    "SELECT 1",
    "ALTER TABLE `lab_sessions` ADD COLUMN `BillingStartedAt` DATETIME NULL;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = "LastBilledAt";
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE
            TABLE_SCHEMA = @dbname
            AND TABLE_NAME = @tablename
            AND COLUMN_NAME = @columnname
    ) > 0,
    "SELECT 1",
    "ALTER TABLE `lab_sessions` ADD COLUMN `LastBilledAt` DATETIME NULL;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = "BilledSeconds";
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE
            TABLE_SCHEMA = @dbname
            AND TABLE_NAME = @tablename
            AND COLUMN_NAME = @columnname
    ) > 0,
    "SELECT 1",
    "ALTER TABLE `lab_sessions` ADD COLUMN `BilledSeconds` INT UNSIGNED NOT NULL DEFAULT 0;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = "BilledTokens";
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE
            TABLE_SCHEMA = @dbname
            AND TABLE_NAME = @tablename
            AND COLUMN_NAME = @columnname
    ) > 0,
    "SELECT 1",
    "ALTER TABLE `lab_sessions` ADD COLUMN `BilledTokens` INT UNSIGNED NOT NULL DEFAULT 0;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = "LowTokenWarningSent";
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE
            TABLE_SCHEMA = @dbname
            AND TABLE_NAME = @tablename
            AND COLUMN_NAME = @columnname
    ) > 0,
    "SELECT 1",
    "ALTER TABLE `lab_sessions` ADD COLUMN `LowTokenWarningSent` TINYINT(1) NOT NULL DEFAULT 0;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = "BillingLockUntil";
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE
            TABLE_SCHEMA = @dbname
            AND TABLE_NAME = @tablename
            AND COLUMN_NAME = @columnname
    ) > 0,
    "SELECT 1",
    "ALTER TABLE `lab_sessions` ADD COLUMN `BillingLockUntil` DATETIME NULL;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = "BillingWorkerId";
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE
            TABLE_SCHEMA = @dbname
            AND TABLE_NAME = @tablename
            AND COLUMN_NAME = @columnname
    ) > 0,
    "SELECT 1",
    "ALTER TABLE `lab_sessions` ADD COLUMN `BillingWorkerId` VARCHAR(100) NULL;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
