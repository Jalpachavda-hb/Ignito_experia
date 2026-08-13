-- ============================================================
-- Ignito Experia Database Schema (VLab Core Backend)
-- Database: ignito_experia
-- Total Active Tables: 20
-- ============================================================

CREATE DATABASE IF NOT EXISTS `ignito_experia`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `ignito_experia`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Error Logs Table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Labs Catalog Table
CREATE TABLE IF NOT EXISTS `Labs` (
  `LabId` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `TenantId` BIGINT NULL,
  `LabCode` VARCHAR(100) NOT NULL UNIQUE,
  `Title` VARCHAR(200) NOT NULL,
  `Subtitle` VARCHAR(300),
  `Semester` VARCHAR(100),
  `Logo` VARCHAR(255),
  `DurationMinutes` INT DEFAULT 0,
  `Credits` INT DEFAULT 0,
  `Complexity` VARCHAR(50),
  `Category` VARCHAR(100),
  `Description` LONGTEXT,
  `TaskDefinition` VARCHAR(200),
  `RuntimeType` ENUM('ide', 'terminal', 'jupyter', 'emulator') DEFAULT 'ide',
  `RuntimePort` INT,
  `RuntimePath` VARCHAR(200),
  `ContainerApiEnabled` TINYINT(1) DEFAULT 0,
  `ContainerApiPort` INT,
  `DisplayOrder` INT DEFAULT 0,
  `Status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
  `CreatedBy` BIGINT NULL,
  `UpdatedBy` BIGINT NULL,
  `CreatedDate` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `UpdatedDate` DATETIME NULL,
  INDEX `IDX_Labs_LabCode` (`LabCode`),
  INDEX `IDX_Labs_RuntimeType` (`RuntimeType`),
  INDEX `IDX_Labs_Status` (`Status`),
  INDEX `IDX_Labs_Category` (`Category`),
  INDEX `IDX_Labs_TenantId` (`TenantId`),
  INDEX `IDX_Labs_IsDeleted` (`IsDeleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Roles Table
CREATE TABLE IF NOT EXISTS `Roles` (
  `RoleId` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `Name` VARCHAR(100) NOT NULL UNIQUE,
  `Description` TEXT NULL,
  `IsSystem` TINYINT(1) NOT NULL DEFAULT 0,
  `IsActive` TINYINT(1) NOT NULL DEFAULT 1,
  `CreatedBy` BIGINT NULL,
  `UpdatedBy` BIGINT NULL,
  `CreatedDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdatedDate` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX `IDX_Roles_Name` (`Name`),
  INDEX `IDX_Roles_IsActive` (`IsActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Role Permissions Table
CREATE TABLE IF NOT EXISTS `RolePermissions` (
  `PermissionId` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `RoleId` BIGINT NOT NULL,
  `ModuleCode` VARCHAR(100) NOT NULL,
  `CanCreate` TINYINT(1) NOT NULL DEFAULT 0,
  `CanRead` TINYINT(1) NOT NULL DEFAULT 0,
  `CanUpdate` TINYINT(1) NOT NULL DEFAULT 0,
  `CanDelete` TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT `FK_RolePermissions_RoleId` FOREIGN KEY (`RoleId`) REFERENCES `Roles`(`RoleId`) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY `UQ_RolePermissions_RoleId_ModuleCode` (`RoleId`, `ModuleCode`),
  INDEX `IDX_RolePermissions_RoleId` (`RoleId`),
  INDEX `IDX_RolePermissions_ModuleCode` (`ModuleCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Users Table
CREATE TABLE IF NOT EXISTS `Users` (
  `UserId` INT AUTO_INCREMENT PRIMARY KEY,
  `FullName` VARCHAR(255) NOT NULL,
  `Email` VARCHAR(255) NOT NULL UNIQUE,
  `PasswordHash` VARCHAR(255) NOT NULL,
  `Role` VARCHAR(50) NOT NULL,
  `Status` VARCHAR(20) DEFAULT 'Active',
  `ProgramId` INT NULL,
  `SemesterId` INT NULL,
  `RoleId` BIGINT NULL,
  `PhoneNumber` VARCHAR(50) NULL,
  `IsDeleted` BOOLEAN DEFAULT 0,
  `DeletedAt` DATETIME NULL,
  `DeletedBy` INT NULL,
  `LastLoginAt` DATETIME NULL,
  `CreatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `CreatedBy` INT NULL,
  `UpdatedBy` INT NULL,
  `ExternalStudentId` VARCHAR(100) NULL,
  `UniversityId` BIGINT NULL,
  `Mobile` VARCHAR(20) NULL,
  `DepartmentId` BIGINT NULL,
  `Batch` VARCHAR(50) NULL,
  `Section` VARCHAR(50) NULL,
  `AuthenticationSource` VARCHAR(50) NULL,
  INDEX `IDX_Users_Email` (`Email`),
  INDEX `IDX_Users_RoleId` (`RoleId`),
  INDEX `IDX_Users_External` (`ExternalStudentId`),
  CONSTRAINT `FK_Users_RoleId` FOREIGN KEY (`RoleId`) REFERENCES `Roles`(`RoleId`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. User Refresh Tokens
CREATE TABLE IF NOT EXISTS `UserRefreshTokens` (
  `TokenId` INT AUTO_INCREMENT PRIMARY KEY,
  `UserId` INT NOT NULL,
  `RefreshToken` VARCHAR(500) NOT NULL UNIQUE,
  `ExpiresAt` DATETIME NOT NULL,
  `CreatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `IsRevoked` TINYINT(1) DEFAULT 0,
  CONSTRAINT `FK_UserRefreshTokens_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users`(`UserId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Runtime Types
CREATE TABLE IF NOT EXISTS `RuntimeTypes` (
  `Id` INT AUTO_INCREMENT PRIMARY KEY,
  `Value` VARCHAR(50) NOT NULL UNIQUE,
  `Label` VARCHAR(100) NOT NULL,
  `IsActive` TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Registered Devices
CREATE TABLE IF NOT EXISTS `RegisteredDevices` (
  `DeviceId` VARCHAR(100) PRIMARY KEY,
  `UserId` INT NOT NULL,
  `DeviceFingerprint` VARCHAR(255) NOT NULL,
  `DeviceName` VARCHAR(100) NULL,
  `Browser` VARCHAR(100) NULL,
  `BrowserVersion` VARCHAR(50) NULL,
  `OperatingSystem` VARCHAR(100) NULL,
  `OperatingSystemVersion` VARCHAR(50) NULL,
  `Platform` VARCHAR(50) NULL,
  `IPAddress` VARCHAR(45) NULL,
  `Timezone` VARCHAR(100) NULL,
  `Trusted` BOOLEAN DEFAULT FALSE,
  `FirstLogin` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `LastLogin` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `Status` VARCHAR(20) DEFAULT 'ACTIVE',
  INDEX `IDX_RegisteredDevices_UserId` (`UserId`),
  INDEX `IDX_RegisteredDevices_Fingerprint` (`DeviceFingerprint`),
  CONSTRAINT `FK_RegisteredDevices_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users`(`UserId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Student Sessions
CREATE TABLE IF NOT EXISTS `StudentSessions` (
  `SessionId` VARCHAR(100) PRIMARY KEY,
  `UserId` INT NOT NULL,
  `DeviceId` VARCHAR(100) NULL,
  `LoginSource` ENUM('DIRECT', 'LMS') NOT NULL,
  `UniversityId` BIGINT NULL,
  `AccessTokenId` VARCHAR(100) NULL,
  `RefreshTokenId` VARCHAR(100) NULL,
  `IPAddress` VARCHAR(45),
  `LoginTime` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `LogoutTime` DATETIME NULL,
  `LastActivity` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `LastRefresh` DATETIME NULL,
  `ExpiresAt` DATETIME NULL,
  `IdleExpiresAt` DATETIME NULL,
  `Status` VARCHAR(20) DEFAULT 'ACTIVE',
  INDEX `IDX_StudentSessions_User` (`UserId`),
  INDEX `IDX_StudentSessions_Status` (`Status`),
  INDEX `IDX_StudentSessions_LoginSource` (`LoginSource`),
  INDEX `IDX_StudentSessions_UniversityId` (`UniversityId`),
  INDEX `IDX_StudentSessions_CreatedAt` (`LoginTime`),
  INDEX `IDX_StudentSessions_LastActivity` (`LastActivity`),
  INDEX `IDX_StudentSessions_ExpiresAt` (`ExpiresAt`),
  CONSTRAINT `FK_StudentSessions_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users`(`UserId`) ON DELETE CASCADE,
  CONSTRAINT `FK_StudentSessions_Device` FOREIGN KEY (`DeviceId`) REFERENCES `RegisteredDevices`(`DeviceId`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Refresh Tokens
CREATE TABLE IF NOT EXISTS `RefreshTokens` (
  `Id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `UserId` INT NOT NULL,
  `SessionId` VARCHAR(100) NOT NULL,
  `TokenHash` VARCHAR(255) NOT NULL,
  `ExpiresAt` DATETIME NOT NULL,
  `RevokedAt` DATETIME NULL,
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `IDX_RefreshTokens_User` (`UserId`),
  INDEX `IDX_RefreshTokens_Session` (`SessionId`),
  CONSTRAINT `FK_RefreshTokens_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users`(`UserId`) ON DELETE CASCADE,
  CONSTRAINT `FK_RefreshTokens_Session` FOREIGN KEY (`SessionId` ) REFERENCES `StudentSessions`(`SessionId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Audit Logs
CREATE TABLE IF NOT EXISTS `AuditLogs` (
  `Id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `RequestId` VARCHAR(100) NULL,
  `CorrelationId` VARCHAR(100) NULL,
  `TraceId` VARCHAR(100) NULL,
  `SessionId` VARCHAR(100) NULL,
  `UserId` INT NULL,
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
  INDEX `IDX_Audit_UserId` (`UserId`),
  INDEX `IDX_Audit_UniversityId` (`UniversityId`),
  INDEX `IDX_Audit_SessionId` (`SessionId`),
  INDEX `IDX_Audit_CreatedAt` (`CreatedAt`),
  INDEX `IDX_Audit_Status` (`Status`),
  CONSTRAINT `FK_AuditLogs_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users`(`UserId`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Audit Logs Archive
CREATE TABLE IF NOT EXISTS `AuditLogs_Archive` (
  `Id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `RequestId` VARCHAR(100) NULL,
  `CorrelationId` VARCHAR(100) NULL,
  `TraceId` VARCHAR(100) NULL,
  `SessionId` VARCHAR(100) NULL,
  `UserId` INT NULL,
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
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Used LMS Tokens
CREATE TABLE IF NOT EXISTS `UsedLmsTokens` (
  `jti` VARCHAR(255) PRIMARY KEY,
  `expiresAt` DATETIME NOT NULL,
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Student Audits
CREATE TABLE IF NOT EXISTS `StudentAudits` (
  `StudentAuditId` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `UserId` INT NOT NULL,
  `Action` VARCHAR(50) NOT NULL,
  `FieldName` VARCHAR(100) NULL,
  `OldValue` TEXT NULL,
  `NewValue` TEXT NULL,
  `ChangedByUserId` BIGINT NULL,
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `IDX_StudentAudits_User` (`UserId`),
  CONSTRAINT `FK_StudentAudits_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users`(`UserId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Student Credit Wallets
CREATE TABLE IF NOT EXISTS `StudentCreditWallets` (
  `WalletId` INT AUTO_INCREMENT PRIMARY KEY,
  `UserId` INT NOT NULL,
  `Balance` DECIMAL(10,2) DEFAULT 0.00,
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `FK_Wallet_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users`(`UserId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Analytics Daily Summary
CREATE TABLE IF NOT EXISTS `Analytics_DailySummary` (
  `SummaryDate` DATE NOT NULL,
  `UniversityId` INT NOT NULL DEFAULT 0,
  `TotalLogins` INT DEFAULT 0,
  `UniqueActiveUsers` INT DEFAULT 0,
  `FailedLogins` INT DEFAULT 0,
  `LabsStarted` INT DEFAULT 0,
  `LabsCompleted` INT DEFAULT 0,
  `AvgSessionDurationMinutes` INT DEFAULT 0,
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`SummaryDate`, `UniversityId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Analytics Monthly Summary
CREATE TABLE IF NOT EXISTS `Analytics_MonthlySummary` (
  `SummaryMonth` VARCHAR(7) NOT NULL,
  `UniversityId` INT NOT NULL DEFAULT 0,
  `TotalLogins` INT DEFAULT 0,
  `UniqueActiveUsers` INT DEFAULT 0,
  `FailedLogins` INT DEFAULT 0,
  `LabsStarted` INT DEFAULT 0,
  `LabsCompleted` INT DEFAULT 0,
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`SummaryMonth`, `UniversityId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Analytics Device Summary
CREATE TABLE IF NOT EXISTS `Analytics_DeviceSummary` (
  `SummaryDate` DATE NOT NULL,
  `Platform` VARCHAR(100) NOT NULL,
  `PlatformType` ENUM('BROWSER', 'OS') NOT NULL,
  `SessionCount` INT DEFAULT 0,
  PRIMARY KEY (`SummaryDate`, `Platform`, `PlatformType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Tenants Table
CREATE TABLE IF NOT EXISTS `tenants` (
  `DbId` INT AUTO_INCREMENT PRIMARY KEY,
  `TenantId` VARCHAR(64) UNIQUE NOT NULL,
  `Name` VARCHAR(255) UNIQUE NOT NULL,
  `Slug` VARCHAR(100) UNIQUE NOT NULL,
  `OfficialDomain` VARCHAR(255) NULL,
  `LogoUrl` TEXT NULL,
  `IntegrationMode` VARCHAR(50) DEFAULT 'LMS',
  `AdminFullName` VARCHAR(200) NULL,
  `AdminEmail` VARCHAR(255) NULL,
  `AdminPasswordHash` VARCHAR(255) NULL,
  `AdminPhone` VARCHAR(50) NULL,
  `Status` VARCHAR(50) DEFAULT 'ACTIVE',
  `SettingsJson` JSON NULL,
  `CreatedDate` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `UpdatedDate` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. User Tenant Mapping Table
CREATE TABLE IF NOT EXISTS `user_tenant_mapping` (
  `MappingId` INT AUTO_INCREMENT PRIMARY KEY,
  `UserId` INT NOT NULL,
  `TenantId` VARCHAR(64) NOT NULL,
  `Role` ENUM('TENANT_ADMIN', 'STUDENT') NOT NULL DEFAULT 'TENANT_ADMIN',
  `Status` VARCHAR(50) DEFAULT 'ACTIVE',
  `AssignedDate` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_user_tenant_unique` (`UserId`, `TenantId`),
  INDEX `idx_tenant_role` (`TenantId`, `Role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
