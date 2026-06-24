-- =====================================================================================
-- SEED: System Roles + Default Permissions
-- Run AFTER: 004_roles_table.sql, 005_role_permissions_table.sql, 006_users_add_roleid.sql
-- =====================================================================================
USE `ignito_experia`;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Insert System Roles (INSERT IGNORE = idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `Roles` (`Name`, `Description`, `IsSystem`, `IsActive`) VALUES
('Super Admin',  'Full access to all features and system configuration.',            1, 1),
('Tenant Admin', 'Manages institution settings, users, labs and academic data.',     1, 1),
('Faculty',      'Instructors who can manage labs, courses and monitor students.',   1, 1),
('Student',      'Standard end-user who can view labs and access learning content.', 1, 1);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Capture Role IDs into variables for permission seeding
-- ─────────────────────────────────────────────────────────────────────────────
SET @superAdminId  = (SELECT `RoleId` FROM `Roles` WHERE `Name` = 'Super Admin'  LIMIT 1);
SET @tenantAdminId = (SELECT `RoleId` FROM `Roles` WHERE `Name` = 'Tenant Admin' LIMIT 1);
SET @facultyId     = (SELECT `RoleId` FROM `Roles` WHERE `Name` = 'Faculty'      LIMIT 1);
SET @studentId     = (SELECT `RoleId` FROM `Roles` WHERE `Name` = 'Student'      LIMIT 1);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Seed Default Permissions
--    Columns: RoleId, ModuleCode, CanCreate, CanRead, CanUpdate, CanDelete
-- ─────────────────────────────────────────────────────────────────────────────

-- Super Admin: full access to everything
INSERT IGNORE INTO `RolePermissions` (`RoleId`, `ModuleCode`, `CanCreate`, `CanRead`, `CanUpdate`, `CanDelete`) VALUES
(@superAdminId, 'DASHBOARD',              0, 1, 0, 0),
(@superAdminId, 'ROLE_MANAGEMENT',        1, 1, 1, 1),
(@superAdminId, 'USER_MANAGEMENT',        1, 1, 1, 1),
(@superAdminId, 'LAB_MANAGEMENT',         1, 1, 1, 1),
(@superAdminId, 'PROGRAM_MANAGEMENT',     1, 1, 1, 1),
(@superAdminId, 'COURSE_MANAGEMENT',      1, 1, 1, 1),
(@superAdminId, 'SEMESTER_MANAGEMENT',    1, 1, 1, 1),
(@superAdminId, 'CREDIT_MANAGEMENT',      1, 1, 1, 1),
(@superAdminId, 'TRANSACTION_MANAGEMENT', 1, 1, 1, 1),
(@superAdminId, 'REPORTS',                1, 1, 1, 1),
(@superAdminId, 'SETTINGS',               1, 1, 1, 1),
(@superAdminId, 'SESSION_MONITORING',     1, 1, 1, 1),
(@superAdminId, 'STUDENT_MANAGEMENT',     1, 1, 1, 1),
(@superAdminId, 'FACULTY_MANAGEMENT',     1, 1, 1, 1);

-- Tenant Admin: can view roles, full on everything else except system config
INSERT IGNORE INTO `RolePermissions` (`RoleId`, `ModuleCode`, `CanCreate`, `CanRead`, `CanUpdate`, `CanDelete`) VALUES
(@tenantAdminId, 'DASHBOARD',              0, 1, 0, 0),
(@tenantAdminId, 'ROLE_MANAGEMENT',        0, 1, 0, 0),  -- view only
(@tenantAdminId, 'USER_MANAGEMENT',        1, 1, 1, 1),
(@tenantAdminId, 'LAB_MANAGEMENT',         1, 1, 1, 1),
(@tenantAdminId, 'PROGRAM_MANAGEMENT',     1, 1, 1, 1),
(@tenantAdminId, 'COURSE_MANAGEMENT',      1, 1, 1, 1),
(@tenantAdminId, 'SEMESTER_MANAGEMENT',    1, 1, 1, 1),
(@tenantAdminId, 'CREDIT_MANAGEMENT',      1, 1, 1, 1),
(@tenantAdminId, 'TRANSACTION_MANAGEMENT', 1, 1, 1, 1),
(@tenantAdminId, 'REPORTS',                1, 1, 1, 1),
(@tenantAdminId, 'SETTINGS',               1, 1, 1, 0),
(@tenantAdminId, 'SESSION_MONITORING',     0, 1, 1, 0),
(@tenantAdminId, 'STUDENT_MANAGEMENT',     1, 1, 1, 1),
(@tenantAdminId, 'FACULTY_MANAGEMENT',     1, 1, 1, 1);

-- Faculty: read-mostly, can manage labs and monitor sessions
INSERT IGNORE INTO `RolePermissions` (`RoleId`, `ModuleCode`, `CanCreate`, `CanRead`, `CanUpdate`, `CanDelete`) VALUES
(@facultyId, 'DASHBOARD',              0, 1, 0, 0),
(@facultyId, 'ROLE_MANAGEMENT',        0, 0, 0, 0),
(@facultyId, 'USER_MANAGEMENT',        0, 0, 0, 0),
(@facultyId, 'LAB_MANAGEMENT',         1, 1, 1, 0),
(@facultyId, 'PROGRAM_MANAGEMENT',     0, 1, 0, 0),
(@facultyId, 'COURSE_MANAGEMENT',      0, 1, 0, 0),
(@facultyId, 'SEMESTER_MANAGEMENT',    0, 1, 0, 0),
(@facultyId, 'CREDIT_MANAGEMENT',      0, 1, 0, 0),
(@facultyId, 'TRANSACTION_MANAGEMENT', 0, 0, 0, 0),
(@facultyId, 'REPORTS',                0, 1, 0, 0),
(@facultyId, 'SETTINGS',               0, 0, 0, 0),
(@facultyId, 'SESSION_MONITORING',     0, 1, 1, 0),
(@facultyId, 'STUDENT_MANAGEMENT',     0, 1, 0, 0),
(@facultyId, 'FACULTY_MANAGEMENT',     0, 0, 0, 0);

-- Student: minimal access — can read labs, view own credits
INSERT IGNORE INTO `RolePermissions` (`RoleId`, `ModuleCode`, `CanCreate`, `CanRead`, `CanUpdate`, `CanDelete`) VALUES
(@studentId, 'DASHBOARD',              0, 1, 0, 0),
(@studentId, 'ROLE_MANAGEMENT',        0, 0, 0, 0),
(@studentId, 'USER_MANAGEMENT',        0, 0, 0, 0),
(@studentId, 'LAB_MANAGEMENT',         0, 1, 0, 0),
(@studentId, 'PROGRAM_MANAGEMENT',     0, 0, 0, 0),
(@studentId, 'COURSE_MANAGEMENT',      0, 0, 0, 0),
(@studentId, 'SEMESTER_MANAGEMENT',    0, 0, 0, 0),
(@studentId, 'CREDIT_MANAGEMENT',      0, 1, 0, 0),
(@studentId, 'TRANSACTION_MANAGEMENT', 0, 0, 0, 0),
(@studentId, 'REPORTS',                0, 0, 0, 0),
(@studentId, 'SETTINGS',               0, 0, 0, 0),
(@studentId, 'SESSION_MONITORING',     0, 0, 0, 0),
(@studentId, 'STUDENT_MANAGEMENT',     0, 0, 0, 0),
(@studentId, 'FACULTY_MANAGEMENT',     0, 0, 0, 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Sync existing Users.RoleId from Users.Role varchar
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE `Users` u
JOIN `Roles` r ON r.`Name` = u.`Role`
SET u.`RoleId` = r.`RoleId`
WHERE u.`RoleId` IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Add FK constraint on Users.RoleId (now that it is populated)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `Users`
    ADD CONSTRAINT IF NOT EXISTS `FK_Users_RoleId`
    FOREIGN KEY (`RoleId`) REFERENCES `Roles`(`RoleId`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
