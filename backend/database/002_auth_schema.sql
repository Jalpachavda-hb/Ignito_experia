USE `ignito_experia`;

-- 1. Create StudentProfiles
CREATE TABLE IF NOT EXISTS `StudentProfiles` (
    `StudentProfileId` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `UserId` BIGINT NULL,
    `ExternalStudentId` VARCHAR(100) NULL,
    `UniversityId` BIGINT NULL,
    `FirstName` VARCHAR(100),
    `LastName` VARCHAR(100),
    `Email` VARCHAR(255),
    `Mobile` VARCHAR(20),
    `DepartmentId` BIGINT NULL,
    `ProgramId` BIGINT NULL,
    `SemesterId` BIGINT NULL,
    `Batch` VARCHAR(50),
    `Section` VARCHAR(50),
    `AuthenticationSource` ENUM('DIRECT', 'LMS') NOT NULL,
    `Status` VARCHAR(20) DEFAULT 'Active',
    `LastLogin` DATETIME NULL,
    `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `UpdatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `DeletedAt` DATETIME NULL,
    INDEX `IDX_StudentProfiles_UserId` (`UserId`),
    INDEX `IDX_StudentProfiles_External` (`ExternalStudentId`),
    INDEX `IDX_StudentProfiles_Email` (`Email`),
    CONSTRAINT `FK_StudentProfiles_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users`(`UserId`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create StudentSessions
CREATE TABLE IF NOT EXISTS `StudentSessions` (
    `SessionId` VARCHAR(100) PRIMARY KEY,
    `StudentProfileId` BIGINT NOT NULL,
    `AuthenticationSource` ENUM('DIRECT', 'LMS') NOT NULL,
    `UniversityId` BIGINT NULL,
    `AccessTokenId` VARCHAR(100) NULL,
    `RefreshTokenId` VARCHAR(100) NULL,
    `IPAddress` VARCHAR(45),
    `Browser` VARCHAR(100),
    `OS` VARCHAR(100),
    `Device` VARCHAR(100),
    `Country` VARCHAR(100),
    `City` VARCHAR(100),
    `LoginTime` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `LogoutTime` DATETIME NULL,
    `LastActivity` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `Status` VARCHAR(20) DEFAULT 'Active',
    INDEX `IDX_StudentSessions_Profile` (`StudentProfileId`),
    CONSTRAINT `FK_StudentSessions_Profile` FOREIGN KEY (`StudentProfileId`) REFERENCES `StudentProfiles`(`StudentProfileId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create RefreshTokens
CREATE TABLE IF NOT EXISTS `RefreshTokens` (
    `Id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `StudentProfileId` BIGINT NOT NULL,
    `SessionId` VARCHAR(100) NOT NULL,
    `TokenHash` VARCHAR(255) NOT NULL,
    `ExpiresAt` DATETIME NOT NULL,
    `RevokedAt` DATETIME NULL,
    `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `IDX_RefreshTokens_Profile` (`StudentProfileId`),
    INDEX `IDX_RefreshTokens_Session` (`SessionId`),
    CONSTRAINT `FK_RefreshTokens_Profile` FOREIGN KEY (`StudentProfileId`) REFERENCES `StudentProfiles`(`StudentProfileId`) ON DELETE CASCADE,
    CONSTRAINT `FK_RefreshTokens_Session` FOREIGN KEY (`SessionId`) REFERENCES `StudentSessions`(`SessionId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create AuditLogs
CREATE TABLE IF NOT EXISTS `AuditLogs` (
    `Id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `SessionId` VARCHAR(100) NULL,
    `StudentProfileId` BIGINT NULL,
    `UniversityId` BIGINT NULL,
    `AuthenticationSource` ENUM('DIRECT', 'LMS') NULL,
    `Action` VARCHAR(100) NOT NULL,
    `Description` TEXT NULL,
    `IPAddress` VARCHAR(45) NULL,
    `Browser` VARCHAR(100) NULL,
    `OS` VARCHAR(100) NULL,
    `Device` VARCHAR(100) NULL,
    `Status` VARCHAR(20) DEFAULT 'Success',
    `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `IDX_AuditLogs_Session` (`SessionId`),
    INDEX `IDX_AuditLogs_Profile` (`StudentProfileId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Create UsedLmsTokens (Replay Attack Prevention)
CREATE TABLE IF NOT EXISTS `UsedLmsTokens` (
    `jti` VARCHAR(255) PRIMARY KEY,
    `expiresAt` DATETIME NOT NULL,
    `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
