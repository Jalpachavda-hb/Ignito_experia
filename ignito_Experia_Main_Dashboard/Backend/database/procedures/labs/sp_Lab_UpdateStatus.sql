DROP PROCEDURE IF EXISTS `sp_Lab_UpdateStatus`;

DELIMITER //

CREATE PROCEDURE `sp_Lab_UpdateStatus` (
    IN p_LabId BIGINT,
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
        CALL sp_LogError('labs', 'sp_Lab_UpdateStatus', v_ErrorMessage, v_ErrorNumber, CONCAT('LabId: ', IFNULL(p_LabId, 'NULL'), ', Status: ', IFNULL(p_Status, 'NULL')));
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    START TRANSACTION;

    UPDATE `labs`
    SET 
        `Status`      = p_Status,
        `UpdatedBy`   = p_UpdatedBy,
        `UpdatedDate` = CURRENT_TIMESTAMP
    WHERE `LabId` = p_LabId AND `IsDeleted` = 0;

    COMMIT;
    
    IF ROW_COUNT() > 0 THEN
        SELECT 'Success' AS Status, 'Lab status updated successfully.' AS Message;
    ELSE
        SELECT 'Warning' AS Status, 'Lab not found or already in that status.' AS Message;
    END IF;
END //

DELIMITER ;
