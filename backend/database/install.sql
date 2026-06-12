-- Ignito Experia Modular Database Installer

-- 1. Schema
SOURCE schema/001_create_database.sql;
SOURCE schema/002_error_logs_table.sql;
SOURCE schema/003_labs_table.sql;

-- 2. Base Procedures
SOURCE procedures/sp_LogError.sql;

-- 3. Module Procedures (Labs)
SOURCE procedures/labs/sp_Lab_Insert.sql;
SOURCE procedures/labs/sp_Lab_Update.sql;
SOURCE procedures/labs/sp_Lab_Delete.sql;
SOURCE procedures/labs/sp_Lab_Restore.sql;
SOURCE procedures/labs/sp_Lab_GetAll.sql;
SOURCE procedures/labs/sp_Lab_GetActiveLabs.sql;
SOURCE procedures/labs/sp_Lab_UpdateStatus.sql;
SOURCE procedures/labs/sp_Lab_GetById.sql;

-- 4. Seeds
SOURCE seeds/seed_labs.sql;
