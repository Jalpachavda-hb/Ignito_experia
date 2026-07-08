DELIMITER //

DROP PROCEDURE IF EXISTS `sp_User_Insert` //

CREATE PROCEDURE `sp_User_Insert` (
    IN p_FullName VARCHAR(255),
    IN p_Email VARCHAR(255),
    IN p_PhoneNumber VARCHAR(50),
    IN p_PasswordHash VARCHAR(255),
    IN p_RoleId INT,
    IN p_Status VARCHAR(50),
    IN p_EnrollmentNumber VARCHAR(50),
    IN p_ProgramId INT,
    IN p_SemesterId INT,
    IN p_CreatedBy INT,
    OUT p_NewUserId INT
)
BEGIN
    -- Role column is kept for backward compatibility if needed, but we rely on RoleId.
    DECLARE v_RoleName VARCHAR(50);
    SELECT Name INTO v_RoleName FROM Roles WHERE RoleId = p_RoleId;

    INSERT INTO Users (
        FullName, 
        Email, 
        PhoneNumber, 
        PasswordHash, 
        Role, 
        RoleId, 
        Status, 
        CreatedBy, 
        CreatedAt
    )
    VALUES (
        p_FullName, 
        p_Email, 
        p_PhoneNumber, 
        p_PasswordHash, 
        v_RoleName, 
        p_RoleId, 
        p_Status, 
        p_CreatedBy, 
        NOW()
    );
    
    SET p_NewUserId = LAST_INSERT_ID();
END //

DELIMITER ;
