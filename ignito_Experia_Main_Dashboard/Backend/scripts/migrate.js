import fs from 'fs';
import path from 'path';
import pool from '../config/db.js';

// Helper to run raw SQL file (handling DELIMITER statements)
async function runSqlFile(filePath) {
  console.log(`Running SQL File: ${path.basename(filePath)}`);
  const rawSql = fs.readFileSync(filePath, 'utf8');

  // Strip MySQL DELIMITER commands, split queries
  // A naive delimiter parser for stored procedures
  const lines = rawSql.split('\n');
  let currentDelimiter = ';';
  let queryBuffer = '';
  const queries = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DELIMITER')) {
      // e.g. "DELIMITER //"
      currentDelimiter = trimmed.split(/\s+/)[1] || ';';
      continue;
    }

    if (currentDelimiter !== ';') {
      queryBuffer += line + '\n';
      if (trimmed.endsWith(currentDelimiter)) {
        // Strip the custom delimiter from the end before running
        let query = queryBuffer.trim();
        query = query.slice(0, -currentDelimiter.length).trim();
        queries.push(query);
        queryBuffer = '';
      }
    } else {
      if (trimmed.startsWith('--') || trimmed.startsWith('/*') || trimmed === '') {
        continue;
      }
      queryBuffer += line + '\n';
      if (trimmed.endsWith(';')) {
        queries.push(queryBuffer.trim());
        queryBuffer = '';
      }
    }
  }

  // Any leftover query
  if (queryBuffer.trim()) {
    queries.push(queryBuffer.trim());
  }

  // Run each query
  const conn = await pool.getConnection();
  try {
    for (const query of queries) {
      if (!query) continue;
      await conn.query(query);
    }
    console.log(`✅ Successfully executed all statements in ${path.basename(filePath)}`);
  } catch (err) {
    console.error(`❌ Error executing statement in ${path.basename(filePath)}:`);
    console.error(err.message);
    throw err;
  } finally {
    conn.release();
  }
}

async function migrate() {
  try {
    const dbName = pool.pool.config.connectionConfig.database;
    console.log(`Starting migration for database: ${dbName}...`);

    // 1. Run main schema file
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    await runSqlFile(schemaPath);

    // 2. Run error logging procedure
    const logErrPath = path.join(process.cwd(), 'database', 'procedures', 'sp_LogError.sql');
    await runSqlFile(logErrPath);

    // 3. Run auth stored procedure
    const authLoginPath = path.join(process.cwd(), 'database', 'procedures', 'auth', 'sp_Owner_Auth_Login.sql');
    await runSqlFile(authLoginPath);

    // 4. Run all lab procedures
    const labsProceduresDir = path.join(process.cwd(), 'database', 'procedures', 'labs');
    const procFiles = fs.readdirSync(labsProceduresDir).filter(f => f.endsWith('.sql'));

    for (const procFile of procFiles) {
      const procPath = path.join(labsProceduresDir, procFile);
      await runSqlFile(procPath);
    }

    console.log('\n🎉 Database schema & stored procedures initialized successfully!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
  } finally {
    process.exit(0);
  }
}

migrate();
