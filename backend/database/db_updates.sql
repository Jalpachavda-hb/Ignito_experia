USE `ignito_experia`;

-- 1. Create RuntimeTypes table
CREATE TABLE IF NOT EXISTS `RuntimeTypes` (
    `Id` INT AUTO_INCREMENT PRIMARY KEY,
    `Value` VARCHAR(50) NOT NULL UNIQUE,
    `Label` VARCHAR(100) NOT NULL,
    `IsActive` TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Seed RuntimeTypes
INSERT IGNORE INTO `RuntimeTypes` (`Value`, `Label`) VALUES 
('ide', 'IDE (VSCode)'),
('terminal', 'Terminal'),
('jupyter', 'Jupyter Notebook'),
('codeserver', 'Code Server');

-- 3. Modify Labs.RuntimeType to be VARCHAR
ALTER TABLE `Labs` MODIFY `RuntimeType` VARCHAR(50) DEFAULT 'ide';

-- 4. Update sp_Lab_GetAll to handle IsDeleted correctly
DROP PROCEDURE IF EXISTS `sp_Lab_GetAll`;

DELIMITER //

CREATE PROCEDURE `sp_Lab_GetAll` (
    IN p_Status VARCHAR(20)
)
BEGIN
    DECLARE v_ErrorNumber INT;
    DECLARE v_ErrorMessage TEXT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1
            v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    SELECT 
        `LabId`, `TenantId`, `LabCode`, `Title`, `Subtitle`, `Semester`, `Logo`, 
        `DurationMinutes`, `Credits`, `Complexity`, `Category`, `Description`, 
        `Status`, `TaskDefinition`, `RuntimeType`, `RuntimePort`, `RuntimePath`, 
        `ContainerApiEnabled`, `ContainerApiPort`, `IsDeleted`,
        `CreatedBy`, `UpdatedBy`, `CreatedDate`, `UpdatedDate`
    FROM `Labs`
    WHERE 
        (p_Status IS NULL OR p_Status = '' OR 
         (p_Status = 'active' AND `IsDeleted` = 0 AND `Status` != 'inactive') OR
         (p_Status = 'inactive' AND `IsDeleted` = 0 AND `Status` = 'inactive') OR
         (p_Status = 'deleted' AND `IsDeleted` = 1)
        )
    ORDER BY `UpdatedDate` DESC, `CreatedDate` DESC;
END //

DELIMITER ;

-- 5. Update sp_Lab_Delete to set IsDeleted=1 and Status='deleted'
DROP PROCEDURE IF EXISTS `sp_Lab_Delete`;

DELIMITER //

CREATE PROCEDURE `sp_Lab_Delete` (
    IN p_LabCode VARCHAR(100),
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
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    START TRANSACTION;

    UPDATE `Labs`
    SET 
        `IsDeleted` = 1,
        `Status` = 'deleted',
        `UpdatedBy` = p_UpdatedBy,
        `UpdatedDate` = CURRENT_TIMESTAMP
    WHERE `LabCode` = p_LabCode COLLATE utf8mb4_unicode_ci;

    COMMIT;
    
    IF ROW_COUNT() > 0 THEN
        SELECT 'Success' AS Status, 'Lab deleted successfully.' AS Message;
    ELSE
        SELECT 'Warning' AS Status, 'Lab not found or already deleted.' AS Message;
    END IF;
END //

DELIMITER ;

-- 6. Update sp_Lab_UpdateStatus to only update Status
DROP PROCEDURE IF EXISTS `sp_Lab_UpdateStatus`;

DELIMITER //

CREATE PROCEDURE `sp_Lab_UpdateStatus` (
    IN p_LabCode VARCHAR(100),
    IN p_Status VARCHAR(20),
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
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    START TRANSACTION;

    UPDATE `Labs`
    SET 
        `Status` = p_Status,
        `UpdatedBy` = p_UpdatedBy,
        `UpdatedDate` = CURRENT_TIMESTAMP
    WHERE `LabCode` = p_LabCode COLLATE utf8mb4_unicode_ci AND `IsDeleted` = 0;

    COMMIT;
    
    IF ROW_COUNT() > 0 THEN
        SELECT 'Success' AS Status, 'Lab status updated successfully.' AS Message;
    ELSE
        SELECT 'Warning' AS Status, 'Lab not found or already in that status.' AS Message;
    END IF;
END //

DELIMITER ;

-- 7. Update sp_Lab_Restore to handle LabCode string
DROP PROCEDURE IF EXISTS `sp_Lab_Restore`;

DELIMITER //

CREATE PROCEDURE `sp_Lab_Restore` (
    IN p_LabCode VARCHAR(100),
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
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    START TRANSACTION;

    UPDATE `Labs`
    SET 
        `IsDeleted` = 0,
        `Status` = 'inactive',
        `UpdatedBy` = p_UpdatedBy,
        `UpdatedDate` = CURRENT_TIMESTAMP
    WHERE `LabCode` = p_LabCode COLLATE utf8mb4_unicode_ci AND `IsDeleted` = 1;

    COMMIT;
    
    IF ROW_COUNT() > 0 THEN
        SELECT 'Success' AS Status, 'Lab restored successfully.' AS Message;
    ELSE
        SELECT 'Warning' AS Status, 'Lab not found or not deleted.' AS Message;
    END IF;
END //

DELIMITER ;

-- 8. Migrate any old deleted records to have Status = 'deleted'
UPDATE `Labs` SET `Status` = 'deleted' WHERE `IsDeleted` = 1;
