DROP PROCEDURE IF EXISTS `sp_Role_Delete`;

DELIMITER //

CREATE PROCEDURE `sp_Role_Delete` (
    IN p_RoleId BIGINT,
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
        CALL sp_LogError('Roles', 'sp_Role_Delete', v_ErrorMessage, v_ErrorNumber, CONCAT('RoleId: ', IFNULL(p_RoleId, 'NULL')));
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    -- Check if the role is a system role
    IF EXISTS (SELECT 1 FROM `Roles` WHERE `RoleId` = p_RoleId AND `IsSystem` = 1) THEN
        SELECT 'Error' AS Status, 'System roles cannot be deleted.' AS Message, 50001 AS ErrorCode;
    ELSE
        START TRANSACTION;

        UPDATE `Roles`
        SET `IsActive` = 0,
            `UpdatedBy` = p_UpdatedBy
        WHERE `RoleId` = p_RoleId;

        COMMIT;
        SELECT 'Success' AS Status, 'Role deleted successfully.' AS Message;
    END IF;
END //

DELIMITER ;
