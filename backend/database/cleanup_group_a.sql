-- ============================================================
-- Group A One-Time Database Cleanup Script
-- Removes verified obsolete tables, normalizes role ENUM,
-- drops RoleId, and clears operational data for fresh start.
-- ============================================================

SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. DROP VERIFIED OBSOLETE TABLES
DROP TABLE IF EXISTS RolePermissions;
DROP TABLE IF EXISTS Roles;
DROP TABLE IF EXISTS ErrorLogs;
DROP TABLE IF EXISTS StudentAudits;
DROP TABLE IF EXISTS student_profiles;
DROP TABLE IF EXISTS studentprofiles;
DROP TABLE IF EXISTS Analytics_DailySummary;
DROP TABLE IF EXISTS Analytics_MonthlySummary;
DROP TABLE IF EXISTS Analytics_DeviceSummary;

-- 2. NORMALIZE USERS ROLE ATOMICALLY
UPDATE Users
SET Role = CASE
    WHEN UPPER(TRIM(Role)) IN (
        'TENANTADMIN',
        'TENANT_ADMIN',
        'SUPERADMIN',
        'SUPER_ADMIN',
        'ADMIN'
    )
    THEN 'TENANT_ADMIN'
    ELSE 'STUDENT'
END;

-- 3. REMOVE LEGACY RoleId
ALTER TABLE Users DROP COLUMN IF EXISTS RoleId;

-- 4. APPLY FINAL TWO-ROLE ENUM
ALTER TABLE Users
MODIFY COLUMN Role
ENUM('STUDENT', 'TENANT_ADMIN')
NOT NULL DEFAULT 'STUDENT';

-- 5. CLEAR TRANSACTIONAL DATA
TRUNCATE TABLE RefreshTokens;
TRUNCATE TABLE StudentSessions;
TRUNCATE TABLE RegisteredDevices;
TRUNCATE TABLE AuditLogs;
TRUNCATE TABLE AuditLogs_Archive;
TRUNCATE TABLE StudentCreditWallets;
TRUNCATE TABLE user_tenant_mapping;
TRUNCATE TABLE course_lab_mappings;
TRUNCATE TABLE tenants;
TRUNCATE TABLE Users;

-- 6. RESTORE FOREIGN KEY CHECKS
SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
