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
        `LabId`, `LabCode`, `Title`, `Subtitle`, `Semester`, `Logo`, 
        `DurationMinutes`, `Credits`, `Complexity`, `Category`, `Description`, 
        `TaskDefinition`, `RuntimeType`, `RuntimePort`, `RuntimePath`, 
        `ContainerApiEnabled`, `ContainerApiPort`, `DisplayOrder`, `Status`, `IsDeleted`, 
        `CreatedBy`, `UpdatedBy`, `CreatedDate`, `UpdatedDate`
    FROM `labs`
    WHERE `LabId` = p_LabId AND `IsDeleted` = 0;
END //

DELIMITER ;
