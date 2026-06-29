-- =====================================================================================
-- Project Name: Ignito Experia
-- Description: Full Database Setup Script
-- Target RDBMS: MySQL 8+
-- =====================================================================================

-- 1. Create database if not exists
CREATE DATABASE IF NOT EXISTS `ignito_experia`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- 2. Use the database
USE `ignito_experia`;

-- =====================================================================================
-- TABLE 1: ErrorLogs
-- Purpose: Centralized error logging table.
-- All stored procedures in the system must log errors to this table.
-- =====================================================================================
CREATE TABLE IF NOT EXISTS `ErrorLogs` (
    `ErrorLogId` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `ModuleName` VARCHAR(100),
    `ProcedureName` VARCHAR(100),
    `ErrorMessage` TEXT,
    `ErrorNumber` INT,
    `RequestData` LONGTEXT,
    `CreatedDate` DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX `IDX_ErrorLogs_ModuleName` (`ModuleName`),
    INDEX `IDX_ErrorLogs_ProcedureName` (`ProcedureName`),
    INDEX `IDX_ErrorLogs_CreatedDate` (`CreatedDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Centralized system error logging table';


-- =====================================================================================
-- STORED PROCEDURE: sp_LogError
-- Purpose: Insert all system errors into ErrorLogs.
-- =====================================================================================
DROP PROCEDURE IF EXISTS `sp_LogError`;

DELIMITER //

CREATE PROCEDURE `sp_LogError` (
    IN p_ModuleName VARCHAR(100),
    IN p_ProcedureName VARCHAR(100),
    IN p_ErrorMessage TEXT,
    IN p_ErrorNumber INT,
    IN p_RequestData LONGTEXT
)
BEGIN
    INSERT INTO `ErrorLogs` (`ModuleName`, `ProcedureName`, `ErrorMessage`, `ErrorNumber`, `RequestData`)
    VALUES (p_ModuleName, p_ProcedureName, p_ErrorMessage, p_ErrorNumber, p_RequestData);
END //

DELIMITER ;


-- =====================================================================================
-- TABLE 2: labs
-- Purpose: Store all virtual lab configurations.
-- Designed for future SaaS multi-tenancy.
-- =====================================================================================
CREATE TABLE IF NOT EXISTS `labs` (
    `LabId` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `TenantId` BIGINT NULL COMMENT 'For future SaaS multi-tenancy',
    `LabCode` VARCHAR(100) NOT NULL UNIQUE,
    `Title` VARCHAR(200) NOT NULL,
    `Subtitle` VARCHAR(300),
    `Semester` VARCHAR(100),
    `Logo` VARCHAR(255) COMMENT 'Stores the file path/name of the uploaded photo',
    `Rating` DECIMAL(3,2) DEFAULT 0,
    `DurationMinutes` INT DEFAULT 0,
    `Credits` INT DEFAULT 0,
    `Complexity` VARCHAR(50),
    `Category` VARCHAR(100),
    `Description` LONGTEXT,
    `Status` VARCHAR(50) DEFAULT 'ready',
    `TaskDefinition` VARCHAR(200),
    
    -- Runtime Configuration
    `RuntimeType` ENUM('ide', 'terminal', 'jupyter', 'codeserver'),
    `RuntimePort` INT,
    `RuntimePath` VARCHAR(200),
    
    -- Container API Configuration
    `ContainerApiEnabled` TINYINT(1) DEFAULT 0,
    `ContainerApiPort` INT,
    
    -- Audit Columns
    `IsActive` TINYINT(1) DEFAULT 1,
    `CreatedBy` BIGINT NULL,
    `UpdatedBy` BIGINT NULL,
    `CreatedDate` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `UpdatedDate` DATETIME NULL,

    -- Indexes
    INDEX `IDX_labs_LabCode` (`LabCode`),
    INDEX `IDX_labs_RuntimeType` (`RuntimeType`),
    INDEX `IDX_labs_Status` (`Status`),
    INDEX `IDX_labs_Category` (`Category`),
    INDEX `IDX_labs_TenantId` (`TenantId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Virtual lab configurations with runtime and container API setup';


-- =====================================================================================
-- STORED PROCEDURES FOR labs
-- Requirements: proper MySQL syntax, transactions, exception handlers, error logging,
-- meaningful success responses, soft deletes.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 1. sp_Lab_Insert
-- -------------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_Lab_Insert`;

DELIMITER //

CREATE PROCEDURE `sp_Lab_Insert` (
    IN p_TenantId BIGINT,
    IN p_LabCode VARCHAR(100),
    IN p_Title VARCHAR(200),
    IN p_Subtitle VARCHAR(300),
    IN p_Semester VARCHAR(100),
    IN p_Logo VARCHAR(255),
    IN p_Rating DECIMAL(3,2),
    IN p_DurationMinutes INT,
    IN p_Credits INT,
    IN p_Complexity VARCHAR(50),
    IN p_Category VARCHAR(100),
    IN p_Description LONGTEXT,
    IN p_Status VARCHAR(50),
    IN p_TaskDefinition VARCHAR(200),
    IN p_RuntimeType ENUM('ide', 'terminal', 'jupyter', 'codeserver'),
    IN p_RuntimePort INT,
    IN p_RuntimePath VARCHAR(200),
    IN p_ContainerApiEnabled TINYINT(1),
    IN p_ContainerApiPort INT,
    IN p_CreatedBy BIGINT
)
BEGIN
    DECLARE v_ErrorNumber INT;
    DECLARE v_ErrorMessage TEXT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1
            v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
        ROLLBACK;
        CALL sp_LogError('labs', 'sp_Lab_Insert', v_ErrorMessage, v_ErrorNumber, CONCAT('LabCode: ', IFNULL(p_LabCode, 'NULL')));
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    START TRANSACTION;

    INSERT INTO `labs` (
        `TenantId`, `LabCode`, `Title`, `Subtitle`, `Semester`, `Logo`, `Rating`, `DurationMinutes`, `Credits`,
        `Complexity`, `Category`, `Description`, `Status`, `TaskDefinition`, `RuntimeType`, `RuntimePort`,
        `RuntimePath`, `ContainerApiEnabled`, `ContainerApiPort`, `CreatedBy`
    ) VALUES (
        p_TenantId, p_LabCode, p_Title, p_Subtitle, p_Semester, p_Logo, p_Rating, p_DurationMinutes, p_Credits,
        p_Complexity, p_Category, p_Description, IFNULL(p_Status, 'ready'), p_TaskDefinition, p_RuntimeType, p_RuntimePort,
        p_RuntimePath, IFNULL(p_ContainerApiEnabled, 0), p_ContainerApiPort, p_CreatedBy
    );

    COMMIT;
    SELECT 'Success' AS Status, 'Lab inserted successfully.' AS Message, LAST_INSERT_ID() AS InsertedId;
END //

DELIMITER ;

-- -------------------------------------------------------------------------------------
-- 2. sp_Lab_Update
-- -------------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_Lab_Update`;

DELIMITER //

CREATE PROCEDURE `sp_Lab_Update` (
    IN p_LabId BIGINT,
    IN p_TenantId BIGINT,
    IN p_LabCode VARCHAR(100),
    IN p_Title VARCHAR(200),
    IN p_Subtitle VARCHAR(300),
    IN p_Semester VARCHAR(100),
    IN p_Logo VARCHAR(255),
    IN p_Rating DECIMAL(3,2),
    IN p_DurationMinutes INT,
    IN p_Credits INT,
    IN p_Complexity VARCHAR(50),
    IN p_Category VARCHAR(100),
    IN p_Description LONGTEXT,
    IN p_Status VARCHAR(50),
    IN p_TaskDefinition VARCHAR(200),
    IN p_RuntimeType ENUM('ide', 'terminal', 'jupyter', 'codeserver'),
    IN p_RuntimePort INT,
    IN p_RuntimePath VARCHAR(200),
    IN p_ContainerApiEnabled TINYINT(1),
    IN p_ContainerApiPort INT,
    IN p_UpdatedBy BIGINT
)
BEGIN
    DECLARE v_ErrorNumber INT;
    DECLARE v_ErrorMessage TEXT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1
            v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
        ROLLBACK;
        CALL sp_LogError('labs', 'sp_Lab_Update', v_ErrorMessage, v_ErrorNumber, CONCAT('LabId: ', IFNULL(p_LabId, 'NULL')));
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    START TRANSACTION;

    UPDATE `labs`
    SET
        `TenantId` = p_TenantId,
        `LabCode` = p_LabCode,
        `Title` = p_Title,
        `Subtitle` = p_Subtitle,
        `Semester` = p_Semester,
        `Logo` = p_Logo,
        `Rating` = p_Rating,
        `DurationMinutes` = p_DurationMinutes,
        `Credits` = p_Credits,
        `Complexity` = p_Complexity,
        `Category` = p_Category,
        `Description` = p_Description,
        `Status` = p_Status,
        `TaskDefinition` = p_TaskDefinition,
        `RuntimeType` = p_RuntimeType,
        `RuntimePort` = p_RuntimePort,
        `RuntimePath` = p_RuntimePath,
        `ContainerApiEnabled` = p_ContainerApiEnabled,
        `ContainerApiPort` = p_ContainerApiPort,
        `UpdatedBy` = p_UpdatedBy,
        `UpdatedDate` = CURRENT_TIMESTAMP
    WHERE `LabId` = p_LabId AND `IsActive` = 1;

    COMMIT;
    
    IF ROW_COUNT() > 0 THEN
        SELECT 'Success' AS Status, 'Lab updated successfully.' AS Message;
    ELSE
        SELECT 'Warning' AS Status, 'Lab not found or no changes made.' AS Message;
    END IF;
END //

DELIMITER ;

-- -------------------------------------------------------------------------------------
-- 3. sp_Lab_Delete (Soft Delete)
-- -------------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_Lab_Delete`;

DELIMITER //

CREATE PROCEDURE `sp_Lab_Delete` (
    IN p_LabId BIGINT,
    IN p_UpdatedBy BIGINT
)
BEGIN
    DECLARE v_ErrorNumber INT;
    DECLARE v_ErrorMessage TEXT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1
            v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
        ROLLBACK;
        CALL sp_LogError('labs', 'sp_Lab_Delete', v_ErrorMessage, v_ErrorNumber, CONCAT('LabId: ', IFNULL(p_LabId, 'NULL')));
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    START TRANSACTION;

    UPDATE `labs`
    SET 
        `IsActive` = 0,
        `UpdatedBy` = p_UpdatedBy,
        `UpdatedDate` = CURRENT_TIMESTAMP
    WHERE `LabId` = p_LabId;

    COMMIT;
    
    IF ROW_COUNT() > 0 THEN
        SELECT 'Success' AS Status, 'Lab soft deleted successfully.' AS Message;
    ELSE
        SELECT 'Warning' AS Status, 'Lab not found or already deleted.' AS Message;
    END IF;
END //

DELIMITER ;

-- -------------------------------------------------------------------------------------
-- 4. sp_Lab_GetAll
-- -------------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_Lab_GetAll`;

DELIMITER //

CREATE PROCEDURE `sp_Lab_GetAll` ()
BEGIN
    DECLARE v_ErrorNumber INT;
    DECLARE v_ErrorMessage TEXT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1
            v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
        CALL sp_LogError('labs', 'sp_Lab_GetAll', v_ErrorMessage, v_ErrorNumber, 'No parameters');
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    SELECT 
        `LabId`, `TenantId`, `LabCode`, `Title`, `Subtitle`, `Semester`, `Logo`, 
        `Rating`, `DurationMinutes`, `Credits`, `Complexity`, `Category`, `Description`, 
        `Status`, `TaskDefinition`, `RuntimeType`, `RuntimePort`, `RuntimePath`, 
        `ContainerApiEnabled`, `ContainerApiPort`, `IsActive`, `CreatedBy`, `UpdatedBy`, 
        `CreatedDate`, `UpdatedDate`
    FROM `labs`
    WHERE `IsActive` = 1;
END //

DELIMITER ;

-- -------------------------------------------------------------------------------------
-- 5. sp_Lab_GetById
-- -------------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_Lab_GetById`;

DELIMITER //

CREATE PROCEDURE `sp_Lab_GetById` (
    IN p_LabId BIGINT
)
BEGIN
    DECLARE v_ErrorNumber INT;
    DECLARE v_ErrorMessage TEXT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1
            v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
        CALL sp_LogError('labs', 'sp_Lab_GetById', v_ErrorMessage, v_ErrorNumber, CONCAT('LabId: ', IFNULL(p_LabId, 'NULL')));
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    SELECT 
        `LabId`, `TenantId`, `LabCode`, `Title`, `Subtitle`, `Semester`, `Logo`, 
        `Rating`, `DurationMinutes`, `Credits`, `Complexity`, `Category`, `Description`, 
        `Status`, `TaskDefinition`, `RuntimeType`, `RuntimePort`, `RuntimePath`, 
        `ContainerApiEnabled`, `ContainerApiPort`, `IsActive`, `CreatedBy`, `UpdatedBy`, 
        `CreatedDate`, `UpdatedDate`
    FROM `labs`
    WHERE `LabId` = p_LabId AND `IsActive` = 1;
END //

DELIMITER ;

-- =====================================================================================
-- 6. SEED DATA
-- =====================================================================================

-- Insert sample lab (linux-lab)
-- We use INSERT IGNORE to prevent duplicate LabCode errors upon multiple script runs
INSERT IGNORE INTO `labs` (
    `LabCode`, 
    `Title`, 
    `Subtitle`, 
    `Semester`, 
    `Logo`, 
    `Rating`, 
    `DurationMinutes`, 
    `Credits`, 
    `Complexity`, 
    `Category`, 
    `Description`, 
    `Status`, 
    `TaskDefinition`, 
    `RuntimeType`, 
    `RuntimePort`, 
    `RuntimePath`, 
    `ContainerApiEnabled`, 
    `ContainerApiPort`
) VALUES (
    'linux-lab',
    'Linux Administration Lab',
    'Bash Scripting & SysAdmin',
    'Semester 2',
    'default_linux_logo.png',
    4.8,
    60,
    25,
    'Beginner',
    'SysAdmin',
    'Practice Linux commands, file systems, and shell scripting in a secure Ubuntu environment.',
    'ready',
    'vlab-dev-linux-task',
    'terminal',
    8080,
    '/',
    1,
    8080
);

-- =====================================================================================
-- End of Setup Script
-- =====================================================================================
