DROP PROCEDURE IF EXISTS `sp_Lab_Insert`;

DELIMITER //

CREATE PROCEDURE `sp_Lab_Insert` (
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
    IN p_RuntimeType ENUM('ide', 'terminal', 'jupyter'),
    IN p_RuntimePort INT,
    IN p_RuntimePath VARCHAR(200),
    IN p_ContainerApiEnabled TINYINT(1),
    IN p_ContainerApiPort INT,
    IN p_DisplayOrder INT,
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

    INSERT INTO `Labs` (
        `TenantId`, `LabCode`, `Title`, `Subtitle`, `Semester`, `Logo`, `DurationMinutes`, `Credits`,
        `Complexity`, `Category`, `Description`, `TaskDefinition`, `RuntimeType`, `RuntimePort`,
        `RuntimePath`, `ContainerApiEnabled`, `ContainerApiPort`, `DisplayOrder`, `Status`, `IsDeleted`, `CreatedBy`
    ) VALUES (
        p_TenantId, p_LabCode, p_Title, p_Subtitle, p_Semester, p_Logo, p_DurationMinutes, p_Credits,
        p_Complexity, p_Category, p_Description, p_TaskDefinition, p_RuntimeType, p_RuntimePort,
        p_RuntimePath, IFNULL(p_ContainerApiEnabled, 0), p_ContainerApiPort, IFNULL(p_DisplayOrder, 0), 'active', 0, p_CreatedBy
    );

    COMMIT;
    SELECT 'Success' AS Status, 'Lab inserted successfully.' AS Message, LAST_INSERT_ID() AS InsertedId;
END //

DELIMITER ;
