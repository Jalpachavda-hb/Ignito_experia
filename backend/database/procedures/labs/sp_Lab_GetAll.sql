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
        CALL sp_LogError('labs', 'sp_Lab_GetAll', v_ErrorMessage, v_ErrorNumber, CONCAT('Status: ', IFNULL(p_Status, 'ALL')));
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;
    SELECT 
        `LabId`, `TenantId`, `LabCode`, `Title`, `Subtitle`, `Semester`, `Logo`, 
        `DurationMinutes`, `Credits`, `Complexity`, `Category`, `Description`, 
        `TaskDefinition`, `RuntimeType`, `RuntimePort`, `RuntimePath`, 
        `ContainerApiEnabled`, `ContainerApiPort`, `DisplayOrder`, `Status`, `IsDeleted`, 
        `CreatedBy`, `UpdatedBy`, `CreatedDate`, `UpdatedDate`
    FROM `labs`
    WHERE 
        (p_Status IS NULL OR p_Status = '' OR 
         (p_Status = 'active' AND `IsDeleted` = 0 AND `Status` != 'inactive') OR
         (p_Status = 'inactive' AND `IsDeleted` = 0 AND `Status` = 'inactive') OR
         (p_Status = 'deleted' AND `IsDeleted` = 1)
        )
    ORDER BY `DisplayOrder` ASC, `CreatedDate` DESC;
END //
DELIMITER ;