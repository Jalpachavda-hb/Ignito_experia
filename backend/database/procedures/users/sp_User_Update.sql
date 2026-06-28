DELIMITER //

DROP PROCEDURE IF EXISTS `sp_User_Update` //

CREATE PROCEDURE `sp_User_Update` (
    IN p_UserId INT,
    IN p_FullName VARCHAR(255),
    IN p_PhoneNumber VARCHAR(50),
    IN p_RoleId INT,
    IN p_EnrollmentNumber VARCHAR(50),
    IN p_ProgramId INT,
    IN p_SemesterId INT,
    IN p_UpdatedBy INT
)
BEGIN
    DECLARE v_RoleName VARCHAR(50);
    SELECT Name INTO v_RoleName FROM Roles WHERE RoleId = p_RoleId;

    UPDATE Users 
    SET 
        FullName = p_FullName,
        PhoneNumber = p_PhoneNumber,
        Role = v_RoleName,
        RoleId = p_RoleId,
        UpdatedBy = p_UpdatedBy,
        UpdatedAt = NOW()
    WHERE UserId = p_UserId;
END //

DELIMITER ;
