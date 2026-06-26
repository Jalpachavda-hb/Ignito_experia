USE `ignito_experia`;

-- 1. Create RegisteredDevices table
CREATE TABLE IF NOT EXISTS `RegisteredDevices` (
    `DeviceId` VARCHAR(100) PRIMARY KEY,
    `StudentProfileId` BIGINT NOT NULL,
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
    INDEX `IDX_RegisteredDevices_Profile` (`StudentProfileId`),
    INDEX `IDX_RegisteredDevices_Fingerprint` (`DeviceFingerprint`),
    CONSTRAINT `FK_RegisteredDevices_Profile` FOREIGN KEY (`StudentProfileId`) REFERENCES `StudentProfiles`(`StudentProfileId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Alter StudentSessions to align with new architecture
-- Drop old device columns since they belong to RegisteredDevices now
ALTER TABLE `StudentSessions` 
  DROP COLUMN `Browser`,
  DROP COLUMN `OS`,
  DROP COLUMN `Device`,
  DROP COLUMN `Country`,
  DROP COLUMN `City`;

ALTER TABLE `StudentSessions` 
  CHANGE COLUMN `AuthenticationSource` `LoginSource` ENUM('DIRECT', 'LMS') NOT NULL,
  ADD COLUMN `DeviceId` VARCHAR(100) NULL AFTER `StudentProfileId`,
  ADD COLUMN `LastRefresh` DATETIME NULL,
  ADD COLUMN `ExpiresAt` DATETIME NULL,
  ADD COLUMN `IdleExpiresAt` DATETIME NULL,
  MODIFY COLUMN `Status` VARCHAR(20) DEFAULT 'ACTIVE';

ALTER TABLE `StudentSessions`
  ADD CONSTRAINT `FK_StudentSessions_Device` FOREIGN KEY (`DeviceId`) REFERENCES `RegisteredDevices`(`DeviceId`) ON DELETE SET NULL;

-- 3. Add optimal database indexes
CREATE INDEX `IDX_StudentSessions_Status` ON `StudentSessions` (`Status`);
CREATE INDEX `IDX_StudentSessions_LoginSource` ON `StudentSessions` (`LoginSource`);
CREATE INDEX `IDX_StudentSessions_UniversityId` ON `StudentSessions` (`UniversityId`);
CREATE INDEX `IDX_StudentSessions_CreatedAt` ON `StudentSessions` (`LoginTime`);
CREATE INDEX `IDX_StudentSessions_LastActivity` ON `StudentSessions` (`LastActivity`);
CREATE INDEX `IDX_StudentSessions_ExpiresAt` ON `StudentSessions` (`ExpiresAt`);

-- Note: In MySQL ENUM to VARCHAR conversion is safe, but check constraints are app-side.
-- Status values expected: ACTIVE, LOGGED_OUT, EXPIRED, REVOKED, FORCE_LOGOUT, IDLE_TIMEOUT, INVALID_TOKEN
