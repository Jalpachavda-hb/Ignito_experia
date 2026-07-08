DELIMITER //

DROP PROCEDURE IF EXISTS `sp_User_Delete` //

CREATE PROCEDURE `sp_User_Delete` (
    IN p_UserId INT,
    IN p_DeletedBy INT
)
BEGIN
    -- Soft Delete User
    UPDATE Users 
    SET 
        IsDeleted = 1,
        DeletedBy = p_DeletedBy,
        DeletedAt = NOW()
    WHERE UserId = p_UserId;
END //

DELIMITER ;
