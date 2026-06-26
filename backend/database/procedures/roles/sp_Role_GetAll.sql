DROP PROCEDURE IF EXISTS `sp_Role_GetAll`;

DELIMITER //

CREATE PROCEDURE `sp_Role_GetAll` ()
BEGIN
    DECLARE v_ErrorNumber INT;
    DECLARE v_ErrorMessage TEXT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1
            v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
        CALL sp_LogError('Roles', 'sp_Role_GetAll', v_ErrorMessage, v_ErrorNumber, 'No parameters');
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    -- Return all active roles with their permission rows + user count
    SELECT
        r.`RoleId`,
        r.`Name`,
        r.`Description`,
        r.`IsSystem`,
        r.`IsActive`,
        r.`CreatedBy`,
        r.`UpdatedBy`,
        r.`CreatedDate`,
        r.`UpdatedDate`,
        (SELECT COUNT(*) FROM `Users` u WHERE u.`RoleId` = r.`RoleId`) AS `UserCount`,
        rp.`PermissionId`,
        rp.`ModuleCode`,
        rp.`CanCreate`,
        rp.`CanRead`,
        rp.`CanUpdate`,
        rp.`CanDelete`
    FROM `Roles` r
    LEFT JOIN `RolePermissions` rp ON rp.`RoleId` = r.`RoleId`
    WHERE r.`IsActive` = 1
    ORDER BY r.`RoleId` ASC, rp.`ModuleCode` ASC;

END //

DELIMITER ;
