import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../lib/mysql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runUpdates() {
    try {
        const sqlPath = path.join(__dirname, '../database/db_updates.sql');
        let sql = fs.readFileSync(sqlPath, 'utf8');

        // Split statements. Since we have procedures, we can't just split by semicolon.
        // However, we can just run queries directly if we write them correctly here, 
        // or we can use the `multipleStatements: true` flag in mysql2 if it's enabled, 
        // but procedures have DELIMITER which mysql2 doesn't understand.

        // Let's run them one by one
        console.log("Running schema changes...");

        // Create Users and UserRefreshTokens tables
        console.log("Creating Users table...");
        await pool.query(`CREATE TABLE IF NOT EXISTS Users (
            UserId INT AUTO_INCREMENT PRIMARY KEY,
            FullName VARCHAR(255) NOT NULL,
            Email VARCHAR(255) NOT NULL UNIQUE,
            PasswordHash VARCHAR(255) NOT NULL,
            Role VARCHAR(50) NOT NULL, -- Student, Faculty, TenantAdmin, SuperAdmin
            Status VARCHAR(20) DEFAULT 'Active', -- Active, Inactive, Suspended, Pending
            ProgramId INT NULL,
            SemesterId INT NULL,
            LastLoginAt DATETIME NULL,
            CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CreatedBy INT NULL,
            UpdatedBy INT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

        console.log("Creating UserRefreshTokens table...");
        await pool.query(`CREATE TABLE IF NOT EXISTS UserRefreshTokens (
            TokenId INT AUTO_INCREMENT PRIMARY KEY,
            UserId INT NOT NULL,
            RefreshToken VARCHAR(500) NOT NULL UNIQUE,
            ExpiresAt DATETIME NOT NULL,
            CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            IsRevoked TINYINT(1) DEFAULT 0,
            FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

        // ── Remove deprecated email-verification columns if they still exist ──
        console.log("Checking for deprecated email-verification columns...");
        const [userCols] = await pool.query("SHOW COLUMNS FROM Users");
        const userColNames = userCols.map(c => c.Field);
        const colsToDrop = ['EmailVerified', 'PasswordResetToken', 'PasswordResetExpiresAt'];
        const dropClauses = colsToDrop
            .filter(col => userColNames.includes(col))
            .map(col => `DROP COLUMN ${col}`)
            .join(', ');
        if (dropClauses) {
            console.log(`Dropping columns: ${colsToDrop.filter(c => userColNames.includes(c)).join(', ')}`);
            await pool.query(`ALTER TABLE Users ${dropClauses}`);
        } else {
            console.log("No deprecated columns found — nothing to drop.");
        }

        // Check if Users table needs seeding
        const [usersCountResult] = await pool.query("SELECT COUNT(*) as count FROM Users");
        if (usersCountResult[0].count === 0) {
            console.log("Seeding default users...");
            const { hashPassword } = await import('../utils/crypto.js');
            const defaultUsers = [
                { name: "Meet Nayak", email: "admin@ignito.com", password: "admin123", role: "SuperAdmin" },
                { name: "Meet Nayak", email: "meet.nayak@hackberrysoftech.in", password: "admin123", role: "TenantAdmin" },
                { name: "Ankur Patel", email: "info@hackberrysoftech.com", password: "admin123", role: "TenantAdmin" },
                { name: "Jalpa Rajpuriya", email: "jalpa@gmail.com", password: "jalpa123", role: "Student" },
                { name: "Jalpa Rajpuriya", email: "jalpa.rajpuriya@hackberrysoftech.in", password: "jalpa123", role: "Student" },
                { name: "ayushi trivedi", email: "ayushi.hackberrysoftech@gmail.com", password: "ayushi123", role: "Student" },
                { name: "Hackberrysoftech", email: "hackberry123@gmail.com", password: "hackberry123", role: "Student" }
            ];

            for (const u of defaultUsers) {
                const passwordHash = hashPassword(u.password);
                await pool.query(
                    `INSERT INTO Users (FullName, Email, PasswordHash, Role, Status) VALUES (?, ?, ?, ?, 'Active')`,
                    [u.name, u.email, passwordHash, u.role]
                );
            }
            console.log("Users seeding completed.");
        }

        await pool.query(`CREATE TABLE IF NOT EXISTS RuntimeTypes (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        Value VARCHAR(50) NOT NULL UNIQUE,
        Label VARCHAR(100) NOT NULL,
        IsActive TINYINT(1) DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

        await pool.query(`INSERT IGNORE INTO RuntimeTypes (Value, Label) VALUES 
        ('ide', 'IDE (VSCode)'),
        ('terminal', 'Terminal'),
        ('jupyter', 'Jupyter Notebook'),
        ('codeserver', 'Code Server');`);

        await pool.query(`ALTER TABLE labs MODIFY RuntimeType VARCHAR(50) DEFAULT 'ide';`);

        console.log("Replacing sp_Lab_GetAll...");
        await pool.query(`DROP PROCEDURE IF EXISTS sp_Lab_GetAll;`);

        // Let's dynamically check if IsDeleted or IsActive is used in Labs table
        const [columns] = await pool.query("SHOW COLUMNS FROM labs;");
        const hasIsDeleted = columns.some(c => c.Field === 'IsDeleted');

        const condition = hasIsDeleted
            ? `(p_Status IS NULL OR p_Status = '' OR 
             (p_Status = 'active' AND IsDeleted = 0 AND Status != 'inactive') OR
             (p_Status = 'inactive' AND IsDeleted = 0 AND Status = 'inactive') OR
             (p_Status = 'deleted' AND IsDeleted = 1))`
            : `(p_Status IS NULL OR p_Status = '' OR 
             (p_Status = 'active' AND IsActive = 1 AND Status != 'inactive') OR
             (p_Status = 'inactive' AND IsActive = 1 AND Status = 'inactive') OR
             (p_Status = 'deleted' AND IsActive = 0))`;

        const activeColumn = hasIsDeleted ? 'IsDeleted' : 'IsActive';

        await pool.query(`
      CREATE PROCEDURE sp_Lab_GetAll (
          IN p_Status VARCHAR(20)
      )
      BEGIN
          DECLARE v_ErrorNumber INT;
          DECLARE v_ErrorMessage TEXT;
          
          DECLARE EXIT HANDLER FOR SQLEXCEPTION
          BEGIN
              GET DIAGNOSTICS CONDITION 1
                  v_ErrorNumber = MYSQL_ERRNO, v_ErrorMessage = MESSAGE_TEXT;
              CALL sp_LogError('labs', 'sp_Lab_GetAll', v_ErrorMessage, v_ErrorNumber, CONCAT('Status: ', IFNULL(p_Status, 'ALL')));
              SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
          END;

          SELECT 
              LabId, TenantId, LabCode, Title, Subtitle, Semester, Logo, 
              DurationMinutes, Credits, Complexity, Category, Description, 
              Status, TaskDefinition, RuntimeType, RuntimePort, RuntimePath, 
              ContainerApiEnabled, ContainerApiPort, ${activeColumn}, CreatedBy, UpdatedBy, 
              CreatedDate, UpdatedDate
          FROM labs
          WHERE ${condition}
          ORDER BY UpdatedDate DESC, CreatedDate DESC;
      END
    `);

        console.log("Seeding mobile-app-lab...");
        const activeField = hasIsDeleted ? 'IsDeleted' : 'IsActive';
        const activeVal = hasIsDeleted ? 0 : 1;
        await pool.query(`INSERT IGNORE INTO labs (
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

        console.log("Database updates completed successfully!");
        if (process.argv[1] && (process.argv[1].endsWith('run_db_updates.js') || process.argv[1].endsWith('run_db_updates'))) {
            process.exit(0);
        }
    } catch (error) {
        console.error("Database update failed:", error);
        if (process.argv[1] && (process.argv[1].endsWith('run_db_updates.js') || process.argv[1].endsWith('run_db_updates'))) {
            process.exit(1);
        }
    }
}

export { runUpdates };

const isDirectRun = process.argv[1] && (process.argv[1].endsWith('run_db_updates.js') || process.argv[1].endsWith('run_db_updates'));
if (isDirectRun) {
    runUpdates();
}

