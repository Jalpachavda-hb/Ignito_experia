-- ============================================================
-- Migration: 019_drop_mobile_and_universityid.sql
-- Description: Merge Mobile into PhoneNumber and drop Mobile and UniversityId from Users table
-- ============================================================

USE `ignito_experia`;

-- 1. Merge any existing Mobile data into PhoneNumber if PhoneNumber is NULL
UPDATE `Users` SET `PhoneNumber` = `Mobile` WHERE `PhoneNumber` IS NULL AND `Mobile` IS NOT NULL;

-- 2. Drop Mobile and UniversityId columns
DROP PROCEDURE IF EXISTS DropColumnIfExists;
DELIMITER //
CREATE PROCEDURE DropColumnIfExists(
    IN p_TableName VARCHAR(64),
    IN p_ColumnName VARCHAR(64)
)
BEGIN
    IF EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = p_TableName
          AND COLUMN_NAME = p_ColumnName
    ) THEN
        SET @query = CONCAT('ALTER TABLE `', p_TableName, '` DROP COLUMN `', p_ColumnName, '`');
        PREPARE stmt FROM @query;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

CALL DropColumnIfExists('Users', 'Mobile');
CALL DropColumnIfExists('Users', 'UniversityId');

DROP PROCEDURE IF EXISTS DropColumnIfExists;
