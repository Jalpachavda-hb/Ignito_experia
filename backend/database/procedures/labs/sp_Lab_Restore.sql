DROP PROCEDURE IF EXISTS `sp_Lab_Restore`;

DELIMITER //

CREATE PROCEDURE `sp_Lab_Restore` (
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
        CALL sp_LogError('labs', 'sp_Lab_Restore', v_ErrorMessage, v_ErrorNumber, CONCAT('LabId: ', IFNULL(p_LabId, 'NULL')));
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    START TRANSACTION;

    UPDATE `Labs`
    SET 
        `IsDeleted` = 0,
        `Status` = 'active',
        `UpdatedBy` = p_UpdatedBy,
        `UpdatedDate` = CURRENT_TIMESTAMP
    WHERE `LabId` = p_LabId AND `IsDeleted` = 1;

    COMMIT;
    
    IF ROW_COUNT() > 0 THEN
        SELECT 'Success' AS Status, 'Lab restored successfully.' AS Message;
    ELSE
        SELECT 'Warning' AS Status, 'Lab not found or not deleted.' AS Message;
    END IF;
END //

DELIMITER ;
