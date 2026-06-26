USE `ignito_experia`;

SET FOREIGN_KEY_CHECKS = 0;

-- Remove duplicate audit table
DROP TABLE IF EXISTS `StudentAudits`;

-- Remove Phase 6 V2 RBAC tables
DROP TABLE IF EXISTS `RolePermissions_V2`;
DROP TABLE IF EXISTS `UserPermissions_V2`;
DROP TABLE IF EXISTS `Permissions_V2`;
DROP TABLE IF EXISTS `Roles_V2`;

SET FOREIGN_KEY_CHECKS = 1;
