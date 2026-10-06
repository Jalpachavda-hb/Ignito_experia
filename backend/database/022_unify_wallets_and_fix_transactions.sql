-- Migration 022: Unify Wallets and Fix TransactionType Enum
USE `ignito_experia`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Expand TransactionType ENUM on student_lab_token_transactions to safely support USAGE, CONSUMPTION, PURCHASE, REFUND, ADJUSTMENT
ALTER TABLE `student_lab_token_transactions` 
MODIFY COLUMN `TransactionType` ENUM('PURCHASE', 'USAGE', 'CONSUMPTION', 'REFUND', 'ADJUSTMENT', 'ALLOCATION') NOT NULL DEFAULT 'USAGE';

-- 2. Expand Type ENUM on credit_transactions if needed
ALTER TABLE `credit_transactions` 
MODIFY COLUMN `Type` ENUM('PURCHASE', 'USAGE', 'CONSUMPTION', 'DEDUCTION', 'LAB_USAGE', 'LAB_EXTENSION', 'REFUND', 'BONUS', 'ADJUSTMENT') NOT NULL DEFAULT 'PURCHASE';

-- 3. Ensure TokenExpiryAt and BilledSeconds columns on lab_sessions
SET @dbname = DATABASE();
SET @tablename = "lab_sessions";

-- 4. Clean up any empty string TransactionTypes in student_lab_token_transactions
UPDATE `student_lab_token_transactions`
SET `TransactionType` = 'USAGE'
WHERE `TransactionType` = '' OR `TransactionType` IS NULL;

SET FOREIGN_KEY_CHECKS = 1;
