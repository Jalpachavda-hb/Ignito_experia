-- ============================================================
-- Ignito Experia Owner Database Schema
-- Database: ignito_experia_owner
-- ============================================================

CREATE DATABASE IF NOT EXISTS `ignito_experia_owner`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `ignito_experia_owner`;

-- ============================================================
-- 1. Error Logs Table
-- ============================================================
CREATE TABLE IF NOT EXISTS `error_logs` (
    `LogId`       BIGINT AUTO_INCREMENT PRIMARY KEY,
    `TableName`   VARCHAR(100),
    `ProcedureName` VARCHAR(100),
    `ErrorMessage` TEXT,
    `ErrorNumber` INT,
    `Parameters`  TEXT,
    `LogDate`     DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. Owner Users Table
-- ============================================================
CREATE TABLE IF NOT EXISTS `owner_users` (
    `OwnerId`      BIGINT AUTO_INCREMENT PRIMARY KEY,
    `Email`        VARCHAR(255) NOT NULL UNIQUE,
    `PhoneNumber`  VARCHAR(50)  NOT NULL,
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
    ('jupyter',    'Jupyter Notebook'),
    ('codeserver', 'Code Server');

-- ============================================================
-- 5. Universities (SaaS Customers — placeholder for future phases)
-- ============================================================
CREATE TABLE IF NOT EXISTS `universities` (
    `UniversityId`     BIGINT AUTO_INCREMENT PRIMARY KEY,
    `Name`             VARCHAR(300) NOT NULL,
    `Logo`             VARCHAR(255),
    `Address`          TEXT,
    `ContactEmail`     VARCHAR(255),
    `ContactPhone`     VARCHAR(50),
    `SubscriptionPlan` VARCHAR(100) DEFAULT 'basic',
    `Status`           VARCHAR(20)  DEFAULT 'active',
    `CreatedDate`      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    `UpdatedDate`      DATETIME NULL,
    INDEX `IDX_universities_Status` (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. Seed: Default Owner User (password: Owner@1234)
--    Hash generated with bcrypt rounds=10
--    Update PasswordHash after running: node -e "import bcrypt from 'bcryptjs'; bcrypt.hash('Owner@1234', 10).then(console.log)"
-- ============================================================
INSERT IGNORE INTO `owner_users` (`Email`, `PhoneNumber`, `PasswordHash`, `Role`, `Status`)
VALUES ('owner@ignito.com', '1234567890', '$2a$10$PLACEHOLDER_HASH_REPLACE_ME', 'owner', 'active');
