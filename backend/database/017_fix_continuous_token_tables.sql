-- 017_fix_continuous_token_tables.sql
-- Upgrade all token tables to 016 schema columns cleanly

SET FOREIGN_KEY_CHECKS = 0;

-- 1. student_lab_token_wallets
SET @dbname = DATABASE();
SET @tablename = "student_lab_token_wallets";

SET @columnname = "ConsumedTokens";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `student_lab_token_wallets` ADD COLUMN `ConsumedTokens` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `TotalPurchasedTokens`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Copy TotalUsedTokens to ConsumedTokens if TotalUsedTokens exists
SET @columnname = "TotalUsedTokens";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "UPDATE `student_lab_token_wallets` SET `ConsumedTokens` = `TotalUsedTokens` WHERE `ConsumedTokens` = 0 AND `TotalUsedTokens` > 0;",
    "SELECT 1"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @columnname = "Version";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `student_lab_token_wallets` ADD COLUMN `Version` BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER `ConsumedTokens`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- 2. student_lab_token_transactions
SET @tablename = "student_lab_token_transactions";

SET @columnname = "Tokens";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `student_lab_token_transactions` ADD COLUMN `Tokens` INT NOT NULL DEFAULT 0 AFTER `TransactionType`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @columnname = "Description";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `student_lab_token_transactions` ADD COLUMN `Description` VARCHAR(500) NULL AFTER `ReferenceId`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- 3. lab_token_packages
SET @tablename = "lab_token_packages";

SET @columnname = "TokenQuantity";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `lab_token_packages` ADD COLUMN `TokenQuantity` INT UNSIGNED NOT NULL DEFAULT 60 AFTER `LabId`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @columnname = "TokenAmount";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "UPDATE `lab_token_packages` SET `TokenQuantity` = `TokenAmount` WHERE `TokenQuantity` = 60 AND `TokenAmount` > 0;",
    "SELECT 1"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @columnname = "DisplayOrder";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `lab_token_packages` ADD COLUMN `DisplayOrder` INT NOT NULL DEFAULT 0 AFTER `IsActive`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- 4. token_orders
SET @tablename = "token_orders";

SET @columnname = "RazorpayOrderId";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `token_orders` ADD COLUMN `RazorpayOrderId` VARCHAR(255) NULL AFTER `TotalAmount`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @columnname = "RazorpayPaymentId";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `token_orders` ADD COLUMN `RazorpayPaymentId` VARCHAR(255) NULL AFTER `RazorpayOrderId`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @columnname = "IdempotencyKey";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `token_orders` ADD COLUMN `IdempotencyKey` VARCHAR(255) NULL AFTER `RazorpayPaymentId`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @columnname = "QuoteExpiresAt";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `token_orders` ADD COLUMN `QuoteExpiresAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `IdempotencyKey`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @columnname = "CreditedAt";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `token_orders` ADD COLUMN `CreditedAt` DATETIME NULL AFTER `PaidAt`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- 5. token_order_items
SET @tablename = "token_order_items";

SET @columnname = "PackageId";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `token_order_items` ADD COLUMN `PackageId` BIGINT UNSIGNED NULL AFTER `LabId`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @columnname = "LabNameSnapshot";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `token_order_items` ADD COLUMN `LabNameSnapshot` VARCHAR(255) NOT NULL DEFAULT 'Virtual Lab' AFTER `PackageId`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @columnname = "TokenQuantity";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `token_order_items` ADD COLUMN `TokenQuantity` INT UNSIGNED NOT NULL DEFAULT 60 AFTER `LabNameSnapshot`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @columnname = "UnitPriceAmount";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `token_order_items` ADD COLUMN `UnitPriceAmount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `TokenQuantity`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @columnname = "LineTotalAmount";
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    "SELECT 1",
    "ALTER TABLE `token_order_items` ADD COLUMN `LineTotalAmount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `UnitPriceAmount`;"
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;
