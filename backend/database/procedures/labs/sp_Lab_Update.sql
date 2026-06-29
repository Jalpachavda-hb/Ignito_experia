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
    IN p_DurationMinutes INT,
    IN p_Credits INT,
    IN p_Complexity VARCHAR(50),
    IN p_Category VARCHAR(100),
    IN p_Description LONGTEXT,
    IN p_TaskDefinition VARCHAR(200),
    IN p_RuntimeType ENUM('ide', 'terminal', 'jupyter', 'codeserver'),
    IN p_RuntimePort INT,
    IN p_RuntimePath VARCHAR(200),
    IN p_ContainerApiEnabled TINYINT(1),
    IN p_ContainerApiPort INT,
    IN p_DisplayOrder INT,
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
        `DurationMinutes` = p_DurationMinutes,
        `Credits` = p_Credits,
        `Complexity` = p_Complexity,
        `Category` = p_Category,
        `Description` = p_Description,
        `TaskDefinition` = p_TaskDefinition,
        `RuntimeType` = p_RuntimeType,
        `RuntimePort` = p_RuntimePort,
        `RuntimePath` = p_RuntimePath,
        `ContainerApiEnabled` = p_ContainerApiEnabled,
        `ContainerApiPort` = p_ContainerApiPort,
        `DisplayOrder` = IFNULL(p_DisplayOrder, `DisplayOrder`),
        `UpdatedBy` = p_UpdatedBy,
        `UpdatedDate` = CURRENT_TIMESTAMP
    WHERE `LabId` = p_LabId AND `IsDeleted` = 0;

    COMMIT;
    
    IF ROW_COUNT() > 0 THEN
        SELECT 'Success' AS Status, 'Lab updated successfully.' AS Message;
    ELSE
        SELECT 'Warning' AS Status, 'Lab not found or no changes made.' AS Message;
    END IF;
END //

DELIMITER ;
