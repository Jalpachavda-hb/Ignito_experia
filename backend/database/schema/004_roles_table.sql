-- =====================================================================================
-- TABLE: Roles
-- Purpose: Define system and custom roles for access control.
-- =====================================================================================
USE `ignito_experia`;

CREATE TABLE IF NOT EXISTS `Roles` (
    `RoleId`      BIGINT         AUTO_INCREMENT PRIMARY KEY,
    `Name`        VARCHAR(100)   NOT NULL UNIQUE COMMENT 'Display name of the role',
    `Description` TEXT           NULL,
    `IsSystem`    TINYINT(1)     NOT NULL DEFAULT 0 COMMENT '1 = built-in, cannot be deleted',
    `IsActive`    TINYINT(1)     NOT NULL DEFAULT 1,
    `CreatedBy`   BIGINT         NULL,
    `UpdatedBy`   BIGINT         NULL,
    `CreatedDate` DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `UpdatedDate` DATETIME       NULL ON UPDATE CURRENT_TIMESTAMP,

    INDEX `IDX_Roles_Name`     (`Name`),
    INDEX `IDX_Roles_IsActive` (`IsActive`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Role definitions for the permission-based access control system';
