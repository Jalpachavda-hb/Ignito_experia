DROP PROCEDURE IF EXISTS `sp_Role_Insert`;

DELIMITER //

CREATE PROCEDURE `sp_Role_Insert` (
    IN p_Name VARCHAR(100),
    IN p_Description TEXT,
    IN p_IsSystem TINYINT(1),
    IN p_CreatedBy BIGINT,
    IN p_PermissionsJson LONGTEXT
)
BEGIN
    DECLARE v_ErrorNumber INT;
    DECLARE v_ErrorMessage TEXT;
    DECLARE v_RoleId BIGINT;
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
        CALL sp_LogError('Roles', 'sp_Role_Insert', v_ErrorMessage, v_ErrorNumber, CONCAT('Name: ', IFNULL(p_Name, 'NULL')));
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    START TRANSACTION;

    INSERT INTO `Roles` (
        `Name`,
        `Description`,
        `IsSystem`,
        `IsActive`,
        `CreatedBy`,
        `CreatedDate`
    ) VALUES (
        p_Name,
        p_Description,
        IFNULL(p_IsSystem, 0),
        1,
        p_CreatedBy,
        NOW()
    );

    SET v_RoleId = LAST_INSERT_ID();

    -- Parse and insert permissions
    IF p_PermissionsJson IS NOT NULL AND JSON_VALID(p_PermissionsJson) THEN
        SET v_PermissionCount = JSON_LENGTH(p_PermissionsJson);
        WHILE v_Index < v_PermissionCount DO
            SET v_ModuleCode = JSON_UNQUOTE(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].ModuleCode')));
            
            -- JSON_EXTRACT can return JSON null. Check if the extracted string is actually NULL or 'null'
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
                    v_RoleId,
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
    SELECT 'Success' AS Status, 'Role inserted successfully.' AS Message, v_RoleId AS InsertedId;
END //

DELIMITER ;
