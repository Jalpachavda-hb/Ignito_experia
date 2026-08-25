-- ============================================================
-- Ignito Experia Owner Database Schema
-- Database: ignito_experia_owner
-- ============================================================

CREATE DATABASE IF NOT EXISTS `ignito_experia_owner`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `ignito_experia_owner`;

-- ============================================================
-- 1. Owner Users Table
-- ============================================================
CREATE TABLE IF NOT EXISTS `owner_users` (
    `OwnerId`      BIGINT AUTO_INCREMENT PRIMARY KEY,
    `FullName`     VARCHAR(255) NOT NULL DEFAULT 'Platform Owner',
    `Email`        VARCHAR(255) NOT NULL UNIQUE,
    `PhoneNumber`  VARCHAR(50)  NOT NULL DEFAULT '1234567890',
    `Designation`  VARCHAR(255) NULL DEFAULT 'Platform Owner',
    `Organization` VARCHAR(255) NULL DEFAULT 'Ignito Experia Owner',
    `AvatarUrl`    VARCHAR(500) NULL,
    `PasswordHash` VARCHAR(255) NOT NULL,
    `Role`         VARCHAR(50)  NOT NULL DEFAULT 'owner',
    `Status`       VARCHAR(20)  NOT NULL DEFAULT 'active',
    `CreatedDate`  DATETIME DEFAULT CURRENT_TIMESTAMP,
    `UpdatedDate`  DATETIME NULL,
    INDEX `IDX_owner_users_Email` (`Email`),
    INDEX `IDX_owner_users_Status` (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. Global Lab Catalog (Single Source of Truth)
-- ============================================================
CREATE TABLE IF NOT EXISTS `labs` (
    `LabId`              BIGINT AUTO_INCREMENT PRIMARY KEY,
    `LabCode`            VARCHAR(100) NOT NULL UNIQUE,
    `Title`              VARCHAR(200) NOT NULL,
    `Subtitle`           VARCHAR(300),
    `Semester`           VARCHAR(100),
    `Logo`               VARCHAR(255),
    `DurationMinutes`    INT          DEFAULT 0,
    `Credits`            INT          DEFAULT 0,
    `Complexity`         VARCHAR(50),
    `Category`           VARCHAR(100),
    `Description`        LONGTEXT,
    `TaskDefinition`     VARCHAR(200),
    `RuntimeType`        VARCHAR(50)  DEFAULT 'ide',
    `RuntimePort`        INT,
    `RuntimePath`        VARCHAR(200),
    `ContainerApiEnabled` TINYINT(1)  DEFAULT 0,
    `ContainerApiPort`   INT,
    `DisplayOrder`       INT          DEFAULT 0,
    `Status`             VARCHAR(20)  NOT NULL DEFAULT 'active',
    `IsDeleted`          TINYINT(1)   NOT NULL DEFAULT 0,
    `CreatedBy`          BIGINT NULL,
    `UpdatedBy`          BIGINT NULL,
    `CreatedDate`        DATETIME     DEFAULT CURRENT_TIMESTAMP,
    `UpdatedDate`        DATETIME NULL,
    INDEX `IDX_labs_LabCode`     (`LabCode`),
    INDEX `IDX_labs_RuntimeType` (`RuntimeType`),
    INDEX `IDX_labs_Status`      (`Status`),
    INDEX `IDX_labs_Category`    (`Category`),
    INDEX `IDX_labs_IsDeleted`   (`IsDeleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. Runtime Types Lookup
-- ============================================================
CREATE TABLE IF NOT EXISTS `runtime_types` (
    `Id`    BIGINT AUTO_INCREMENT PRIMARY KEY,
    `Value` VARCHAR(50) NOT NULL UNIQUE,
    `Label` VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `runtime_types` (`Value`, `Label`) VALUES
    ('ide',        'IDE'),
    ('terminal',   'Terminal'),
    ('jupyter',    'Jupyter Notebook');

-- ============================================================
-- 5. Tenants Table (Root Institutional Metadata & Config)
-- ============================================================
CREATE TABLE IF NOT EXISTS `tenants` (
    `DbId`             BIGINT AUTO_INCREMENT PRIMARY KEY,
    `TenantId`         VARCHAR(50)  NOT NULL UNIQUE, -- e.g., TEN000001
    `Name`             VARCHAR(300) NOT NULL UNIQUE,
    `Slug`             VARCHAR(100) NOT NULL UNIQUE, -- e.g., gtu
    `OfficialDomain`   VARCHAR(255) NULL,
    `LogoUrl`          VARCHAR(500) NULL,
    `IntegrationMode`  VARCHAR(50)  NOT NULL DEFAULT 'LMS', -- 'LMS' or 'DIRECT'
    `Status`           VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'
    `SettingsJson`     JSON         NULL,
    `CreatedBy`        BIGINT NULL,
    `CreatedDate`      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    `UpdatedDate`      DATETIME NULL,
    INDEX `IDX_tenants_TenantId` (`TenantId`),
    INDEX `IDX_tenants_Slug`     (`Slug`),
    INDEX `IDX_tenants_Status`   (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. Seed: Default Owner User (password: Owner123!)
--    Hash generated with bcrypt rounds=10
--    Update PasswordHash after running: node -e "import bcrypt from 'bcryptjs'; bcrypt.hash('Owner123!', 10).then(console.log)"
-- ============================================================
INSERT IGNORE INTO `owner_users` (`Email`, `PhoneNumber`, `PasswordHash`, `Role`, `Status`)
VALUES ('owner@ignito.com', '1234567890', '$2a$10$PLACEHOLDER_HASH_REPLACE_ME', 'owner', 'active');
