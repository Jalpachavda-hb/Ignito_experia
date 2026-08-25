-- Migration 014: Hardened Lab-Specific Token Billing & Immutable Ledger Schema

USE `ignito_experia`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Owner Configured Lab Token Packages
CREATE TABLE IF NOT EXISTS `lab_token_packages` (
    `Id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `LabId` VARCHAR(100) NOT NULL,
    `TokenAmount` INT NOT NULL,
    `PriceAmount` DECIMAL(10,2) NOT NULL,
    `Currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
    `IsActive` TINYINT(1) NOT NULL DEFAULT 1,
    `CreatedBy` BIGINT UNSIGNED NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `UpdatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`Id`),
    INDEX `IDX_LabTokenPackages_Lab` (`LabId`, `IsActive`),
    CONSTRAINT `UQ_LabTokenPackage` UNIQUE (`LabId`, `TokenAmount`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Token Purchase Orders (Combined Multi-Lab Cart)
CREATE TABLE IF NOT EXISTS `token_orders` (
    `Id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `TenantId` VARCHAR(64) NOT NULL,
    `StudentId` VARCHAR(64) NOT NULL,
    `OrderNumber` VARCHAR(100) NOT NULL,
    `TotalTokens` INT NOT NULL DEFAULT 0,
    `TotalAmount` DECIMAL(10,2) NOT NULL,
    `Currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
    `Status` ENUM('CREATED', 'PAYMENT_PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'CREATED',
    `PaymentGateway` VARCHAR(50) NULL DEFAULT 'RAZORPAY',
    `GatewayOrderId` VARCHAR(255) NULL,
    `GatewayPaymentId` VARCHAR(255) NULL,
    `GatewayStatus` VARCHAR(50) NULL,
    `PaidAt` DATETIME NULL,
    `FailedAt` DATETIME NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `UpdatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`Id`),
    UNIQUE KEY `UQ_TokenOrders_OrderNumber` (`OrderNumber`),
    UNIQUE KEY `UQ_TokenOrders_GatewayOrder` (`GatewayOrderId`),
    INDEX `IDX_TokenOrders_Student` (`TenantId`, `StudentId`, `CreatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Token Order Line Items (Historical Price & Name Snapshots)
CREATE TABLE IF NOT EXISTS `token_order_items` (
    `Id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `OrderId` BIGINT UNSIGNED NOT NULL,
    `LabId` VARCHAR(100) NOT NULL,
    `PackageId` BIGINT UNSIGNED NULL,
    `LabNameSnapshot` VARCHAR(255) NOT NULL,
    `PackageNameSnapshot` VARCHAR(255) NOT NULL,
    `TokenAmountSnapshot` INT NOT NULL,
    `UnitPriceSnapshot` DECIMAL(10,2) NOT NULL,
    `CurrencySnapshot` VARCHAR(10) NOT NULL DEFAULT 'INR',
    `LineTotalAmount` DECIMAL(10,2) NOT NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`Id`),
    INDEX `IDX_TokenOrderItems_Order` (`OrderId`),
    INDEX `IDX_TokenOrderItems_Lab` (`LabId`),
    CONSTRAINT `FK_TokenOrderItems_Order` FOREIGN KEY (`OrderId`) REFERENCES `token_orders` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Lab-Specific Student Token Wallets with CarryOverSeconds
CREATE TABLE IF NOT EXISTS `student_lab_token_wallets` (
    `Id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `TenantId` VARCHAR(64) NOT NULL,
    `StudentId` VARCHAR(64) NOT NULL,
    `LabId` VARCHAR(100) NOT NULL,
    `TotalPurchasedTokens` INT NOT NULL DEFAULT 0,
    `TotalUsedTokens` INT NOT NULL DEFAULT 0,
    `RemainingTokens` INT NOT NULL DEFAULT 0,
    `CarryOverSeconds` INT NOT NULL DEFAULT 0,
    `Status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `UpdatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`Id`),
    UNIQUE KEY `UQ_StudentLabWallet` (`TenantId`, `StudentId`, `LabId`),
    INDEX `IDX_StudentLabWallet` (`StudentId`, `LabId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Immutable Token Financial Ledger (ON DELETE RESTRICT Integrity)
CREATE TABLE IF NOT EXISTS `student_lab_token_transactions` (
    `Id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `TenantId` VARCHAR(64) NOT NULL,
    `StudentId` VARCHAR(64) NOT NULL,
    `LabId` VARCHAR(100) NOT NULL,
    `WalletId` BIGINT UNSIGNED NOT NULL,
    `TransactionType` ENUM('PURCHASE', 'USAGE', 'REFUND', 'ADJUSTMENT') NOT NULL,
    `TokenChange` INT NOT NULL,
    `BalanceBefore` INT NOT NULL,
    `BalanceAfter` INT NOT NULL,
    `ReferenceType` VARCHAR(50) NOT NULL,
    `ReferenceId` VARCHAR(100) NOT NULL,
    `IdempotencyKey` VARCHAR(255) NOT NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`Id`),
    UNIQUE KEY `UQ_TokenTx_Idempotency` (`IdempotencyKey`),
    INDEX `IDX_TokenTx_StudentLab` (`TenantId`, `StudentId`, `LabId`),
    CONSTRAINT `FK_TokenTx_Wallet` FOREIGN KEY (`WalletId`) REFERENCES `student_lab_token_wallets` (`Id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Detailed Runtime Telemetry Detail Log
CREATE TABLE IF NOT EXISTS `lab_token_usage` (
    `Id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `TenantId` VARCHAR(64) NOT NULL,
    `StudentId` VARCHAR(64) NOT NULL,
    `LabId` VARCHAR(100) NOT NULL,
    `LabSessionId` VARCHAR(100) NOT NULL,
    `WalletId` BIGINT UNSIGNED NOT NULL,
    `TokensUsed` INT NOT NULL,
    `RuntimeSeconds` INT NOT NULL,
    `BalanceBefore` INT NOT NULL,
    `BalanceAfter` INT NOT NULL,
    `BillingSequence` INT NOT NULL,
    `IdempotencyKey` VARCHAR(255) NOT NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`Id`),
    UNIQUE KEY `UQ_LabUsage_Idempotency` (`IdempotencyKey`),
    UNIQUE KEY `UQ_LabUsage_Sequence` (`LabSessionId`, `BillingSequence`),
    INDEX `IDX_LabUsage_StudentLab` (`TenantId`, `StudentId`, `LabId`),
    CONSTRAINT `FK_LabUsage_Wallet` FOREIGN KEY (`WalletId`) REFERENCES `student_lab_token_wallets` (`Id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Extend lab_sessions Table with TokenExpiryAt & Billing Fields
ALTER TABLE `lab_sessions`
  ADD COLUMN `TokenExpiryAt` DATETIME NULL AFTER `StartedAt`,
  ADD COLUMN `LastBilledAt` DATETIME NULL AFTER `TokenExpiryAt`,
  ADD COLUMN `UnbilledSeconds` INT NOT NULL DEFAULT 0 AFTER `AllocatedCredits`,
  ADD COLUMN `BilledTokens` INT NOT NULL DEFAULT 0 AFTER `UnbilledSeconds`,
  ADD COLUMN `LowBalanceWarningSent` TINYINT(1) NOT NULL DEFAULT 0 AFTER `TenMinuteWarningSent`,
  ADD COLUMN `StopRequestedAt` DATETIME NULL AFTER `EndedAt`,
  ADD COLUMN `StopRetryCount` INT NOT NULL DEFAULT 0 AFTER `StopRequestedAt`,
  ADD COLUMN `LastStopAttemptAt` DATETIME NULL AFTER `StopRetryCount`,
  ADD COLUMN `StopError` TEXT NULL AFTER `LastStopAttemptAt`,
  ADD INDEX `IDX_LabSession_Expiry` (`Status`, `TokenExpiryAt`),
  ADD INDEX `IDX_LabSession_Billing` (`Status`, `LastBilledAt`);

SET FOREIGN_KEY_CHECKS = 1;
