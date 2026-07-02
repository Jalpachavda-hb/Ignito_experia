DROP PROCEDURE IF EXISTS `sp_Lab_GetActivelabs`;

DELIMITER //

CREATE PROCEDURE `sp_Lab_GetActivelabs` ()
BEGIN
    DECLARE v_ErrorNumber INT;
    DECLARE v_ErrorMessage TEXT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1
            v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
        CALL sp_LogError('labs', 'sp_Lab_GetActiveLabs', v_ErrorMessage, v_ErrorNumber, 'No parameters');
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    SELECT 
        `LabId`, `TenantId`, `LabCode`, `Title`, `Subtitle`, `Semester`, `Logo`, 
        `DurationMinutes`, `Credits`, `Complexity`, `Category`, `Description`, 
        `TaskDefinition`, `RuntimeType`, `RuntimePort`, `RuntimePath`, 
        `ContainerApiEnabled`, `ContainerApiPort`, `DisplayOrder`, `Status`, `IsDeleted`, 
        `CreatedBy`, `UpdatedBy`, `CreatedDate`, `UpdatedDate`
    FROM `Labs`
    WHERE `IsDeleted` = 0 AND `Status` = 'active'
    ORDER BY `DisplayOrder` ASC, `CreatedDate` DESC;
END //

DELIMITER ;
