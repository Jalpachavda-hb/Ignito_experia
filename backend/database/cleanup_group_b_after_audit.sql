-- ============================================================
-- Group B Optional Database Cleanup Script
-- Execute ONLY after Group B audit and regression testing pass.
-- ============================================================

SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS Labs;
DROP TABLE IF EXISTS RuntimeTypes;
DROP TABLE IF EXISTS tenant_labs;
DROP TABLE IF EXISTS UserRefreshTokens;
DROP TABLE IF EXISTS UsedLmsTokens;

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
