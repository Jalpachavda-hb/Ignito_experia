import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFolder = path.join(__dirname, "..", "database");

const pool = mysql.createPool({
  port: parseInt(process.env.DB_PORT || "3306", 10),
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
});

export const getDbConnection = async () => {
  return await pool.getConnection();
};

const USERS_COLUMNS_TO_DROP = [
  "EmailVerified",
  "PasswordResetToken",
  "PasswordResetExpiresAt",
  "LastLoginAt",
  "CreatedBy",
  "UpdatedBy",
  "IsDeleted",
  "DeletedAt",
  "DeletedBy",
  "StudentCode",
  "Mobile",
  "AlternateMobile",
  "Gender",
  "DateOfBirth",
  "Address",
  "ProgrammesJson",
  "AcademicYear",
  "EnrollmentStatus",
  "ProgramId",
  "SemesterId",
  "Batch",
  "Section",
  "DepartmentId",
  "AuthenticationSource",
  "UniversityId",
];

async function tightenUsersTable(connection) {
  const [cols] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Users'`
  );
  const have = new Set(cols.map((col) => col.COLUMN_NAME));
  for (const name of USERS_COLUMNS_TO_DROP) {
    if (!have.has(name)) continue;
    try {
      await connection.query(`ALTER TABLE \`Users\` DROP COLUMN \`${name}\``);
      console.log(`[MySQL] Removed unused Users.${name}`);
    } catch (err) {
      console.warn(`[MySQL] Could not remove Users.${name}:`, err.message);
    }
  }
  await connection.query("ALTER TABLE `Users` MODIFY `PasswordHash` VARCHAR(512) NULL").catch((err) => {
    console.warn("[MySQL] PasswordHash width was not updated:", err.message);
  });
  await connection.query(
    "ALTER TABLE `Users` MODIFY `AuthType` ENUM('LMS', 'DIRECT', 'LMS_AND_DIRECT') NOT NULL DEFAULT 'DIRECT'"
  ).catch((err) => {
    console.warn("[MySQL] AuthType values were not updated:", err.message);
  });
}

async function ensureCreditWalletsTables(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`credit_wallets\` (
      \`WalletId\` INT AUTO_INCREMENT PRIMARY KEY,
      \`TenantId\` VARCHAR(64) NOT NULL,
      \`UserId\` INT NOT NULL,
      \`TotalPurchasedCredits\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`ConsumedCredits\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`ReservedCredits\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`Balance\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`Status\` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`UpdatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY \`idx_wallet_user_tenant_unique\` (\`UserId\`, \`TenantId\`),
      INDEX \`idx_wallet_tenant\` (\`TenantId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`credit_transactions\` (
      \`TransactionId\` BIGINT AUTO_INCREMENT PRIMARY KEY,
      \`TenantId\` VARCHAR(64) NOT NULL,
      \`UserId\` INT NOT NULL,
      \`Type\` ENUM('PURCHASE', 'DEDUCTION', 'LAB_USAGE', 'LAB_EXTENSION', 'REFUND', 'BONUS', 'ADJUSTMENT') NOT NULL,
      \`Source\` VARCHAR(100) NOT NULL DEFAULT 'STUDENT_PORTAL',
      \`Credits\` DECIMAL(10,2) NOT NULL,
      \`Amount\` DECIMAL(10,2) DEFAULT 0.00,
      \`Currency\` VARCHAR(10) DEFAULT 'INR',
      \`PaymentReference\` VARCHAR(255) NULL,
      \`LabId\` VARCHAR(100) NULL,
      \`LabSessionId\` VARCHAR(100) NULL,
      \`IdempotencyKey\` VARCHAR(255) NULL,
      \`Status\` VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
      \`MetadataJson\` JSON NULL,
      \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY \`idx_txn_idempotency\` (\`IdempotencyKey\`),
      INDEX \`idx_txn_user_tenant\` (\`UserId\`, \`TenantId\`),
      INDEX \`idx_txn_payment_ref\` (\`PaymentReference\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function ensureStudentLabTokenWalletsTableAndColumns(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`student_lab_token_wallets\` (
      \`Id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`TenantId\` VARCHAR(64) NOT NULL,
      \`StudentId\` VARCHAR(64) NOT NULL,
      \`LabId\` VARCHAR(100) NOT NULL,
      \`TotalPurchasedTokens\` INT NOT NULL DEFAULT 0,
      \`TotalUsedTokens\` INT NOT NULL DEFAULT 0,
      \`ConsumedTokens\` INT UNSIGNED NOT NULL DEFAULT 0,
      \`RemainingTokens\` INT NOT NULL DEFAULT 0,
      \`CarryOverSeconds\` INT NOT NULL DEFAULT 0,
      \`Version\` BIGINT UNSIGNED NOT NULL DEFAULT 1,
      \`Status\` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
      \`CreatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`UpdatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`Id\`),
      UNIQUE KEY \`UQ_StudentLabWallet\` (\`TenantId\`, \`StudentId\`, \`LabId\`),
      INDEX \`IDX_StudentLabWallet\` (\`StudentId\`, \`LabId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const [cols] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'student_lab_token_wallets'`
  );
  const existingCols = new Set(cols.map((col) => col.COLUMN_NAME.toLowerCase()));

  const columnsToAdd = [
    { name: 'ConsumedTokens', ddl: 'ADD COLUMN `ConsumedTokens` INT UNSIGNED NOT NULL DEFAULT 0' },
    { name: 'RemainingTokens', ddl: 'ADD COLUMN `RemainingTokens` INT NOT NULL DEFAULT 0' },
    { name: 'Version', ddl: 'ADD COLUMN `Version` BIGINT UNSIGNED NOT NULL DEFAULT 1' },
    { name: 'CarryOverSeconds', ddl: 'ADD COLUMN `CarryOverSeconds` INT NOT NULL DEFAULT 0' },
  ];

  for (const { name, ddl } of columnsToAdd) {
    if (!existingCols.has(name.toLowerCase())) {
      try {
        await connection.query(`ALTER TABLE \`student_lab_token_wallets\` ${ddl}`);
        console.log(`[MySQL] Added column student_lab_token_wallets.${name}`);
      } catch (err) {
        console.warn(`[MySQL] Note adding column student_lab_token_wallets.${name}:`, err.message);
      }
    }
  }
}

async function ensureLabSessionsTableAndColumns(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`lab_sessions\` (
      \`SessionId\` VARCHAR(100) PRIMARY KEY,
      \`TenantId\` VARCHAR(64) NOT NULL,
      \`UserId\` INT NOT NULL,
      \`LabId\` VARCHAR(100) NOT NULL,
      \`AllocatedCredits\` INT NOT NULL DEFAULT 0,
      \`AllocatedDurationMinutes\` INT NOT NULL DEFAULT 0,
      \`FinalCreditsConsumed\` DECIMAL(10,2) NULL,
      \`StartedAt\` DATETIME NOT NULL,
      \`ExpiresAt\` DATETIME NOT NULL,
      \`EndedAt\` DATETIME NULL,
      \`Status\` ENUM('PENDING', 'STARTING', 'RUNNING', 'EXPIRING_SOON', 'STOPPING', 'COMPLETED', 'EXPIRED', 'FAILED', 'STOPPED') NOT NULL DEFAULT 'STARTING',
      \`TenMinuteWarningSent\` TINYINT(1) NOT NULL DEFAULT 0,
      \`TaskArn\` VARCHAR(255) NULL,
      \`ContainerId\` VARCHAR(255) NULL,
      \`RuntimeUrl\` VARCHAR(255) NULL,
      \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`UpdatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX \`IDX_LabSess_User_Tenant\` (\`UserId\`, \`TenantId\`),
      INDEX \`IDX_LabSess_Status_Expires\` (\`Status\`, \`ExpiresAt\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  try {
    await connection.query(`
      ALTER TABLE \`lab_sessions\` 
      MODIFY COLUMN \`Status\` ENUM('PENDING','STARTING','RUNNING','EXPIRING_SOON','STOPPING','COMPLETED','EXPIRED','FAILED','STOPPED') 
      NOT NULL DEFAULT 'STARTING'
    `);
  } catch (err) {
    // Column already modified or table matches
  }

  const [cols] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'lab_sessions'`
  );
  const existingCols = new Set(cols.map((col) => col.COLUMN_NAME.toLowerCase()));

  const columnsToAdd = [
    { name: 'TokenExpiryAt', ddl: 'ADD COLUMN `TokenExpiryAt` DATETIME NULL' },
    { name: 'LastBilledAt', ddl: 'ADD COLUMN `LastBilledAt` DATETIME NULL' },
    { name: 'UnbilledSeconds', ddl: 'ADD COLUMN `UnbilledSeconds` INT NOT NULL DEFAULT 0' },
    { name: 'BilledTokens', ddl: 'ADD COLUMN `BilledTokens` INT NOT NULL DEFAULT 0' },
    { name: 'LowBalanceWarningSent', ddl: 'ADD COLUMN `LowBalanceWarningSent` TINYINT(1) NOT NULL DEFAULT 0' },
    { name: 'StopRequestedAt', ddl: 'ADD COLUMN `StopRequestedAt` DATETIME NULL' },
    { name: 'StopRetryCount', ddl: 'ADD COLUMN `StopRetryCount` INT NOT NULL DEFAULT 0' },
    { name: 'LastStopAttemptAt', ddl: 'ADD COLUMN `LastStopAttemptAt` DATETIME NULL' },
    { name: 'StopError', ddl: 'ADD COLUMN `StopError` TEXT NULL' },
    { name: 'BillingStartedAt', ddl: 'ADD COLUMN `BillingStartedAt` DATETIME NULL' },
    { name: 'BilledSeconds', ddl: 'ADD COLUMN `BilledSeconds` INT UNSIGNED NOT NULL DEFAULT 0' },
    { name: 'LowTokenWarningSent', ddl: 'ADD COLUMN `LowTokenWarningSent` TINYINT(1) NOT NULL DEFAULT 0' },
    { name: 'BillingLockUntil', ddl: 'ADD COLUMN `BillingLockUntil` DATETIME NULL' },
    { name: 'BillingWorkerId', ddl: 'ADD COLUMN `BillingWorkerId` VARCHAR(100) NULL' },
  ];

  for (const { name, ddl } of columnsToAdd) {
    if (!existingCols.has(name.toLowerCase())) {
      try {
        await connection.query(`ALTER TABLE \`lab_sessions\` ${ddl}`);
        console.log(`[MySQL] Added column lab_sessions.${name}`);
      } catch (err) {
        console.warn(`[MySQL] Note adding column lab_sessions.${name}:`, err.message);
      }
    }
  }

  try {
    await connection.query(`ALTER TABLE \`lab_sessions\` ADD INDEX \`IDX_LabSession_Expiry\` (\`Status\`, \`TokenExpiryAt\`)`);
  } catch (_) {}
  try {
    await connection.query(`ALTER TABLE \`lab_sessions\` ADD INDEX \`IDX_LabSession_Billing\` (\`Status\`, \`LastBilledAt\`)`);
  } catch (_) {}

  // Drop rigid FK constraint on lab_sessions so external/LMS student IDs never fail lab launch
  try {
    await connection.query("ALTER TABLE `lab_sessions` DROP FOREIGN KEY `FK_LabSession_UserId`");
    console.log("[MySQL] Dropped rigid FK_LabSession_UserId constraint to support LMS & external student IDs.");
  } catch (_) {}
}

export const verifyDbConnection = async () => {
  let connection;
  try {
    // 1. Ensure the database itself exists
    const tempPool = mysql.createPool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "3306", 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true,
    });
    const tempConn = await tempPool.getConnection();
    await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    tempConn.release();
    await tempPool.end();

    connection = await pool.getConnection();
    console.log(`[MySQL] Connected successfully to database: ${process.env.DB_NAME}`);

    // 2. Disable foreign key checks for schema verification
    await connection.query("SET FOREIGN_KEY_CHECKS = 0;");

    console.log("[MySQL] Verifying core database schema...");

    // Users (Consolidated & Simplified)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`Users\` (
        \`UserId\` INT AUTO_INCREMENT PRIMARY KEY,
        \`FullName\` VARCHAR(255) NOT NULL,
        \`Email\` VARCHAR(255) NOT NULL UNIQUE,
        \`PasswordHash\` VARCHAR(512) NULL,
        \`Role\` ENUM('STUDENT', 'TENANT_ADMIN') NOT NULL DEFAULT 'STUDENT',
        \`Status\` VARCHAR(20) DEFAULT 'Active',
        \`PhoneNumber\` VARCHAR(50) NULL,
        \`ProfileImage\` LONGTEXT NULL,
        \`CreatedFrom\` ENUM('LMS', 'DIRECT') DEFAULT 'DIRECT',
        \`AuthType\` ENUM('LMS', 'DIRECT', 'LMS_AND_DIRECT') DEFAULT 'DIRECT',
        \`TenantId\` VARCHAR(64) NULL,
        \`ExternalStudentId\` VARCHAR(100) NULL,
        \`StudentId\` VARCHAR(50) NULL,
        \`StudentDegreeAdmissionId\` VARCHAR(50) NULL,
        \`CreatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`UpdatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`IDX_Users_Email\` (\`Email\`),
        INDEX \`IDX_Users_External\` (\`ExternalStudentId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // RegisteredDevices
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`RegisteredDevices\` (
        \`DeviceId\` VARCHAR(100) PRIMARY KEY,
        \`UserId\` INT NOT NULL,
        \`DeviceFingerprint\` VARCHAR(255) NOT NULL,
        \`DeviceName\` VARCHAR(100) NULL,
        \`Browser\` VARCHAR(100) NULL,
        \`BrowserVersion\` VARCHAR(50) NULL,
        \`OperatingSystem\` VARCHAR(100) NULL,
        \`OperatingSystemVersion\` VARCHAR(50) NULL,
        \`Platform\` VARCHAR(50) NULL,
        \`IPAddress\` VARCHAR(45) NULL,
        \`Timezone\` VARCHAR(100) NULL,
        \`Trusted\` BOOLEAN DEFAULT FALSE,
        \`FirstLogin\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`LastLogin\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`Status\` VARCHAR(20) DEFAULT 'ACTIVE',
        INDEX \`IDX_RegisteredDevices_UserId\` (\`UserId\`),
        INDEX \`IDX_RegisteredDevices_Fingerprint\` (\`DeviceFingerprint\`),
        CONSTRAINT \`FK_RegisteredDevices_UserId\` FOREIGN KEY (\`UserId\`) REFERENCES \`Users\`(\`UserId\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // StudentSessions
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`StudentSessions\` (
        \`SessionId\` VARCHAR(100) PRIMARY KEY,
        \`UserId\` INT NOT NULL,
        \`DeviceId\` VARCHAR(100) NULL,
        \`LoginSource\` ENUM('DIRECT', 'LMS') NOT NULL,
        \`UniversityId\` VARCHAR(64) NULL,
        \`AccessTokenId\` VARCHAR(100) NULL,
        \`RefreshTokenId\` VARCHAR(100) NULL,
        \`IPAddress\` VARCHAR(45),
        \`LoginTime\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`LogoutTime\` DATETIME NULL,
        \`LastActivity\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`LastRefresh\` DATETIME NULL,
        \`ExpiresAt\` DATETIME NULL,
        \`IdleExpiresAt\` DATETIME NULL,
        \`Status\` VARCHAR(20) DEFAULT 'ACTIVE',
        INDEX \`IDX_StudentSessions_User\` (\`UserId\`),
        INDEX \`IDX_StudentSessions_Status\` (\`Status\`),
        INDEX \`IDX_StudentSessions_LoginSource\` (\`LoginSource\`),
        INDEX \`IDX_StudentSessions_UniversityId\` (\`UniversityId\`),
        INDEX \`IDX_StudentSessions_CreatedAt\` (\`LoginTime\`),
        INDEX \`IDX_StudentSessions_LastActivity\` (\`LastActivity\`),
        INDEX \`IDX_StudentSessions_ExpiresAt\` (\`ExpiresAt\`),
        CONSTRAINT \`FK_StudentSessions_UserId\` FOREIGN KEY (\`UserId\`) REFERENCES \`Users\`(\`UserId\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_StudentSessions_Device\` FOREIGN KEY (\`DeviceId\`) REFERENCES \`RegisteredDevices\`(\`DeviceId\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // RefreshTokens
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`RefreshTokens\` (
        \`Id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`UserId\` INT NOT NULL,
        \`SessionId\` VARCHAR(100) NOT NULL,
        \`TokenHash\` VARCHAR(255) NOT NULL,
        \`ExpiresAt\` DATETIME NOT NULL,
        \`RevokedAt\` DATETIME NULL,
        \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`IDX_RefreshTokens_User\` (\`UserId\`),
        INDEX \`IDX_RefreshTokens_Session\` (\`SessionId\`),
        CONSTRAINT \`FK_RefreshTokens_UserId\` FOREIGN KEY (\`UserId\`) REFERENCES \`Users\`(\`UserId\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_RefreshTokens_Session\` FOREIGN KEY (\`SessionId\` ) REFERENCES \`StudentSessions\`(\`SessionId\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // AuditLogs
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`AuditLogs\` (
        \`Id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`RequestId\` VARCHAR(100) NULL,
        \`CorrelationId\` VARCHAR(100) NULL,
        \`TraceId\` VARCHAR(100) NULL,
        \`SessionId\` VARCHAR(100) NULL,
        \`UserId\` INT NULL,
        \`UniversityId\` VARCHAR(64) NULL,
        \`DepartmentId\` INT NULL,
        \`ProgramId\` INT NULL,
        \`SemesterId\` INT NULL,
        \`Source\` ENUM('DIRECT', 'LMS', 'SYSTEM', 'ADMIN') NOT NULL DEFAULT 'SYSTEM',
        \`Category\` ENUM('Authentication', 'Student', 'Faculty', 'Lab', 'Compiler', 'Submission', 'Container', 'Administration', 'Security', 'System') NOT NULL,
        \`Severity\` ENUM('Information', 'Warning', 'Error', 'Critical') NOT NULL DEFAULT 'Information',
        \`Action\` VARCHAR(100) NOT NULL,
        \`Module\` VARCHAR(100) NULL,
        \`Entity\` VARCHAR(100) NULL,
        \`EntityId\` VARCHAR(100) NULL,
        \`Description\` TEXT NULL,
        \`OldValues\` JSON NULL,
        \`NewValues\` JSON NULL,
        \`IPAddress\` VARCHAR(45) NULL,
        \`Browser\` VARCHAR(100) NULL,
        \`Device\` VARCHAR(100) NULL,
        \`OperatingSystem\` VARCHAR(100) NULL,
        \`Country\` VARCHAR(100) NULL,
        \`City\` VARCHAR(100) NULL,
        \`Status\` VARCHAR(50) DEFAULT 'SUCCESS',
        \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`IDX_Audit_Correlation\` (\`CorrelationId\`),
        INDEX \`IDX_Audit_Request\` (\`RequestId\`),
        INDEX \`IDX_Audit_Category\` (\`Category\`),
        INDEX \`IDX_Audit_Severity\` (\`Severity\`),
        INDEX \`IDX_Audit_Action\` (\`Action\`),
        INDEX \`IDX_Audit_Source\` (\`Source\`),
        INDEX \`IDX_Audit_UserId\` (\`UserId\`),
        INDEX \`IDX_Audit_UniversityId\` (\`UniversityId\`),
        INDEX \`IDX_Audit_SessionId\` (\`SessionId\`),
        INDEX \`IDX_Audit_CreatedAt\` (\`CreatedAt\`),
        INDEX \`IDX_Audit_Status\` (\`Status\`),
        CONSTRAINT \`FK_AuditLogs_UserId\` FOREIGN KEY (\`UserId\`) REFERENCES \`Users\`(\`UserId\`) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // AuditLogs_Archive
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`AuditLogs_Archive\` (
        \`Id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`RequestId\` VARCHAR(100) NULL,
        \`CorrelationId\` VARCHAR(100) NULL,
        \`TraceId\` VARCHAR(100) NULL,
        \`SessionId\` VARCHAR(100) NULL,
        \`UserId\` INT NULL,
        \`UniversityId\` VARCHAR(64) NULL,
        \`DepartmentId\` INT NULL,
        \`ProgramId\` INT NULL,
        \`SemesterId\` INT NULL,
        \`Source\` ENUM('DIRECT', 'LMS', 'SYSTEM', 'ADMIN') NOT NULL DEFAULT 'SYSTEM',
        \`Category\` ENUM('Authentication', 'Student', 'Faculty', 'Lab', 'Compiler', 'Submission', 'Container', 'Administration', 'Security', 'System') NOT NULL,
        \`Severity\` ENUM('Information', 'Warning', 'Error', 'Critical') NOT NULL DEFAULT 'Information',
        \`Action\` VARCHAR(100) NOT NULL,
        \`Module\` VARCHAR(100) NULL,
        \`Entity\` VARCHAR(100) NULL,
        \`EntityId\` VARCHAR(100) NULL,
        \`Description\` TEXT NULL,
        \`OldValues\` JSON NULL,
        \`NewValues\` JSON NULL,
        \`IPAddress\` VARCHAR(45) NULL,
        \`Browser\` VARCHAR(100) NULL,
        \`Device\` VARCHAR(100) NULL,
        \`OperatingSystem\` VARCHAR(100) NULL,
        \`Country\` VARCHAR(100) NULL,
        \`City\` VARCHAR(100) NULL,
        \`Status\` VARCHAR(50) DEFAULT 'SUCCESS',
        \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await tightenUsersTable(connection);

    // University Tenant IDs (e.g. from LMS) are stored in UniversityId during SSO.
    await connection.query("ALTER TABLE `StudentSessions` MODIFY `UniversityId` VARCHAR(64) NULL");
    await connection.query("ALTER TABLE `AuditLogs` MODIFY `UniversityId` VARCHAR(64) NULL");
    await connection.query("ALTER TABLE `AuditLogs_Archive` MODIFY `UniversityId` VARCHAR(64) NULL");

    // StudentCreditWallets
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`StudentCreditWallets\` (
        \`WalletId\` INT AUTO_INCREMENT PRIMARY KEY,
        \`UserId\` INT NOT NULL,
        \`Balance\` DECIMAL(10,2) DEFAULT 0.00,
        \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`UpdatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`FK_Wallet_UserId\` FOREIGN KEY (\`UserId\`) REFERENCES \`Users\`(\`UserId\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // tenants
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`tenants\` (
        \`DbId\` INT AUTO_INCREMENT PRIMARY KEY,
        \`TenantId\` VARCHAR(64) UNIQUE NOT NULL,
        \`Name\` VARCHAR(255) UNIQUE NOT NULL,
        \`Slug\` VARCHAR(100) UNIQUE NOT NULL,
        \`OfficialDomain\` VARCHAR(255) NULL,
        \`LogoUrl\` TEXT NULL,
        \`IntegrationMode\` VARCHAR(50) DEFAULT 'LMS',
        \`AdminFullName\` VARCHAR(200) NULL,
        \`AdminEmail\` VARCHAR(255) NULL,
        \`AdminPasswordHash\` VARCHAR(255) NULL,
        \`AdminPhone\` VARCHAR(50) NULL,
        \`Status\` VARCHAR(50) DEFAULT 'ACTIVE',
        \`SettingsJson\` JSON NULL,
        \`CreatedDate\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`UpdatedDate\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // user_tenant_mapping
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`user_tenant_mapping\` (
        \`MappingId\` INT AUTO_INCREMENT PRIMARY KEY,
        \`UserId\` INT NOT NULL,
        \`TenantId\` VARCHAR(64) NOT NULL,
        \`Role\` ENUM('TENANT_ADMIN', 'STUDENT') NOT NULL DEFAULT 'TENANT_ADMIN',
        \`Status\` VARCHAR(50) DEFAULT 'ACTIVE',
        \`AssignedDate\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`idx_user_tenant_unique\` (\`UserId\`, \`TenantId\`),
        INDEX \`idx_tenant_role\` (\`TenantId\`, \`Role\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // course_lab_mappings
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`course_lab_mappings\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`tenant_id\` VARCHAR(64) NOT NULL,
        \`program_id\` VARCHAR(64) NOT NULL,
        \`semester_id\` VARCHAR(64) NOT NULL,
        \`course_code\` VARCHAR(64) NOT NULL,
        \`lab_id\` VARCHAR(64) NOT NULL,
        \`status\` VARCHAR(20) DEFAULT 'active',
        \`mapped_by\` VARCHAR(64) DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`uk_tenant_course_lab\` (\`tenant_id\`, \`program_id\`, \`semester_id\`, \`course_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      const [existingMappings] = await connection.query("SELECT COUNT(*) AS cnt FROM \`course_lab_mappings\`");
      if (!existingMappings?.[0]?.cnt) {
        await connection.query(`
          INSERT INTO \`course_lab_mappings\` (tenant_id, program_id, semester_id, course_code, lab_id, status, mapped_by)
          VALUES 
            ('tnt_4925e025aa50', '2', '1', 'MC01094011', 'linux-lab', 'active', 'system'),
            ('tnt_4925e025aa50', '2', '1', 'MC01094031', 'dbms-lab', 'active', 'system'),
            ('tnt_4925e025aa50', '2', '5', 'MC01094011', 'linux-lab', 'active', 'system'),
            ('tnt_4925e025aa50', '2', '5', 'MC01094031', 'dbms-lab', 'active', 'system'),
            ('PLATFORM', '2', '1', 'MC01094011', 'linux-lab', 'active', 'system'),
            ('PLATFORM', '2', '1', 'MC01094031', 'dbms-lab', 'active', 'system'),
            ('PLATFORM', '2', '5', 'MC01094011', 'linux-lab', 'active', 'system'),
            ('PLATFORM', '2', '5', 'MC01094031', 'dbms-lab', 'active', 'system')
          ON DUPLICATE KEY UPDATE lab_id = VALUES(lab_id)
        `);
      }
    } catch (_) {}

    // lab_token_packages
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`lab_token_packages\` (
        \`Id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`LabId\` VARCHAR(100) NOT NULL,
        \`TokenAmount\` INT NOT NULL,
        \`PriceAmount\` DECIMAL(10,2) NOT NULL,
        \`Currency\` VARCHAR(10) NOT NULL DEFAULT 'INR',
        \`IsActive\` TINYINT(1) NOT NULL DEFAULT 1,
        \`CreatedBy\` BIGINT UNSIGNED NULL,
        \`CreatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`UpdatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`Id\`),
        INDEX \`IDX_LabTokenPackages_Lab\` (\`LabId\`, \`IsActive\`),
        CONSTRAINT \`UQ_LabTokenPackage\` UNIQUE (\`LabId\`, \`TokenAmount\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // token_orders
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`token_orders\` (
        \`Id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`TenantId\` VARCHAR(64) NOT NULL,
        \`StudentId\` VARCHAR(64) NOT NULL,
        \`OrderNumber\` VARCHAR(100) NOT NULL,
        \`TotalTokens\` INT NOT NULL DEFAULT 0,
        \`TotalAmount\` DECIMAL(10,2) NOT NULL,
        \`Currency\` VARCHAR(10) NOT NULL DEFAULT 'INR',
        \`Status\` ENUM('CREATED', 'PAYMENT_PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'CREATED',
        \`PaymentGateway\` VARCHAR(50) NULL DEFAULT 'RAZORPAY',
        \`GatewayOrderId\` VARCHAR(255) NULL,
        \`GatewayPaymentId\` VARCHAR(255) NULL,
        \`GatewayStatus\` VARCHAR(50) NULL,
        \`PaidAt\` DATETIME NULL,
        \`FailedAt\` DATETIME NULL,
        \`CreatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`UpdatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`Id\`),
        UNIQUE KEY \`UQ_TokenOrders_OrderNumber\` (\`OrderNumber\`),
        UNIQUE KEY \`UQ_TokenOrders_GatewayOrder\` (\`GatewayOrderId\`),
        INDEX \`IDX_TokenOrders_Student\` (\`TenantId\`, \`StudentId\`, \`CreatedAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure credit wallets and lab sessions
    await ensureCreditWalletsTables(connection);
    await ensureStudentLabTokenWalletsTableAndColumns(connection);
    await ensureLabSessionsTableAndColumns(connection);

    // token_order_items
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`token_order_items\` (
        \`Id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`OrderId\` BIGINT UNSIGNED NOT NULL,
        \`LabId\` VARCHAR(100) NOT NULL,
        \`PackageId\` BIGINT UNSIGNED NULL,
        \`LabNameSnapshot\` VARCHAR(255) NOT NULL DEFAULT 'Virtual Lab',
        \`PackageNameSnapshot\` VARCHAR(255) NOT NULL DEFAULT 'Token Package',
        \`TokenAmountSnapshot\` INT NOT NULL DEFAULT 0,
        \`UnitPriceSnapshot\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        \`CurrencySnapshot\` VARCHAR(10) NOT NULL DEFAULT 'INR',
        \`TokenQuantity\` INT UNSIGNED NOT NULL DEFAULT 0,
        \`UnitPriceAmount\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        \`LineTotalAmount\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        \`CreatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`Id\`),
        INDEX \`IDX_TokenOrderItems_Order\` (\`OrderId\`),
        INDEX \`IDX_TokenOrderItems_Lab\` (\`LabId\`),
        CONSTRAINT \`FK_TokenOrderItems_Order\` FOREIGN KEY (\`OrderId\`) REFERENCES \`token_orders\`(\`Id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // student_lab_token_transactions (Immutable Ledger)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`student_lab_token_transactions\` (
        \`Id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`TenantId\` VARCHAR(64) NOT NULL,
        \`StudentId\` VARCHAR(64) NOT NULL,
        \`LabId\` VARCHAR(100) NOT NULL,
        \`WalletId\` BIGINT UNSIGNED NOT NULL,
        \`TransactionType\` ENUM('PURCHASE', 'USAGE', 'CONSUMPTION', 'REFUND', 'ADJUSTMENT', 'ADMIN_GRANT', 'EXPIRE') NOT NULL,
        \`Tokens\` INT NOT NULL DEFAULT 0,
        \`TokenChange\` INT NOT NULL DEFAULT 0,
        \`BalanceBefore\` INT NOT NULL DEFAULT 0,
        \`BalanceAfter\` INT NOT NULL DEFAULT 0,
        \`ReferenceType\` VARCHAR(50) NULL,
        \`ReferenceId\` VARCHAR(255) NULL,
        \`Description\` VARCHAR(500) NULL,
        \`IdempotencyKey\` VARCHAR(255) NOT NULL,
        \`CreatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`Id\`),
        UNIQUE KEY \`UQ_TokenTx_Idempotency\` (\`IdempotencyKey\`),
        INDEX \`IDX_TokenTx_StudentLab\` (\`TenantId\`, \`StudentId\`, \`LabId\`),
        CONSTRAINT \`FK_TokenTx_Wallet\` FOREIGN KEY (\`WalletId\`) REFERENCES \`student_lab_token_wallets\` (\`Id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // lab_token_usage
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`lab_token_usage\` (
        \`Id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`TenantId\` VARCHAR(64) NOT NULL,
        \`StudentId\` VARCHAR(64) NOT NULL,
        \`LabId\` VARCHAR(100) NOT NULL,
        \`LabSessionId\` VARCHAR(100) NOT NULL,
        \`WalletId\` BIGINT UNSIGNED NOT NULL,
        \`TokensUsed\` INT NOT NULL,
        \`RuntimeSeconds\` INT NOT NULL,
        \`BalanceBefore\` INT NOT NULL,
        \`BalanceAfter\` INT NOT NULL,
        \`BillingSequence\` INT NOT NULL,
        \`IdempotencyKey\` VARCHAR(255) NOT NULL,
        \`CreatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`Id\`),
        UNIQUE KEY \`UQ_LabUsage_Idempotency\` (\`IdempotencyKey\`),
        UNIQUE KEY \`UQ_LabUsage_Sequence\` (\`LabSessionId\`, \`BillingSequence\`),
        INDEX \`IDX_LabUsage_StudentLab\` (\`TenantId\`, \`StudentId\`, \`LabId\`),
        CONSTRAINT \`FK_LabUsage_Wallet\` FOREIGN KEY (\`WalletId\`) REFERENCES \`student_lab_token_wallets\` (\`Id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // SSO replay protection (migration 011)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`SSOReplayStore\` (
        \`ReplayId\` VARCHAR(255) PRIMARY KEY,
        \`TenantId\` VARCHAR(64) NOT NULL,
        \`ExpiresAt\` DATETIME NOT NULL,
        \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_replay_expires\` (\`ExpiresAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Re-enable foreign key checks
    await connection.query("SET FOREIGN_KEY_CHECKS = 1;");
    console.log("[MySQL] Core database schema verified successfully.");

    connection.release();
    return true;
  } catch (error) {
    console.error("[MySQL] Failed to initialize database:", error.message);
    if (connection) connection.release();
    return false;
  }
};

export default pool;
