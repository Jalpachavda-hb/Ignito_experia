-- =====================================================================================
-- Migration: Add RoleId FK column to Users table
-- Purpose: Link each User to a Roles row for permission lookups.
--          The legacy Role VARCHAR column is kept for backward compatibility.
-- =====================================================================================
USE `ignito_experia`;

-- Step 1: Add the RoleId column (nullable to avoid breaking existing rows)
ALTER TABLE `Users`
    ADD COLUMN IF NOT EXISTS `RoleId` BIGINT NULL
        COMMENT 'FK to Roles.RoleId — set via migration from Role varchar'
        AFTER `Role`;

-- Step 2: Add FK constraint (added after population in seed script)
-- We defer the FK to after the seed_roles script populates the Roles table.
-- Run this ALTER after seed_roles.sql:
--
--   ALTER TABLE `Users`
--       ADD CONSTRAINT `FK_Users_RoleId`
--       FOREIGN KEY (`RoleId`) REFERENCES `Roles`(`RoleId`)
--       ON DELETE SET NULL ON UPDATE CASCADE;
--
-- Step 3: Sync existing users' RoleId from Role varchar
-- (Also executed in seed_roles.sql after Roles are inserted)
