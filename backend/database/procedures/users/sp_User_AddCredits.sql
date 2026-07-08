DELIMITER //

DROP PROCEDURE IF EXISTS `sp_User_AddCredits` //

CREATE PROCEDURE `sp_User_AddCredits` (
    IN p_UserId INT,
    IN p_Amount DECIMAL(10,2)
)
BEGIN
    INSERT INTO StudentCreditWallets (UserId, Balance, CreatedAt, UpdatedAt)
    VALUES (p_UserId, p_Amount, NOW(), NOW())
    ON DUPLICATE KEY UPDATE 
        Balance = Balance + p_Amount,
        UpdatedAt = NOW();
END //

DELIMITER ;
