DELIMITER //

DROP PROCEDURE IF EXISTS `sp_User_UpdateStatus` //

CREATE PROCEDURE `sp_User_UpdateStatus` (
    IN p_UserId INT,
    IN p_Status VARCHAR(50),
    IN p_UpdatedBy INT
)
BEGIN
    UPDATE Users 
    SET 
        Status = p_Status,
        UpdatedBy = p_UpdatedBy,
        UpdatedAt = NOW()
    WHERE UserId = p_UserId;
END //

DELIMITER ;
