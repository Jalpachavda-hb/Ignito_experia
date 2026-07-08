DELIMITER //

DROP PROCEDURE IF EXISTS `sp_User_GetById` //

CREATE PROCEDURE `sp_User_GetById` (
    IN p_UserId INT
)
BEGIN
    SELECT 
        u.UserId, 
        u.FullName, 
        u.Email, 
        u.PhoneNumber,
        u.RoleId,
        r.Name AS Role, 
        u.Status, 
        NULL AS EnrollmentNumber,
        NULL AS ProgramId, 
        NULL AS SemesterId, 
        COALESCE(w.Balance, 0) AS CreditBalance,
        u.LastLoginAt, 
        u.CreatedAt,
        u.UpdatedAt
    FROM Users u
    LEFT JOIN Roles r ON u.RoleId = r.RoleId
    LEFT JOIN StudentCreditWallets w ON u.UserId = w.UserId
    WHERE u.UserId = p_UserId AND COALESCE(u.IsDeleted, 0) = 0;
END //

DELIMITER ;
