DROP PROCEDURE IF EXISTS `sp_LogError`;

DELIMITER //

CREATE PROCEDURE `sp_LogError`(
    IN p_TableName VARCHAR(100),
    IN p_ProcedureName VARCHAR(100),
    IN p_ErrorMessage TEXT,
    IN p_ErrorNumber INT,
    IN p_Parameters TEXT
)
BEGIN
    INSERT INTO `error_logs` (`TableName`, `ProcedureName`, `ErrorMessage`, `ErrorNumber`, `Parameters`)
    VALUES (p_TableName, p_ProcedureName, p_ErrorMessage, p_ErrorNumber, p_Parameters);
END //

DELIMITER ;
