import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../lib/mysql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    try {
        const sqlPath = path.join(__dirname, '../database/002_auth_schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log("Running Auth DB schema updates...");
        await pool.query(sql);
        console.log("Database updates completed successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Failed to run db updates:", err);
        process.exit(1);
    }
}

run();
