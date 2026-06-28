import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../lib/mysql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSqlFile(filePath) {
    const sql = fs.readFileSync(filePath, 'utf8');
    // Basic split by DELIMITER // ... DELIMITER ;
    // It's safer to just split by "//" if we know our files format
    const procedures = sql.split('DELIMITER //');
    if (procedures.length > 1) {
        const body = procedures[1].split('DELIMITER ;')[0].trim();
        // The body might contain DROP PROCEDURE and CREATE PROCEDURE separated by //
        const parts = body.split('//').map(s => s.trim()).filter(s => s.length > 0);
        for (const part of parts) {
            console.log(`Executing query from ${path.basename(filePath)}...`);
            await pool.query(part);
        }
    } else {
        await pool.query(sql);
    }
}

async function migrate() {
    try {
        const dir = path.join(__dirname, '../database/procedures/users');
        const files = [
          'sp_User_GetAll.sql',
          'sp_User_GetById.sql',
          'sp_User_Insert.sql',
          'sp_User_Update.sql',
          'sp_User_UpdateStatus.sql',
          'sp_User_Delete.sql',
          'sp_User_AddCredits.sql'
        ];
        for (const file of files) {
            await runSqlFile(path.join(dir, file));
            console.log(`Successfully migrated ${file}`);
        }
        console.log("All procedures migrated.");
    } catch (err) {
        console.error("Migration failed", err);
    } finally {
        process.exit();
    }
}

migrate();
