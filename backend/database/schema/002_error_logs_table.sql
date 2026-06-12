CREATE TABLE IF NOT EXISTS `ErrorLogs` (
    `ErrorLogId` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `ModuleName` VARCHAR(100),
    `ProcedureName` VARCHAR(100),
    `ErrorMessage` TEXT,
    `ErrorNumber` INT,
    `RequestData` LONGTEXT,
    `CreatedDate` DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `IDX_ErrorLogs_ModuleName` (`ModuleName`),
    INDEX `IDX_ErrorLogs_ProcedureName` (`ProcedureName`),
    INDEX `IDX_ErrorLogs_CreatedDate` (`CreatedDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Centralized system error logging table';
