import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hashPassword } from "../utils/crypto.js";

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

    // 2. Disable foreign key checks for schema creation
    await connection.query("SET FOREIGN_KEY_CHECKS = 0;");

    // 3. Drop deprecated tables if they exist
    console.log("[MySQL] Cleaning up deprecated tables...");
    await connection.query("DROP TABLE IF EXISTS `studentprofiles`;");
    await connection.query("DROP TABLE IF EXISTS `StudentProfiles`;");
    await connection.query("DROP TABLE IF EXISTS `systemsettings`;");
    await connection.query("DROP TABLE IF EXISTS `SystemSettings`;");
    await connection.query("DROP TABLE IF EXISTS `featureflags`;");
    await connection.query("DROP TABLE IF EXISTS `FeatureFlags`;");

    // Case-sensitive migration for EC2/Linux
    console.log("[MySQL] Running database table casing migration...");
    try {
      const [tables] = await connection.query(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?",
        [process.env.DB_NAME]
      );
      const existingTables = new Set(tables.map(t => t.TABLE_NAME));

      const casingMap = {
        'labs': 'Labs',
        'roles': 'Roles',
        'rolepermissions': 'RolePermissions',
        'users': 'Users',
        'userrefreshtokens': 'UserRefreshTokens',
        'runtimetypes': 'RuntimeTypes',
        'registereddevices': 'RegisteredDevices',
        'studentsessions': 'StudentSessions',
        'refreshtokens': 'RefreshTokens',
        'auditlogs': 'AuditLogs',
        'auditlogs_archive': 'AuditLogs_Archive',
        'usedlmstokens': 'UsedLmsTokens',
        'studentaudits': 'StudentAudits',
        'studentcreditwallets': 'StudentCreditWallets',
        'analytics_dailysummary': 'Analytics_DailySummary',
        'analytics_monthlysummary': 'Analytics_MonthlySummary',
        'analytics_devicesummary': 'Analytics_DeviceSummary'
      };

      for (const [lower, upper] of Object.entries(casingMap)) {
        if (existingTables.has(lower) && lower !== upper) {
          if (!existingTables.has(upper)) {
            console.log(`[MySQL] Renaming table ${lower} to ${upper} to fix casing...`);
            try {
              await connection.query(`RENAME TABLE \`${lower}\` TO \`${upper}\`;`);
              existingTables.delete(lower);
              existingTables.add(upper);
            } catch (renameErr) {
              console.log(`[MySQL] Info: Could not rename ${lower} to ${upper} (might be case-insensitive filesystem): ${renameErr.message}`);
            }
          } else {
            console.log(`[MySQL] Both ${lower} and ${upper} exist. Merging data from ${lower} to ${upper}...`);
            try {
              await connection.query(`INSERT IGNORE INTO \`${upper}\` SELECT * FROM \`${lower}\`;`);
              await connection.query(`DROP TABLE \`${lower}\`;`);
              existingTables.delete(lower);
            } catch (mergeErr) {
              console.log(`[MySQL] Info: Could not merge ${lower} into ${upper}: ${mergeErr.message}`);
            }
          }
        }
      }
    } catch (migErr) {
      console.error("[MySQL] Casing migration lookup failed:", migErr.message);
    }

    // 4. Create all 17 capitalized tables
    console.log("[MySQL] Creating/verifying database schema...");

    // ErrorLogs
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`ErrorLogs\` (
        \`ErrorLogId\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`ModuleName\` VARCHAR(100),
        \`ProcedureName\` VARCHAR(100),
        \`ErrorMessage\` TEXT,
        \`ErrorNumber\` INT,
        \`RequestData\` LONGTEXT,
        \`CreatedDate\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`IDX_ErrorLogs_ModuleName\` (\`ModuleName\`),
        INDEX \`IDX_ErrorLogs_ProcedureName\` (\`ProcedureName\`),
        INDEX \`IDX_ErrorLogs_CreatedDate\` (\`CreatedDate\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Labs
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`Labs\` (
        \`LabId\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`TenantId\` BIGINT NULL,
        \`LabCode\` VARCHAR(100) NOT NULL UNIQUE,
        \`Title\` VARCHAR(200) NOT NULL,
        \`Subtitle\` VARCHAR(300),
        \`Semester\` VARCHAR(100),
        \`Logo\` VARCHAR(255),
        \`DurationMinutes\` INT DEFAULT 0,
        \`Credits\` INT DEFAULT 0,
        \`Complexity\` VARCHAR(50),
        \`Category\` VARCHAR(100),
        \`Description\` LONGTEXT,
        \`TaskDefinition\` VARCHAR(200),
        \`RuntimeType\` VARCHAR(50) DEFAULT 'ide',
        \`RuntimePort\` INT,
        \`RuntimePath\` VARCHAR(200),
        \`ContainerApiEnabled\` TINYINT(1) DEFAULT 0,
        \`ContainerApiPort\` INT,
        \`DisplayOrder\` INT DEFAULT 0,
        \`Status\` VARCHAR(20) NOT NULL DEFAULT 'active',
        \`IsDeleted\` TINYINT(1) NOT NULL DEFAULT 0,
        \`CreatedBy\` BIGINT NULL,
        \`UpdatedBy\` BIGINT NULL,
        \`CreatedDate\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`UpdatedDate\` DATETIME NULL,
        INDEX \`IDX_Labs_LabCode\` (\`LabCode\`),
        INDEX \`IDX_Labs_RuntimeType\` (\`RuntimeType\`),
        INDEX \`IDX_Labs_Status\` (\`Status\`),
        INDEX \`IDX_Labs_Category\` (\`Category\`),
        INDEX \`IDX_Labs_TenantId\` (\`TenantId\`),
        INDEX \`IDX_Labs_IsDeleted\` (\`IsDeleted\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Roles
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`Roles\` (
        \`RoleId\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`Name\` VARCHAR(100) NOT NULL UNIQUE,
        \`Description\` TEXT NULL,
        \`IsSystem\` TINYINT(1) NOT NULL DEFAULT 0,
        \`IsActive\` TINYINT(1) NOT NULL DEFAULT 1,
        \`CreatedBy\` BIGINT NULL,
        \`UpdatedBy\` BIGINT NULL,
        \`CreatedDate\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`UpdatedDate\` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`IDX_Roles_Name\` (\`Name\`),
        INDEX \`IDX_Roles_IsActive\` (\`IsActive\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // RolePermissions
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`RolePermissions\` (
        \`PermissionId\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`RoleId\` BIGINT NOT NULL,
        \`ModuleCode\` VARCHAR(100) NOT NULL,
        \`CanCreate\` TINYINT(1) NOT NULL DEFAULT 0,
        \`CanRead\` TINYINT(1) NOT NULL DEFAULT 0,
        \`CanUpdate\` TINYINT(1) NOT NULL DEFAULT 0,
        \`CanDelete\` TINYINT(1) NOT NULL DEFAULT 0,
        CONSTRAINT \`FK_RolePermissions_RoleId\` FOREIGN KEY (\`RoleId\`) REFERENCES \`Roles\`(\`RoleId\`) ON DELETE CASCADE ON UPDATE CASCADE,
        UNIQUE KEY \`UQ_RolePermissions_RoleId_ModuleCode\` (\`RoleId\`, \`ModuleCode\`),
        INDEX \`IDX_RolePermissions_RoleId\` (\`RoleId\`),
        INDEX \`IDX_RolePermissions_ModuleCode\` (\`ModuleCode\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Users (Consolidated)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`Users\` (
        \`UserId\` INT AUTO_INCREMENT PRIMARY KEY,
        \`FullName\` VARCHAR(255) NOT NULL,
        \`Email\` VARCHAR(255) NOT NULL UNIQUE,
        \`PasswordHash\` VARCHAR(255) NOT NULL,
        \`Role\` VARCHAR(50) NOT NULL,
        \`Status\` VARCHAR(20) DEFAULT 'Active',
        \`ProgramId\` INT NULL,
        \`SemesterId\` INT NULL,
        \`RoleId\` BIGINT NULL,
        \`PhoneNumber\` VARCHAR(50) NULL,
        \`IsDeleted\` BOOLEAN DEFAULT 0,
        \`DeletedAt\` DATETIME NULL,
        \`DeletedBy\` INT NULL,
        \`LastLoginAt\` DATETIME NULL,
        \`CreatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`UpdatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`CreatedBy\` INT NULL,
        \`UpdatedBy\` INT NULL,
        
        -- Merged StudentProfile Columns
        \`ExternalStudentId\` VARCHAR(100) NULL,
        \`UniversityId\` BIGINT NULL,
        \`Mobile\` VARCHAR(20) NULL,
        \`DepartmentId\` BIGINT NULL,
        \`Batch\` VARCHAR(50) NULL,
        \`Section\` VARCHAR(50) NULL,
        \`AuthenticationSource\` VARCHAR(50) NULL,
        INDEX \`IDX_Users_Email\` (\`Email\`),
        INDEX \`IDX_Users_RoleId\` (\`RoleId\`),
        INDEX \`IDX_Users_External\` (\`ExternalStudentId\`),
        CONSTRAINT \`FK_Users_RoleId\` FOREIGN KEY (\`RoleId\`) REFERENCES \`Roles\`(\`RoleId\`) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // UserRefreshTokens
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`UserRefreshTokens\` (
        \`TokenId\` INT AUTO_INCREMENT PRIMARY KEY,
        \`UserId\` INT NOT NULL,
        \`RefreshToken\` VARCHAR(500) NOT NULL UNIQUE,
        \`ExpiresAt\` DATETIME NOT NULL,
        \`CreatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`IsRevoked\` TINYINT(1) DEFAULT 0,
        CONSTRAINT \`FK_UserRefreshTokens_UserId\` FOREIGN KEY (\`UserId\`) REFERENCES \`Users\`(\`UserId\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // RuntimeTypes
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`RuntimeTypes\` (
        \`Id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`Value\` VARCHAR(50) NOT NULL UNIQUE,
        \`Label\` VARCHAR(100) NOT NULL,
        \`IsActive\` TINYINT(1) DEFAULT 1
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
        \`UniversityId\` BIGINT NULL,
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
        \`UniversityId\` INT NULL,
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
        \`UniversityId\` INT NULL,
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

    // UsedLmsTokens (Capitalized)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`UsedLmsTokens\` (
        \`jti\` VARCHAR(255) PRIMARY KEY,
        \`expiresAt\` DATETIME NOT NULL,
        \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // StudentAudits
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`StudentAudits\` (
        \`StudentAuditId\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`UserId\` INT NOT NULL,
        \`Action\` VARCHAR(50) NOT NULL,
        \`FieldName\` VARCHAR(100) NULL,
        \`OldValue\` TEXT NULL,
        \`NewValue\` TEXT NULL,
        \`ChangedByUserId\` BIGINT NULL,
        \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`IDX_StudentAudits_User\` (\`UserId\`),
        CONSTRAINT \`FK_StudentAudits_UserId\` FOREIGN KEY (\`UserId\`) REFERENCES \`Users\`(\`UserId\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

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

    // Analytics_DailySummary
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`Analytics_DailySummary\` (
        \`SummaryDate\` DATE NOT NULL,
        \`UniversityId\` INT NOT NULL DEFAULT 0,
        \`TotalLogins\` INT DEFAULT 0,
        \`UniqueActiveUsers\` INT DEFAULT 0,
        \`FailedLogins\` INT DEFAULT 0,
        \`LabsStarted\` INT DEFAULT 0,
        \`LabsCompleted\` INT DEFAULT 0,
        \`AvgSessionDurationMinutes\` INT DEFAULT 0,
        \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`SummaryDate\`, \`UniversityId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Analytics_MonthlySummary
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`Analytics_MonthlySummary\` (
        \`SummaryMonth\` VARCHAR(7) NOT NULL,
        \`UniversityId\` INT NOT NULL DEFAULT 0,
        \`TotalLogins\` INT DEFAULT 0,
        \`UniqueActiveUsers\` INT DEFAULT 0,
        \`FailedLogins\` INT DEFAULT 0,
        \`LabsStarted\` INT DEFAULT 0,
        \`LabsCompleted\` INT DEFAULT 0,
        \`CreatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`SummaryMonth\`, \`UniversityId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Analytics_DeviceSummary
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`Analytics_DeviceSummary\` (
        \`SummaryDate\` DATE NOT NULL,
        \`Platform\` VARCHAR(100) NOT NULL,
        \`PlatformType\` ENUM('BROWSER', 'OS') NOT NULL,
        \`SessionCount\` INT DEFAULT 0,
        PRIMARY KEY (\`SummaryDate\`, \`Platform\`, \`PlatformType\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Re-enable foreign key checks
    await connection.query("SET FOREIGN_KEY_CHECKS = 1;");
    console.log("[MySQL] All tables verified/created successfully.");

    // ── 6. Seeding Configuration & Default Roles/Users ──

    // System roles seeding
    const [roleCount] = await connection.query("SELECT COUNT(*) as count FROM Roles");
    if (roleCount[0].count === 0) {
      console.log("[MySQL] Seeding system roles...");
      await connection.query(`
        INSERT INTO \`Roles\` (\`Name\`, \`Description\`, \`IsSystem\`, \`IsActive\`) VALUES
        ('Super Admin',  'Full access to all features and system configuration.',            1, 1),
        ('Tenant Admin', 'Manages institution settings, users, labs and academic data.',     1, 1),
        ('Faculty',      'Instructors who can manage labs, courses and monitor students.',   1, 1),
        ('Student',      'Standard end-user who can view labs and access learning content.', 1, 1);
      `);

      const [roles] = await connection.query("SELECT RoleId, Name FROM Roles");
      const roleMap = {};
      roles.forEach(r => roleMap[r.Name] = r.RoleId);

      const superAdminId = roleMap["Super Admin"];
      const tenantAdminId = roleMap["Tenant Admin"];
      const facultyId = roleMap["Faculty"];
      const studentId = roleMap["Student"];

      const perms = [];
      const modules = [
        'ROLE_MANAGEMENT', 'USER_MANAGEMENT', 'LAB_MANAGEMENT', 'PROGRAM_MANAGEMENT',
        'SEMESTER_MANAGEMENT', 'CREDIT_MANAGEMENT', 'REPORTS', 'SETTINGS', 'SESSION_MONITORING'
      ];

      // Super Admin gets all
      for (const mod of modules) perms.push([superAdminId, mod, 1, 1, 1, 1]);

      // Tenant Admin
      for (const mod of modules) {
        const isRoleMgmt = mod === 'ROLE_MANAGEMENT';
        const isSession = mod === 'SESSION_MONITORING';
        const isSettings = mod === 'SETTINGS';
        perms.push([
          tenantAdminId,
          mod,
          isRoleMgmt || isSession ? 0 : 1,
          1,
          isRoleMgmt ? 0 : 1,
          isRoleMgmt || isSettings ? 0 : 1
        ]);
      }

      // Faculty
      for (const mod of modules) {
        const isLab = mod === 'LAB_MANAGEMENT';
        const isSession = mod === 'SESSION_MONITORING';
        const isReadMod = ['PROGRAM_MANAGEMENT', 'SEMESTER_MANAGEMENT', 'CREDIT_MANAGEMENT', 'REPORTS'].includes(mod);
        perms.push([
          facultyId,
          mod,
          isLab ? 1 : 0,
          isLab || isSession || isReadMod ? 1 : 0,
          isLab || isSession ? 1 : 0,
          0
        ]);
      }

      // Student
      for (const mod of modules) {
        const isLab = mod === 'LAB_MANAGEMENT';
        const isCredit = mod === 'CREDIT_MANAGEMENT';
        perms.push([
          studentId,
          mod,
          0,
          isLab || isCredit ? 1 : 0,
          0,
          0
        ]);
      }

      for (const p of perms) {
        await connection.query(`
          INSERT INTO \`RolePermissions\` (\`RoleId\`, \`ModuleCode\`, \`CanCreate\`, \`CanRead\`, \`CanUpdate\`, \`CanDelete\`)
          VALUES (?, ?, ?, ?, ?, ?);
        `, p);
      }
    }

    // RuntimeTypes Seeding
    const [runtimeCount] = await connection.query("SELECT COUNT(*) as count FROM RuntimeTypes");
    if (runtimeCount[0].count === 0) {
      console.log("[MySQL] Seeding RuntimeTypes...");
      await connection.query(`
        INSERT INTO \`RuntimeTypes\` (\`Value\`, \`Label\`) VALUES
        ('ide', 'IDE (VSCode)'),
        ('terminal', 'Terminal'),
        ('jupyter', 'Jupyter Notebook'),
        ('codeserver', 'Code Server');
      `);
    }

    // Default Super Admin Seeding
    const [usersCount] = await connection.query("SELECT COUNT(*) as count FROM Users");
    if (usersCount[0].count === 0) {
      console.log("[MySQL] Seeding default Super Admin user...");
      const passwordHash = hashPassword("admin123");
      const [superAdminRole] = await connection.query("SELECT RoleId FROM Roles WHERE Name = 'Super Admin'");
      const superAdminRoleId = superAdminRole[0]?.RoleId || null;

      await connection.query(`
        INSERT INTO Users (FullName, Email, PasswordHash, Role, RoleId, Status)
        VALUES ('System Administrator', 'admin@ignito.com', ?, 'SuperAdmin', ?, 'Active');
      `, [passwordHash, superAdminRoleId]);
    }

    // Default Labs Seeding (Only in non-production)
    const [labsCount] = await connection.query("SELECT COUNT(*) as count FROM Labs");
    if (labsCount[0].count === 0 && process.env.NODE_ENV !== "production") {
      console.log("[MySQL] Seeding default mobile-app-lab...");
      await connection.query(`
        INSERT INTO Labs (
            LabCode, Title, Subtitle, Semester, Logo, DurationMinutes, Credits,
            Complexity, Category, Description, Status, TaskDefinition, RuntimeType, RuntimePort,
            RuntimePath, ContainerApiEnabled, ContainerApiPort
        ) VALUES (
            'mobile-app-lab',
            'Mobile Application Development Lab',
            'Android Development with Gradle',
            'Semester 4',
            'default_android_logo.png',
            60,
            30,
            'Intermediate',
            'Mobile Development',
            'Build and test Android applications using Gradle, SDK tools, and Java without needing a heavy GUI editor or emulator.',
            'active',
            'vlab-dev-android-task',
            'ide',
            8080,
            '/',
            1,
            8080
        );
      `);
    }

    // ── 7. Dynamic Stored Procedure Compilation ──
    console.log("[MySQL] Compiling all stored procedures...");
    
    // Install logError procedure first
    const logErrorPath = path.join(dbFolder, "procedures", "sp_LogError.sql");
    if (fs.existsSync(logErrorPath)) {
      await runSqlProcedure(connection, logErrorPath);
    }

    const procedureDirs = [
      path.join(dbFolder, "procedures", "labs"),
      path.join(dbFolder, "procedures", "roles"),
      path.join(dbFolder, "procedures", "users")
    ];

    for (const dir of procedureDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql"));
        for (const file of files) {
          await runSqlProcedure(connection, path.join(dir, file));
        }
      }
    }

    console.log("[MySQL] Stored procedures compiled successfully.");
    connection.release();
    return true;
  } catch (error) {
    console.error("[MySQL] Failed to initialize database:", error.message);
    if (connection) connection.release();
    return false;
  }
};

// Delimiter parser to support DELIMITER and custom stored procedure queries
async function runSqlProcedure(conn, filePath) {
  try {
    const rawSql = fs.readFileSync(filePath, "utf8");
    const lines = rawSql.split("\n");
    let currentDelimiter = ";";
    let queryBuffer = "";
    
    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("DELIMITER")) {
        currentDelimiter = trimmed.split(/\s+/)[1] || ";";
        continue;
      }
      
      if (currentDelimiter !== ";") {
        queryBuffer += line + "\n";
        if (trimmed.endsWith(currentDelimiter)) {
          let query = queryBuffer.trim();
          query = query.slice(0, -currentDelimiter.length).trim();
          if (query) {
            await conn.query(query);
          }
          queryBuffer = "";
        }
      } else {
        if (trimmed.startsWith("--") || trimmed.startsWith("/*") || trimmed === "") {
          continue;
        }
        queryBuffer += line + "\n";
        if (trimmed.endsWith(";")) {
          if (queryBuffer.trim()) {
            await conn.query(queryBuffer.trim());
          }
          queryBuffer = "";
        }
      }
    }
    if (queryBuffer.trim()) {
      await conn.query(queryBuffer.trim());
    }
  } catch (err) {
    console.error(`[DB] Error loading procedure ${path.basename(filePath)}:`, err.message);
  }
}

export default pool;
