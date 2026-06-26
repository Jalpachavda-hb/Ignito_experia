USE `ignito_experia`;

-- 1. Create StudentAudits table for field-level tracking
CREATE TABLE IF NOT EXISTS `StudentAudits` (
    `StudentAuditId` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `StudentProfileId` BIGINT NOT NULL,
    `Action` VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'STATUS_CHANGE'
    `FieldName` VARCHAR(100) NULL,
    `OldValue` TEXT NULL,
    `NewValue` TEXT NULL,
    `ChangedByUserId` BIGINT NULL,
    `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `IDX_StudentAudits_Profile` (`StudentProfileId`),
    CONSTRAINT `FK_StudentAudits_Profile` FOREIGN KEY (`StudentProfileId`) REFERENCES `StudentProfiles`(`StudentProfileId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Modify Status column in StudentProfiles to explicitly support specific values
-- Note: MySQL doesn't easily alter ENUMs without a full rebuild, but we can change the column type or just enforce it in code.
-- We will alter it to VARCHAR(20) to support: ACTIVE, INACTIVE, SUSPENDED, ARCHIVED
ALTER TABLE `StudentProfiles` MODIFY COLUMN `Status` VARCHAR(20) DEFAULT 'ACTIVE';

-- 3. Add rich database indexes for filtering and searching
CREATE INDEX `IDX_StudentProfiles_University` ON `StudentProfiles` (`UniversityId`);
CREATE INDEX `IDX_StudentProfiles_Department` ON `StudentProfiles` (`DepartmentId`);
CREATE INDEX `IDX_StudentProfiles_Program` ON `StudentProfiles` (`ProgramId`);
CREATE INDEX `IDX_StudentProfiles_Semester` ON `StudentProfiles` (`SemesterId`);
CREATE INDEX `IDX_StudentProfiles_Status` ON `StudentProfiles` (`Status`);
CREATE INDEX `IDX_StudentProfiles_Source` ON `StudentProfiles` (`AuthenticationSource`);
CREATE INDEX `IDX_StudentProfiles_SearchName` ON `StudentProfiles` (`FirstName`, `LastName`);

-- Also ensure StudentSessions has login metadata indexes if not present
CREATE INDEX `IDX_StudentSessions_LoginTime` ON `StudentSessions` (`LoginTime`);
