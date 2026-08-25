-- ============================================================
-- Ignito Experia Database Schema (VLab Core Backend)
-- Database: ignito_experia
-- ============================================================

CREATE DATABASE IF NOT EXISTS `ignito_experia`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `ignito_experia`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `Users` (
  `UserId` INT AUTO_INCREMENT PRIMARY KEY,
  `FullName` VARCHAR(255) NOT NULL,
  `Email` VARCHAR(255) NOT NULL UNIQUE,
  `PasswordHash` VARCHAR(255) NOT NULL,
  `Role` ENUM('STUDENT', 'TENANT_ADMIN') NOT NULL DEFAULT 'STUDENT',
  `Status` VARCHAR(20) DEFAULT 'Active',
  `ProgramId` INT NULL,
  `SemesterId` INT NULL,
  `PhoneNumber` VARCHAR(50) NULL,
  `ProfileImage` VARCHAR(500) NULL,
  `IsDeleted` BOOLEAN DEFAULT 0,
  `DeletedAt` DATETIME NULL,
  `DeletedBy` INT NULL,
  `LastLoginAt` DATETIME NULL,
  `CreatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `CreatedBy` INT NULL,
  `UpdatedBy` INT NULL,
  `ExternalStudentId` VARCHAR(100) NULL,
  `StudentDegreeAdmissionId` VARCHAR(50) NULL,
  `StudentId` VARCHAR(50) NULL,
  `UniversityId` BIGINT NULL,
  `TenantId` VARCHAR(64) NULL,
  `Mobile` VARCHAR(20) NULL,
  `DepartmentId` BIGINT NULL,
  `Batch` VARCHAR(50) NULL,
  `Section` VARCHAR(50) NULL,
  `AuthenticationSource` VARCHAR(50) NULL,
  INDEX `IDX_Users_Email` (`Email`),
  INDEX `IDX_Users_External` (`ExternalStudentId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Registered Devices
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

-- 3. Student Sessions
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

-- 4. Refresh Tokens
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
  CONSTRAINT `FK_RefreshTokens_Session` FOREIGN KEY (`SessionId`) REFERENCES `StudentSessions`(`SessionId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Audit Logs
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

-- 6. Audit Logs Archive
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

-- 7. Student Credit Wallets
CREATE TABLE IF NOT EXISTS `StudentCreditWallets` (
  `WalletId` INT AUTO_INCREMENT PRIMARY KEY,
  `UserId` INT NOT NULL,
  `Balance` DECIMAL(10,2) DEFAULT 0.00,
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `FK_Wallet_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users`(`UserId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tenants Table
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

-- 9. User Tenant Mapping Table
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

-- 10. Course Lab Mappings Table
CREATE TABLE IF NOT EXISTS `course_lab_mappings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'TEN000001',
  `program_id` VARCHAR(64) NOT NULL,
  `semester_id` VARCHAR(64) NOT NULL,
  `course_code` VARCHAR(64) NOT NULL,
  `lab_id` VARCHAR(64) NOT NULL,
  `status` VARCHAR(20) DEFAULT 'active',
  `mapped_by` VARCHAR(64) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_tenant_course_lab` (`tenant_id`, `program_id`, `semester_id`, `course_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
