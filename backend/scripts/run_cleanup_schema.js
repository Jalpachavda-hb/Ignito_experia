import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../lib/mysql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runCleanup() {
  const sqlPath = path.join(__dirname, '../database/009_cleanup.sql');
  const sqlString = fs.readFileSync(sqlPath, 'utf8');

  // Split queries by semicolon and filter out empty ones
  const queries = sqlString
    .split(';')
    .map(q => q.trim())
    .filter(q => q.length > 0);

  const connection = await pool.getConnection();
  try {
    console.log(`Found ${queries.length} queries to execute.`);
    for (const query of queries) {
      console.log(`Executing: ${query.substring(0, 50)}...`);
      await connection.query(query);
    }
    console.log("Cleanup schema applied successfully.");
  } catch (err) {
    console.error("Failed to apply cleanup schema:", err);
  } finally {
    connection.release();
    process.exit(0);
  }
}

runCleanup();
