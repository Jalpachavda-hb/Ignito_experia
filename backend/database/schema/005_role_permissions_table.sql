-- =====================================================================================
-- TABLE: RolePermissions
-- Purpose: Store CRUD permission flags per Role per Module.
-- =====================================================================================
USE `ignito_experia`;

CREATE TABLE IF NOT EXISTS `RolePermissions` (
    `PermissionId` BIGINT        AUTO_INCREMENT PRIMARY KEY,
    `RoleId`       BIGINT        NOT NULL,
    `ModuleCode`   VARCHAR(100)  NOT NULL COMMENT 'e.g. ROLE_MANAGEMENT, USER_MANAGEMENT',
    `CanCreate`    TINYINT(1)    NOT NULL DEFAULT 0,
    `CanRead`      TINYINT(1)    NOT NULL DEFAULT 0,
    `CanUpdate`    TINYINT(1)    NOT NULL DEFAULT 0,
    `CanDelete`    TINYINT(1)    NOT NULL DEFAULT 0,

    CONSTRAINT `FK_RolePermissions_RoleId`
        FOREIGN KEY (`RoleId`) REFERENCES `Roles`(`RoleId`)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    UNIQUE KEY `UQ_RolePermissions_RoleId_ModuleCode` (`RoleId`, `ModuleCode`),
    INDEX `IDX_RolePermissions_RoleId`     (`RoleId`),
    INDEX `IDX_RolePermissions_ModuleCode` (`ModuleCode`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Per-module CRUD permission flags for each role';
