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
        CALL sp_LogError('labs', 'sp_Lab_Delete', v_ErrorMessage, v_ErrorNumber, CONCAT('LabCode: ', IFNULL(p_LabCode, 'NULL')));
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    START TRANSACTION;

    UPDATE `Labs`
    SET 
        `IsDeleted` = 1,
        `Status` = 'inactive',
        `UpdatedBy` = p_UpdatedBy,
        `UpdatedDate` = CURRENT_TIMESTAMP
    WHERE `LabCode` = p_LabCode COLLATE utf8mb4_unicode_ci AND `IsDeleted` = 0;

    COMMIT;
    
    IF ROW_COUNT() > 0 THEN
        SELECT 'Success' AS Status, 'Lab soft deleted successfully.' AS Message;
    ELSE
        SELECT 'Warning' AS Status, 'Lab not found or already deleted.' AS Message;
    END IF;
END //

DELIMITER ;
