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

        await pool.query(`ALTER TABLE Labs MODIFY RuntimeType VARCHAR(50) DEFAULT 'ide';`);

        console.log("Replacing sp_Lab_GetAll...");
        await pool.query(`DROP PROCEDURE IF EXISTS sp_Lab_GetAll;`);

        // Let's dynamically check if IsDeleted or IsActive is used in Labs table
        const [columns] = await pool.query("SHOW COLUMNS FROM Labs;");
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
              CALL sp_LogError('Labs', 'sp_Lab_GetAll', v_ErrorMessage, v_ErrorNumber, CONCAT('Status: ', IFNULL(p_Status, 'ALL')));
              SELECT 'Error' AS Status, v_ErrorMessage AS Message, v_ErrorNumber AS ErrorCode;
          END;

          SELECT 
              LabId, TenantId, LabCode, Title, Subtitle, Semester, Logo, 
              DurationMinutes, Credits, Complexity, Category, Description, 
              Status, TaskDefinition, RuntimeType, RuntimePort, RuntimePath, 
              ContainerApiEnabled, ContainerApiPort, ${activeColumn}, CreatedBy, UpdatedBy, 
              CreatedDate, UpdatedDate
          FROM Labs
          WHERE ${condition}
          ORDER BY UpdatedDate DESC, CreatedDate DESC;
      END
    `);

        console.log("Seeding mobile-app-lab...");
        const activeField = hasIsDeleted ? 'IsDeleted' : 'IsActive';
        const activeVal = hasIsDeleted ? 0 : 1;
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

        console.log("Database updates completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Database update failed:", error);
        process.exit(1);
    }
}

runUpdates();
