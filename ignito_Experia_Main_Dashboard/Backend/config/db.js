import mysql from "mysql2/promise";
import { ENV } from "./env.js";

const pool = mysql.createPool({
  host: ENV.db.host,
  port: ENV.db.port,
  user: ENV.db.user,
  password: ENV.db.password,
  database: ENV.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

export async function verifyDbConnection() {
  let conn;
  try {
    // 1. First, connect to MySQL without specifying a database to ensure the database exists
    const tempPool = mysql.createPool({
      host: ENV.db.host,
      port: ENV.db.port,
      user: ENV.db.user,
      password: ENV.db.password,
    });
    const tempConn = await tempPool.getConnection();
    await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${ENV.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    tempConn.release();
    await tempPool.end();

    // 2. Connect to the designated database
    conn = await pool.getConnection();
    console.log(`[DB] Connected to MySQL database: ${ENV.db.name}`);

    // Automatically copy required code components and assets from vlab_admin to ignito_experia_admin on startup
    try {
      const copyRecursiveSync = (src, dest) => {
        const exists = fs.existsSync(src);
        const stats = exists && fs.statSync(src);
        const isDirectory = exists && stats.isDirectory();
        if (isDirectory) {
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
          }
          fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
          });
        } else if (exists) {
          const destParent = path.dirname(dest);
          if (!fs.existsSync(destParent)) {
            fs.mkdirSync(destParent, { recursive: true });
          }
          fs.copyFileSync(src, dest);
        }
      };

      const syncItems = [
        {
          src: path.join(process.cwd(), "..", "..", "vlab_admin", "public", "images"),
          dest: path.join(process.cwd(), "..", "ignito_experia_admin", "public", "images")
        },
        {
          src: path.join(process.cwd(), "..", "..", "vlab_admin", "src", "components", "ui"),
          dest: path.join(process.cwd(), "..", "ignito_experia_admin", "src", "components", "ui")
        },
        {
          src: path.join(process.cwd(), "..", "..", "vlab_admin", "src", "context", "layout-provider.tsx"),
          dest: path.join(process.cwd(), "..", "ignito_experia_admin", "src", "context", "layout-provider.tsx")
        },
        {
          src: path.join(process.cwd(), "..", "..", "vlab_admin", "src", "lib", "cookies.ts"),
          dest: path.join(process.cwd(), "..", "ignito_experia_admin", "src", "lib", "cookies.ts")
        },
        {
          src: path.join(process.cwd(), "..", "..", "vlab_admin", "src", "components", "layout", "header.tsx"),
          dest: path.join(process.cwd(), "..", "ignito_experia_admin", "src", "components", "layout", "header.tsx")
        },
        {
          src: path.join(process.cwd(), "..", "..", "vlab_admin", "src", "components", "layout", "main.tsx"),
          dest: path.join(process.cwd(), "..", "ignito_experia_admin", "src", "components", "layout", "main.tsx")
        },
        {
          src: path.join(process.cwd(), "..", "..", "vlab_admin", "src", "hooks"),
          dest: path.join(process.cwd(), "..", "ignito_experia_admin", "src", "hooks")
        }
      ];

      for (const item of syncItems) {
        if (fs.existsSync(item.src)) {
          copyRecursiveSync(item.src, item.dest);
          console.log(`[DB/Assets] Synced programmatically: ${path.basename(item.src)}`);
        }
      }
    } catch (assetErr) {
      console.error("[DB/Assets] Failed to sync layout assets:", assetErr.message);
    }

    // Drop login stored procedure if it exists
    await conn.query("DROP PROCEDURE IF EXISTS `sp_Owner_Auth_Login`;");

    // 3. Check if schema needs to be run (e.g. if labs table doesn't exist)
    const [tables] = await conn.query(`SHOW TABLES LIKE 'labs';`);
    if (tables.length === 0) {
      console.log("[DB] 'labs' table not found. Initializing database schema...");
      
      // Read schema file
      const schemaPath = path.join(process.cwd(), "database", "schema.sql");
      const schemaSql = fs.readFileSync(schemaPath, "utf8");
      
      // Execute schema statements by stripping comment lines first
      const cleanSql = schemaSql
        .split("\n")
        .map(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith("--") || trimmed.startsWith("#") || trimmed.startsWith("/*")) {
            return "";
          }
          return line;
        })
        .join("\n");

      const statements = cleanSql
        .split(";")
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const sql of statements) {
        if (sql.includes("CREATE DATABASE") || sql.includes("USE ")) continue;
        await conn.query(sql);
      }
      console.log("[DB] Schema tables created.");

      // Seed default owner user with hashed password (Owner@1234) and default phone number
      const hash = await bcrypt.hash("Owner@1234", 10);
      await conn.query(
        `INSERT INTO owner_users (Email, PhoneNumber, PasswordHash, Role, Status)
         VALUES (?, ?, ?, 'owner', 'active')
         ON DUPLICATE KEY UPDATE PasswordHash = VALUES(PasswordHash)`,
        ["owner@ignito.com", "1234567890", hash]
      );
      console.log("[DB] Default owner user seeded: owner@ignito.com (password: Owner@1234, phone: 1234567890)");

      // Install procedures
      const logErrorPath = path.join(process.cwd(), "database", "procedures", "sp_LogError.sql");
      await runSqlProcedure(conn, logErrorPath);

      const labsProceduresDir = path.join(process.cwd(), "database", "procedures", "labs");
      if (fs.existsSync(labsProceduresDir)) {
        const procFiles = fs.readdirSync(labsProceduresDir).filter(f => f.endsWith(".sql"));
        for (const file of procFiles) {
          await runSqlProcedure(conn, path.join(labsProceduresDir, file));
        }
      }
      console.log("[DB] Stored procedures initialized successfully.");
    }

    // Ensure runtime_types table exists (outside setup block for robustness)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`runtime_types\` (
          \`Id\`    BIGINT AUTO_INCREMENT PRIMARY KEY,
          \`Value\` VARCHAR(50) NOT NULL UNIQUE,
          \`Label\` VARCHAR(100) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure it is seeded
    await conn.query(`
      INSERT IGNORE INTO \`runtime_types\` (\`Value\`, \`Label\`) VALUES
          ('ide',        'IDE'),
          ('terminal',   'Terminal'),
          ('jupyter',    'Jupyter Notebook'),
          ('codeserver', 'Code Server');
    `);

    // Ensure owner_users table exists and is migrated to the new schema (has PhoneNumber column)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`owner_users\` (
          \`OwnerId\`      BIGINT AUTO_INCREMENT PRIMARY KEY,
          \`Email\`        VARCHAR(255) NOT NULL UNIQUE,
          \`PhoneNumber\`  VARCHAR(50)  NOT NULL,
          \`PasswordHash\` VARCHAR(255) NOT NULL,
          \`Role\`         VARCHAR(50)  NOT NULL DEFAULT 'owner',
          \`Status\`       VARCHAR(20)  NOT NULL DEFAULT 'active',
          \`CreatedDate\`  DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`UpdatedDate\`  DATETIME NULL,
          INDEX \`IDX_owner_users_Email\` (\`Email\`),
          INDEX \`IDX_owner_users_Status\` (\`Status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [columns] = await conn.query("SHOW COLUMNS FROM `owner_users`;");
    const hasPhoneNumber = columns.some(c => c.Field === "PhoneNumber");
    if (!hasPhoneNumber) {
      console.log("[DB] Migrating `owner_users` table: dropping old table and recreating with PhoneNumber...");
      await conn.query("DROP TABLE IF EXISTS `owner_users`;");
      await conn.query(`
        CREATE TABLE \`owner_users\` (
            \`OwnerId\`      BIGINT AUTO_INCREMENT PRIMARY KEY,
            \`Email\`        VARCHAR(255) NOT NULL UNIQUE,
            \`PhoneNumber\`  VARCHAR(50)  NOT NULL,
            \`PasswordHash\` VARCHAR(255) NOT NULL,
            \`Role\`         VARCHAR(50)  NOT NULL DEFAULT 'owner',
            \`Status\`       VARCHAR(20)  NOT NULL DEFAULT 'active',
            \`CreatedDate\`  DATETIME DEFAULT CURRENT_TIMESTAMP,
            \`UpdatedDate\`  DATETIME NULL,
            INDEX \`IDX_owner_users_Email\` (\`Email\`),
            INDEX \`IDX_owner_users_Status\` (\`Status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    }

    // Seed default owner user if table is empty
    const [ownerRows] = await conn.query("SELECT COUNT(*) as count FROM `owner_users`;");
    if (ownerRows[0].count === 0) {
      const hash = await bcrypt.hash("Owner@1234", 10);
      await conn.query(
        `INSERT INTO owner_users (Email, PhoneNumber, PasswordHash, Role, Status)
         VALUES (?, ?, ?, 'owner', 'active')`,
        ["owner@ignito.com", "1234567890", hash]
      );
      console.log("[DB] Seeded default owner user: owner@ignito.com (password: Owner@1234, phone: 1234567890)");
    }
  } catch (err) {
    console.error("[DB] Failed to initialize database:", err.message);
    try {
      fs.writeFileSync(path.join(process.cwd(), "db_error.txt"), `Error: ${err.message}\nStack: ${err.stack}\n`);
    } catch (fsErr) {
      // ignore
    }
  } finally {
    if (conn) conn.release();
  }
}

// Naive stored procedure parser to support DELIMITER and custom statements
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
