USE `ignito_experia`;

-- 1. Redesign AuditLogs table for Enterprise Tracing
-- In a real production migration, we might create a temporary table, migrate data, and rename.
-- For this fresh deployment phase, we assume we can safely alter or recreate the table if it was empty.
DROP TABLE IF EXISTS `StudentAudits`; -- Phase 3 legacy
DROP TABLE IF EXISTS `AuditLogs`;

CREATE TABLE `AuditLogs` (
    `Id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `RequestId` VARCHAR(100) NULL,
    `CorrelationId` VARCHAR(100) NULL,
    `TraceId` VARCHAR(100) NULL,
    
    `SessionId` VARCHAR(100) NULL,
    `StudentProfileId` BIGINT NULL,
    `UniversityId` INT NULL,
    `DepartmentId` INT NULL,
    `ProgramId` INT NULL,
    `SemesterId` INT NULL,
    
    `Source` ENUM('DIRECT', 'LMS', 'SYSTEM', 'ADMIN') NOT NULL DEFAULT 'SYSTEM',
    `Category` ENUM('Authentication', 'Student', 'Faculty', 'Lab', 'Compiler', 'Submission', 'Container', 'Administration', 'Security', 'System') NOT NULL,
    `Severity` ENUM('Information', 'Warning', 'Error', 'Critical') NOT NULL DEFAULT 'Information',
    `Action` VARCHAR(100) NOT NULL,
    
    `Module` VARCHAR(100) NULL,
    `Entity` VARCHAR(100) NULL,
    `EntityId` VARCHAR(100) NULL,
    `Description` TEXT NULL,
    
    `OldValues` JSON NULL,
    `NewValues` JSON NULL,
    
    `IPAddress` VARCHAR(45) NULL,
    `Browser` VARCHAR(100) NULL,
    `Device` VARCHAR(100) NULL,
    `OperatingSystem` VARCHAR(100) NULL,
    `Country` VARCHAR(100) NULL,
    `City` VARCHAR(100) NULL,
    
    `Status` VARCHAR(50) DEFAULT 'SUCCESS',
    `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `IDX_Audit_Correlation` (`CorrelationId`),
    INDEX `IDX_Audit_Request` (`RequestId`),
    INDEX `IDX_Audit_Category` (`Category`),
    INDEX `IDX_Audit_Severity` (`Severity`),
    INDEX `IDX_Audit_Action` (`Action`),
    INDEX `IDX_Audit_Source` (`Source`),
    INDEX `IDX_Audit_StudentProfileId` (`StudentProfileId`),
    INDEX `IDX_Audit_UniversityId` (`UniversityId`),
    INDEX `IDX_Audit_SessionId` (`SessionId`),
    INDEX `IDX_Audit_CreatedAt` (`CreatedAt`),
    INDEX `IDX_Audit_Status` (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create AuditLogs_Archive table for Retention Polices
CREATE TABLE `AuditLogs_Archive` LIKE `AuditLogs`;
