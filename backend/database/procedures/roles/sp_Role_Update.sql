DROP PROCEDURE IF EXISTS `sp_Role_Update`;

DELIMITER //

CREATE PROCEDURE `sp_Role_Update` (
    IN p_RoleId BIGINT,
    IN p_Name VARCHAR(100),
    IN p_Description TEXT,
    IN p_UpdatedBy BIGINT,
    IN p_PermissionsJson LONGTEXT
)
BEGIN
    DECLARE v_ErrorNumber INT;
    DECLARE v_ErrorMessage TEXT;
    DECLARE v_PermissionCount INT DEFAULT 0;
    DECLARE v_Index INT DEFAULT 0;
    DECLARE v_ModuleCode VARCHAR(100);
    DECLARE v_CanCreate TINYINT(1);
    DECLARE v_CanRead TINYINT(1);
    DECLARE v_CanUpdate TINYINT(1);
    DECLARE v_CanDelete TINYINT(1);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1
            v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
        ROLLBACK;
        CALL sp_LogError('Roles', 'sp_Role_Update', v_ErrorMessage, v_ErrorNumber, CONCAT('RoleId: ', IFNULL(p_RoleId, 'NULL')));
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    START TRANSACTION;

    UPDATE `Roles`
    SET `Name` = p_Name,
        `Description` = p_Description,
        `UpdatedBy` = p_UpdatedBy
    WHERE `RoleId` = p_RoleId AND `IsActive` = 1;

    -- Clear existing permissions for this role
    DELETE FROM `RolePermissions` WHERE `RoleId` = p_RoleId;

    -- Parse and insert new permissions
    IF p_PermissionsJson IS NOT NULL AND JSON_VALID(p_PermissionsJson) THEN
        SET v_PermissionCount = JSON_LENGTH(p_PermissionsJson);
        WHILE v_Index < v_PermissionCount DO
            SET v_ModuleCode = JSON_UNQUOTE(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].ModuleCode')));
            
            IF v_ModuleCode IS NOT NULL AND v_ModuleCode <> 'null' AND v_ModuleCode <> '' THEN
                SET v_CanCreate = IFNULL(CAST(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].CanCreate')) AS SIGNED), 0);
                SET v_CanRead = IFNULL(CAST(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].CanRead')) AS SIGNED), 0);
                SET v_CanUpdate = IFNULL(CAST(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].CanUpdate')) AS SIGNED), 0);
                SET v_CanDelete = IFNULL(CAST(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].CanDelete')) AS SIGNED), 0);

                INSERT INTO `RolePermissions` (
                    `RoleId`,
                    `ModuleCode`,
                    `CanCreate`,
                    `CanRead`,
                    `CanUpdate`,
                    `CanDelete`
                ) VALUES (
                    p_RoleId,
                    v_ModuleCode,
                    v_CanCreate,
                    v_CanRead,
                    v_CanUpdate,
                    v_CanDelete
                );
            END IF;
            SET v_Index = v_Index + 1;
        END WHILE;
    END IF;

    COMMIT;
    SELECT 'Success' AS Status, 'Role updated successfully.' AS Message;
END //

DELIMITER ;
