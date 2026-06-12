DROP PROCEDURE IF EXISTS `sp_LogError`;

DELIMITER //

CREATE PROCEDURE `sp_LogError` (
    IN p_ModuleName VARCHAR(100),
    IN p_ProcedureName VARCHAR(100),
    IN p_ErrorMessage TEXT,
    IN p_ErrorNumber INT,
    IN p_RequestData LONGTEXT
)
BEGIN
    INSERT INTO `ErrorLogs` (`ModuleName`, `ProcedureName`, `ErrorMessage`, `ErrorNumber`, `RequestData`)
    VALUES (p_ModuleName, p_ProcedureName, p_ErrorMessage, p_ErrorNumber, p_RequestData);
END //

DELIMITER ;
