USE `ignito_experia`;

CREATE TABLE IF NOT EXISTS `FeatureFlags` (
    `FlagId` INT AUTO_INCREMENT PRIMARY KEY,
    `FlagCode` VARCHAR(100) NOT NULL,
    `Description` VARCHAR(255) NULL,
    `UniversityId` INT NULL, -- NULL means GLOBAL default
    `IsEnabled` BOOLEAN DEFAULT FALSE,
    `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `UpdatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX `IDX_FeatureFlags_Unique` (`FlagCode`, `UniversityId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SystemSettings` (
    `SettingId` INT AUTO_INCREMENT PRIMARY KEY,
    `SettingKey` VARCHAR(100) NOT NULL UNIQUE,
    `SettingValue` TEXT NULL,
    `Description` VARCHAR(255) NULL,
    `UpdatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert defaults
INSERT IGNORE INTO `SystemSettings` (`SettingKey`, `SettingValue`, `Description`) VALUES
('THEME_MODE', 'dark', 'Default UI Theme'),
('MAINTENANCE_MODE', 'false', 'Global Maintenance Toggle');

INSERT IGNORE INTO `FeatureFlags` (`FlagCode`, `UniversityId`, `IsEnabled`) VALUES
('VIRTUAL_LABS', NULL, TRUE),
('COMPILER', NULL, TRUE),
('REPORTS', NULL, TRUE),
('CONTAINER_MONITORING', NULL, FALSE);
