import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const filesToDelete = [
  'database/006_rbac.sql',
  'services/LmsAuthService.js',
  'services/RoleManagementService.js',
  'services/StudentAuditService.js',
  'repositories/StudentAuditRepository.js',
  'handlers/rbac.js'
];

console.log("Starting cleanup of obsolete files...");

for (const relPath of filesToDelete) {
  const fullPath = path.join(rootDir, relPath);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
      console.log(`[DELETED] ${relPath}`);
    } catch (err) {
      console.error(`[ERROR] Failed to delete ${relPath}: ${err.message}`);
    }
  } else {
    console.log(`[SKIPPED] ${relPath} (Already removed)`);
  }
}

console.log("File cleanup complete.");
