DROP PROCEDURE IF EXISTS `sp_Owner_Auth_Login`;

DELIMITER //

CREATE PROCEDURE `sp_Owner_Auth_Login` (
    IN p_Email VARCHAR(255)
)
BEGIN
    DECLARE v_ErrorNumber INT;
    DECLARE v_ErrorMessage TEXT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1
            v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
        CALL sp_LogError('owner_users', 'sp_Owner_Auth_Login', v_ErrorMessage, v_ErrorNumber, CONCAT('Email: ', IFNULL(p_Email, 'NULL')));
        SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
    END;

    SELECT 
        `OwnerId`,
        `FullName`,
        `Email`,
        `PasswordHash`,
        `Role`,
        `Status`
    FROM `owner_users`
    WHERE `Email` = p_Email AND `Status` = 'active'
    LIMIT 1;
END //

DELIMITER ;
