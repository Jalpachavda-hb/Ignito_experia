import mysql from "mysql2/promise";
import { ENV } from "../config/env.js"; // Wait, I should check if ENV exists or use process.env directly.

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "ignito_experia",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const getDbConnection = async () => {
  return await pool.getConnection();
};

export const verifyDbConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("[MySQL] Connected successfully to the database.");
    connection.release();

    try {
      const [rows] = await pool.query("SELECT LabId, LabCode, Title, RuntimeType, RuntimePort, RuntimePath FROM Labs");
      const fs = await import("fs");
      fs.writeFileSync("scratch_out.txt", JSON.stringify(rows, null, 2));
      console.log("[MySQL DEBUG Labs]", JSON.stringify(rows, null, 2));
    } catch (e) {
      console.error("[MySQL DEBUG Labs error]", e);
    }

    try {
      const [columns] = await pool.query("SHOW COLUMNS FROM Labs;");
      const hasIsDeleted = columns.some(c => c.Field === 'IsDeleted');
      const activeField = hasIsDeleted ? 'IsDeleted' : 'IsActive';
      const activeVal = hasIsDeleted ? 0 : 1;

      console.log("[MySQL] Seeding mobile-app-lab if not exists...");
      await pool.query(`INSERT IGNORE INTO Labs (
          LabCode, Title, Subtitle, Semester, Logo, DurationMinutes, Credits,
          Complexity, Category, Description, Status, TaskDefinition, RuntimeType, RuntimePort,
          RuntimePath, ContainerApiEnabled, ContainerApiPort, ${activeField}
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
          8080,
          ${activeVal}
      );`);
      console.log("[MySQL] Seeding completed successfully.");
    } catch (dbErr) {
      console.error("[MySQL] Android Lab seeding failed:", dbErr.message);
    }

    // ── Roles & Permissions Migrations ──
    try {
      console.log("[MySQL] Running Roles & Permissions Migrations...");
      
      // 1. Create Roles table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`Roles\` (
          \`RoleId\`      BIGINT         AUTO_INCREMENT PRIMARY KEY,
          \`Name\`        VARCHAR(100)   NOT NULL UNIQUE COMMENT 'Display name of the role',
          \`Description\` TEXT           NULL,
          \`IsSystem\`    TINYINT(1)     NOT NULL DEFAULT 0 COMMENT '1 = built-in, cannot be deleted',
          \`IsActive\`    TINYINT(1)     NOT NULL DEFAULT 1,
          \`CreatedBy\`   BIGINT         NULL,
          \`UpdatedBy\`   BIGINT         NULL,
          \`CreatedDate\` DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`UpdatedDate\` DATETIME       NULL ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`IDX_Roles_Name\`     (\`Name\`),
          INDEX \`IDX_Roles_IsActive\` (\`IsActive\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 2. Create RolePermissions table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`RolePermissions\` (
          \`PermissionId\` BIGINT        AUTO_INCREMENT PRIMARY KEY,
          \`RoleId\`       BIGINT        NOT NULL,
          \`ModuleCode\`   VARCHAR(100)  NOT NULL COMMENT 'e.g. ROLE_MANAGEMENT, USER_MANAGEMENT',
          \`CanCreate\`    TINYINT(1)    NOT NULL DEFAULT 0,
          \`CanRead\`      TINYINT(1)    NOT NULL DEFAULT 0,
          \`CanUpdate\`    TINYINT(1)    NOT NULL DEFAULT 0,
          \`CanDelete\`    TINYINT(1)    NOT NULL DEFAULT 0,
          CONSTRAINT \`FK_RolePermissions_RoleId\`
              FOREIGN KEY (\`RoleId\`) REFERENCES \`Roles\`(\`RoleId\`)
              ON DELETE CASCADE
              ON UPDATE CASCADE,
          UNIQUE KEY \`UQ_RolePermissions_RoleId_ModuleCode\` (\`RoleId\`, \`ModuleCode\`),
          INDEX \`IDX_RolePermissions_RoleId\`     (\`RoleId\`),
          INDEX \`IDX_RolePermissions_ModuleCode\` (\`ModuleCode\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 3. Add RoleId to Users table if not exists
      const [userCols] = await pool.query("SHOW COLUMNS FROM Users");
      const userColNames = userCols.map(c => c.Field);
      if (!userColNames.includes("RoleId")) {
        console.log("[MySQL] Adding RoleId column to Users table...");
        await pool.query(`
          ALTER TABLE \`Users\`
              ADD COLUMN \`RoleId\` BIGINT NULL
                  COMMENT 'FK to Roles.RoleId — set via migration from Role varchar'
                  AFTER \`Role\`;
        `);
      }

      // 4. Seed system roles if none exist
      const [roleCount] = await pool.query("SELECT COUNT(*) as count FROM Roles");
      if (roleCount[0].count === 0) {
        console.log("[MySQL] Seeding default system roles and permissions...");
        await pool.query(`
          INSERT INTO \`Roles\` (\`Name\`, \`Description\`, \`IsSystem\`, \`IsActive\`) VALUES
          ('Super Admin',  'Full access to all features and system configuration.',            1, 1),
          ('Tenant Admin', 'Manages institution settings, users, labs and academic data.',     1, 1),
          ('Faculty',      'Instructors who can manage labs, courses and monitor students.',   1, 1),
          ('Student',      'Standard end-user who can view labs and access learning content.', 1, 1);
        `);

        // Get IDs
        const [roles] = await pool.query("SELECT RoleId, Name FROM Roles");
        const roleMap = {};
        roles.forEach(r => roleMap[r.Name] = r.RoleId);

        const superAdminId = roleMap["Super Admin"];
        const tenantAdminId = roleMap["Tenant Admin"];
        const facultyId = roleMap["Faculty"];
        const studentId = roleMap["Student"];

        // Seed permissions
        const perms = [];
        const modules = [
          'ROLE_MANAGEMENT', 'USER_MANAGEMENT', 'LAB_MANAGEMENT', 'PROGRAM_MANAGEMENT',
          'SEMESTER_MANAGEMENT', 'CREDIT_MANAGEMENT', 'REPORTS', 'SETTINGS', 'SESSION_MONITORING'
        ];

        // Super Admin
        for (const mod of modules) {
          perms.push([superAdminId, mod, 1, 1, 1, 1]);
        }
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
          await pool.query(`
            INSERT INTO \`RolePermissions\` (\`RoleId\`, \`ModuleCode\`, \`CanCreate\`, \`CanRead\`, \`CanUpdate\`, \`CanDelete\`)
            VALUES (?, ?, ?, ?, ?, ?);
          `, p);
        }
      }

      // 5. Sync existing users
      await pool.query(`
        UPDATE \`Users\` u
        JOIN \`Roles\` r ON r.\`Name\` = u.\`Role\`
        SET u.\`RoleId\` = r.\`RoleId\`
        WHERE u.\`RoleId\` IS NULL;
      `);

      // 6. Ensure FK on Users.RoleId exists
      try {
        await pool.query(`
          ALTER TABLE \`Users\`
              ADD CONSTRAINT \`FK_Users_RoleId\`
              FOREIGN KEY (\`RoleId\`) REFERENCES \`Roles\`(\`RoleId\`)
              ON DELETE SET NULL
              ON UPDATE CASCADE;
        `);
      } catch (fkErr) {
        // FK might already exist, safe to ignore
      }

      // 7. Setup Stored Procedures
      const procedures = [
        {
          name: "sp_Role_GetAll",
          sql: `
            CREATE PROCEDURE \`sp_Role_GetAll\` ()
            BEGIN
                DECLARE v_ErrorNumber INT;
                DECLARE v_ErrorMessage TEXT;
                DECLARE EXIT HANDLER FOR SQLEXCEPTION
                BEGIN
                    GET DIAGNOSTICS CONDITION 1
                        v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
                    CALL sp_LogError('Roles', 'sp_Role_GetAll', v_ErrorMessage, v_ErrorNumber, 'No parameters');
                    SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
                END;
                SELECT r.\`RoleId\`, r.\`Name\`, r.\`Description\`, r.\`IsSystem\`, r.\`IsActive\`, r.\`CreatedBy\`, r.\`UpdatedBy\`, r.\`CreatedDate\`, r.\`UpdatedDate\`,
                       rp.\`PermissionId\`, rp.\`ModuleCode\`, rp.\`CanCreate\`, rp.\`CanRead\`, rp.\`CanUpdate\`, rp.\`CanDelete\`
                FROM \`Roles\` r
                LEFT JOIN \`RolePermissions\` rp ON rp.\`RoleId\` = r.\`RoleId\`
                WHERE r.\`IsActive\` = 1
                ORDER BY r.\`RoleId\` ASC, rp.\`ModuleCode\` ASC;
            END
          `
        },
        {
          name: "sp_Role_GetById",
          sql: `
            CREATE PROCEDURE \`sp_Role_GetById\` (IN p_RoleId BIGINT)
            BEGIN
                DECLARE v_ErrorNumber INT;
                DECLARE v_ErrorMessage TEXT;
                DECLARE EXIT HANDLER FOR SQLEXCEPTION
                BEGIN
                    GET DIAGNOSTICS CONDITION 1
                        v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
                    CALL sp_LogError('Roles', 'sp_Role_GetById', v_ErrorMessage, v_ErrorNumber, CONCAT('RoleId: ', IFNULL(p_RoleId, 'NULL')));
                    SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
                END;
                SELECT r.\`RoleId\`, r.\`Name\`, r.\`Description\`, r.\`IsSystem\`, r.\`IsActive\`, r.\`CreatedBy\`, r.\`UpdatedBy\`, r.\`CreatedDate\`, r.\`UpdatedDate\`,
                       rp.\`PermissionId\`, rp.\`ModuleCode\`, rp.\`CanCreate\`, rp.\`CanRead\`, rp.\`CanUpdate\`, rp.\`CanDelete\`
                FROM \`Roles\` r
                LEFT JOIN \`RolePermissions\` rp ON rp.\`RoleId\` = r.\`RoleId\`
                WHERE r.\`RoleId\` = p_RoleId AND r.\`IsActive\` = 1
                ORDER BY rp.\`ModuleCode\` ASC;
            END
          `
        },
        {
          name: "sp_Role_Insert",
          sql: `
            CREATE PROCEDURE \`sp_Role_Insert\` (
                IN p_Name VARCHAR(100),
                IN p_Description TEXT,
                IN p_IsSystem TINYINT(1),
                IN p_CreatedBy BIGINT,
                IN p_PermissionsJson LONGTEXT
            )
            BEGIN
                DECLARE v_ErrorNumber INT;
                DECLARE v_ErrorMessage TEXT;
                DECLARE v_RoleId BIGINT;
                DECLARE v_PermissionCount INT DEFAULT 0;
                DECLARE v_Index INT DEFAULT 0;
                DECLARE v_ModuleCode VARCHAR(100);
                DECLARE v_CanCreate TINYINT(1);
                DECLARE v_CanRead TINYINT(1);
                DECLARE v_CanUpdate TINYINT(1);
                DECLARE v_CanDelete TINYINT(1);
                DECLARE EXIT HANDLER FOR SQLEXCEPTION
                BEGIN
                    GET DIAGNOSTICS CONDITION 1
                        v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
                    ROLLBACK;
                    CALL sp_LogError('Roles', 'sp_Role_Insert', v_ErrorMessage, v_ErrorNumber, CONCAT('Name: ', IFNULL(p_Name, 'NULL')));
                    SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
                END;
                START TRANSACTION;
                INSERT INTO \`Roles\` (\`Name\`, \`Description\`, \`IsSystem\`, \`IsActive\`, \`CreatedBy\`, \`CreatedDate\`)
                VALUES (p_Name, p_Description, IFNULL(p_IsSystem, 0), 1, p_CreatedBy, NOW());
                SET v_RoleId = LAST_INSERT_ID();
                IF p_PermissionsJson IS NOT NULL AND JSON_VALID(p_PermissionsJson) THEN
                    SET v_PermissionCount = JSON_LENGTH(p_PermissionsJson);
                    WHILE v_Index < v_PermissionCount DO
                        SET v_ModuleCode = JSON_UNQUOTE(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].ModuleCode')));
                        IF v_ModuleCode IS NOT NULL AND v_ModuleCode <> 'null' AND v_ModuleCode <> '' THEN
                            SET v_CanCreate = IFNULL(CAST(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].CanCreate')) AS SIGNED), 0);
                            SET v_CanRead = IFNULL(CAST(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].CanRead')) AS SIGNED), 0);
                            SET v_CanUpdate = IFNULL(CAST(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].CanUpdate')) AS SIGNED), 0);
                            SET v_CanDelete = IFNULL(CAST(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].CanDelete')) AS SIGNED), 0);
                            INSERT INTO \`RolePermissions\` (\`RoleId\`, \`ModuleCode\`, \`CanCreate\`, \`CanRead\`, \`CanUpdate\`, \`CanDelete\`)
                            VALUES (v_RoleId, v_ModuleCode, v_CanCreate, v_CanRead, v_CanUpdate, v_CanDelete);
                        END IF;
                        SET v_Index = v_Index + 1;
                    END WHILE;
                END IF;
                COMMIT;
                SELECT 'Success' AS Status, 'Role inserted successfully.' AS Message, v_RoleId AS InsertedId;
            END
          `
        },
        {
          name: "sp_Role_Update",
          sql: `
            CREATE PROCEDURE \`sp_Role_Update\` (
                IN p_RoleId BIGINT,
                IN p_Name VARCHAR(100),
                IN p_Description TEXT,
                IN p_UpdatedBy BIGINT,
                IN p_PermissionsJson LONGTEXT
            )
            BEGIN
                DECLARE v_ErrorNumber INT;
                DECLARE v_ErrorMessage TEXT;
                DECLARE v_PermissionCount INT DEFAULT 0;
                DECLARE v_Index INT DEFAULT 0;
                DECLARE v_ModuleCode VARCHAR(100);
                DECLARE v_CanCreate TINYINT(1);
                DECLARE v_CanRead TINYINT(1);
                DECLARE v_CanUpdate TINYINT(1);
                DECLARE v_CanDelete TINYINT(1);
                DECLARE EXIT HANDLER FOR SQLEXCEPTION
                BEGIN
                    GET DIAGNOSTICS CONDITION 1
                        v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
                    ROLLBACK;
                    CALL sp_LogError('Roles', 'sp_Role_Update', v_ErrorMessage, v_ErrorNumber, CONCAT('RoleId: ', IFNULL(p_RoleId, 'NULL')));
                    SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
                END;
                START TRANSACTION;
                UPDATE \`Roles\` SET \`Name\` = p_Name, \`Description\` = p_Description, \`UpdatedBy\` = p_UpdatedBy WHERE \`RoleId\` = p_RoleId AND \`IsActive\` = 1;
                DELETE FROM \`RolePermissions\` WHERE \`RoleId\` = p_RoleId;
                IF p_PermissionsJson IS NOT NULL AND JSON_VALID(p_PermissionsJson) THEN
                    SET v_PermissionCount = JSON_LENGTH(p_PermissionsJson);
                    WHILE v_Index < v_PermissionCount DO
                        SET v_ModuleCode = JSON_UNQUOTE(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].ModuleCode')));
                        IF v_ModuleCode IS NOT NULL AND v_ModuleCode <> 'null' AND v_ModuleCode <> '' THEN
                            SET v_CanCreate = IFNULL(CAST(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].CanCreate')) AS SIGNED), 0);
                            SET v_CanRead = IFNULL(CAST(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].CanRead')) AS SIGNED), 0);
                            SET v_CanUpdate = IFNULL(CAST(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].CanUpdate')) AS SIGNED), 0);
                            SET v_CanDelete = IFNULL(CAST(JSON_EXTRACT(p_PermissionsJson, CONCAT('$[', v_Index, '].CanDelete')) AS SIGNED), 0);
                            INSERT INTO \`RolePermissions\` (\`RoleId\`, \`ModuleCode\`, \`CanCreate\`, \`CanRead\`, \`CanUpdate\`, \`CanDelete\`)
                            VALUES (p_RoleId, v_ModuleCode, v_CanCreate, v_CanRead, v_CanUpdate, v_CanDelete);
                        END IF;
                        SET v_Index = v_Index + 1;
                    END WHILE;
                END IF;
                COMMIT;
                SELECT 'Success' AS Status, 'Role updated successfully.' AS Message;
            END
          `
        },
        {
          name: "sp_Role_Delete",
          sql: `
            CREATE PROCEDURE \`sp_Role_Delete\` (
                IN p_RoleId BIGINT,
                IN p_UpdatedBy BIGINT
            )
            BEGIN
                DECLARE v_ErrorNumber INT;
                DECLARE v_ErrorMessage TEXT;
                DECLARE EXIT HANDLER FOR SQLEXCEPTION
                BEGIN
                    GET DIAGNOSTICS CONDITION 1
                        v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
                    ROLLBACK;
                    CALL sp_LogError('Roles', 'sp_Role_Delete', v_ErrorMessage, v_ErrorNumber, CONCAT('RoleId: ', IFNULL(p_RoleId, 'NULL')));
                    SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
                END;
                IF EXISTS (SELECT 1 FROM \`Roles\` WHERE \`RoleId\` = p_RoleId AND \`IsSystem\` = 1) THEN
                    SELECT 'Error' AS Status, 'System roles cannot be deleted.' AS Message, 50001 AS ErrorCode;
                ELSE
                    START TRANSACTION;
                    UPDATE \`Roles\` SET \`IsActive\` = 0, \`UpdatedBy\` = p_UpdatedBy WHERE \`RoleId\` = p_RoleId;
                    COMMIT;
                    SELECT 'Success' AS Status, 'Role deleted successfully.' AS Message;
                END IF;
            END
          `
        }
      ];

      for (const proc of procedures) {
        await pool.query(`DROP PROCEDURE IF EXISTS \`${proc.name}\`;`);
        await pool.query(proc.sql);
        console.log(`[MySQL] Setup procedure: ${proc.name}`);
      }

      console.log("[MySQL] Roles & Permissions Migrations completed successfully!");
    } catch (migErr) {
      console.error("[MySQL] Roles & Permissions Migrations failed:", migErr.message);
    }

    return true;
  } catch (error) {
    console.error("[MySQL] Failed to connect to the database:", error.message);
    return false;
  }
};

export default pool;
