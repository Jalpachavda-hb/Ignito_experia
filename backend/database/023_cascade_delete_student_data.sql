-- Migration 023: Full Cascading Deletion of Student & User Data Across All Tables
USE `ignito_experia`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Drop existing delete trigger if any
DROP TRIGGER IF EXISTS `trg_users_before_delete`;

-- 2. Create Trigger to guarantee total data wipe when any user is deleted directly from DB
CREATE TRIGGER `trg_users_before_delete`
BEFORE DELETE ON `Users`
FOR EACH ROW
BEGIN
  -- A. Delete lab token usages (by student id / external id / email or wallet)
  DELETE FROM `lab_token_usage`
  WHERE `StudentId` = CAST(OLD.UserId AS CHAR)
     OR (OLD.ExternalStudentId IS NOT NULL AND `StudentId` = OLD.ExternalStudentId)
     OR (OLD.Email IS NOT NULL AND LOWER(`StudentId`) = LOWER(OLD.Email))
     OR `WalletId` IN (
       SELECT `Id` FROM `student_lab_token_wallets`
       WHERE `StudentId` = CAST(OLD.UserId AS CHAR)
          OR (OLD.ExternalStudentId IS NOT NULL AND `StudentId` = OLD.ExternalStudentId)
          OR (OLD.Email IS NOT NULL AND LOWER(`StudentId`) = LOWER(OLD.Email))
     );

  -- B. Delete student lab token transactions
  DELETE FROM `student_lab_token_transactions`
  WHERE `StudentId` = CAST(OLD.UserId AS CHAR)
     OR (OLD.ExternalStudentId IS NOT NULL AND `StudentId` = OLD.ExternalStudentId)
     OR (OLD.Email IS NOT NULL AND LOWER(`StudentId`) = LOWER(OLD.Email))
     OR `WalletId` IN (
       SELECT `Id` FROM `student_lab_token_wallets`
       WHERE `StudentId` = CAST(OLD.UserId AS CHAR)
          OR (OLD.ExternalStudentId IS NOT NULL AND `StudentId` = OLD.ExternalStudentId)
          OR (OLD.Email IS NOT NULL AND LOWER(`StudentId`) = LOWER(OLD.Email))
     );

  -- C. Delete student lab token wallets
  DELETE FROM `student_lab_token_wallets`
  WHERE `StudentId` = CAST(OLD.UserId AS CHAR)
     OR (OLD.ExternalStudentId IS NOT NULL AND `StudentId` = OLD.ExternalStudentId)
     OR (OLD.Email IS NOT NULL AND LOWER(`StudentId`) = LOWER(OLD.Email));

  -- D. Delete token order items and token orders
  DELETE FROM `token_order_items`
  WHERE `OrderId` IN (
    SELECT `Id` FROM `token_orders`
    WHERE `StudentId` = CAST(OLD.UserId AS CHAR)
       OR (OLD.ExternalStudentId IS NOT NULL AND `StudentId` = OLD.ExternalStudentId)
       OR (OLD.Email IS NOT NULL AND LOWER(`StudentId`) = LOWER(OLD.Email))
  );

  DELETE FROM `token_orders`
  WHERE `StudentId` = CAST(OLD.UserId AS CHAR)
     OR (OLD.ExternalStudentId IS NOT NULL AND `StudentId` = OLD.ExternalStudentId)
     OR (OLD.Email IS NOT NULL AND LOWER(`StudentId`) = LOWER(OLD.Email));

  -- E. Delete credit transactions & credit wallets
  DELETE FROM `credit_transactions` WHERE `UserId` = OLD.UserId;
  DELETE FROM `credit_wallets` WHERE `UserId` = OLD.UserId;
  DELETE FROM `studentcreditwallets` WHERE `UserId` = OLD.UserId;

  -- F. Delete lab sessions
  DELETE FROM `lab_sessions` WHERE `UserId` = OLD.UserId;

  -- G. Delete persisted lab workspaces and files
  DELETE FROM `user_lab_workspaces` WHERE `userId` = CAST(OLD.UserId AS CHAR);

  -- H. Delete user tenant mappings
  DELETE FROM `user_tenant_mapping` WHERE `UserId` = OLD.UserId;

  -- I. Delete sessions, tokens and registered devices
  DELETE FROM `refreshtokens` WHERE `UserId` = OLD.UserId OR `StudentProfileId` = OLD.UserId;
  DELETE FROM `userrefreshtokens` WHERE `UserId` = OLD.UserId;
  DELETE FROM `studentsessions` WHERE `UserId` = OLD.UserId OR `StudentProfileId` = OLD.UserId;
  DELETE FROM `registereddevices` WHERE `StudentProfileId` = OLD.UserId;

  -- J. Delete external identities
  DELETE FROM `external_identities` 
  WHERE `UserId` = OLD.UserId 
     OR (OLD.ExternalStudentId IS NOT NULL AND `ExternalStudentId` = OLD.ExternalStudentId);

  -- K. Delete student audit logs
  DELETE FROM `studentaudits` WHERE `UserId` = OLD.UserId OR `ChangedByUserId` = OLD.UserId;

  -- L. Delete system audit logs related to this student
  DELETE FROM `auditlogs` WHERE `UserId` = OLD.UserId OR `StudentProfileId` = OLD.UserId;
  DELETE FROM `auditlogs_archive` WHERE `StudentProfileId` = OLD.UserId;

END;

SET FOREIGN_KEY_CHECKS = 1;
