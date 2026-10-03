import pool from "../lib/mysql.js";

export class UserWorkspaceService {
  /**
   * Ensure user_lab_workspaces table exists.
   */
  async ensureTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`user_lab_workspaces\` (
          \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
          \`userId\` VARCHAR(128) NOT NULL,
          \`labId\` VARCHAR(128) NOT NULL,
          \`filePath\` VARCHAR(255) NOT NULL,
          \`fileName\` VARCHAR(255) NOT NULL,
          \`content\` LONGTEXT,
          \`language\` VARCHAR(64) DEFAULT 'python',
          \`createdAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`updatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY \`idx_user_lab_filepath\` (\`userId\`, \`labId\`, \`filePath\`),
          INDEX \`idx_user_lab\` (\`userId\`, \`labId\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } catch (err) {
      console.warn("[UserWorkspaceService] Table ensure warning:", err.message);
    }
  }

  /**
   * Save or update a student's file for a given lab.
   */
  async saveUserWorkspaceFile(userId, labId, fileData) {
    if (!userId || !labId || !fileData?.path) return;
    const uId = String(userId);
    const lId = String(labId).toLowerCase();
    const filePath = fileData.path;
    const fileName = fileData.name || filePath.split("/").pop() || "file";
    const content = fileData.content ?? "";
    const language = fileData.language || "python";

    try {
      await pool.query(
        `INSERT INTO user_lab_workspaces (userId, labId, filePath, fileName, content, language)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           fileName = VALUES(fileName),
           content = VALUES(content),
           language = VALUES(language),
           updatedAt = CURRENT_TIMESTAMP`,
        [uId, lId, filePath, fileName, content, language]
      );
    } catch (err) {
      console.warn(`[UserWorkspaceService] Failed to persist file ${filePath} for user ${uId}:`, err.message);
    }
  }

  /**
   * Delete a student's file for a given lab.
   */
  async deleteUserWorkspaceFile(userId, labId, filePath) {
    if (!userId || !labId || !filePath) return;
    const uId = String(userId);
    const lId = String(labId).toLowerCase();

    try {
      await pool.query(
        `DELETE FROM user_lab_workspaces WHERE userId = ? AND labId = ? AND filePath = ?`,
        [uId, lId, filePath]
      );
    } catch (err) {
      console.warn(`[UserWorkspaceService] Failed to delete file ${filePath} for user ${uId}:`, err.message);
    }
  }

  /**
   * Rename a student's file or directory for a given lab.
   */
  async renameUserWorkspaceFile(userId, labId, oldPath, newPath) {
    if (!userId || !labId || !oldPath || !newPath) return;
    const uId = String(userId);
    const lId = String(labId).toLowerCase();
    const newName = newPath.split("/").pop() || "file";

    try {
      // 1. Rename exact match
      await pool.query(
        `UPDATE user_lab_workspaces
         SET filePath = ?, fileName = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE userId = ? AND labId = ? AND filePath = ?`,
        [newPath, newName, uId, lId, oldPath]
      );

      // 2. Rename folder prefix if directory
      const prefix = oldPath.endsWith("/") ? oldPath : `${oldPath}/`;
      const [children] = await pool.query(
        `SELECT filePath FROM user_lab_workspaces WHERE userId = ? AND labId = ? AND filePath LIKE ?`,
        [uId, lId, `${prefix}%`]
      );

      for (const row of children || []) {
        const nextPath = newPath + row.filePath.slice(oldPath.length);
        const childName = nextPath.split("/").pop() || "file";
        await pool.query(
          `UPDATE user_lab_workspaces SET filePath = ?, fileName = ?, updatedAt = CURRENT_TIMESTAMP
           WHERE userId = ? AND labId = ? AND filePath = ?`,
          [nextPath, childName, uId, lId, row.filePath]
        );
      }
    } catch (err) {
      console.warn(`[UserWorkspaceService] Failed to rename ${oldPath} -> ${newPath}:`, err.message);
    }
  }

  /**
   * Get all persisted files for a user and lab.
   */
  async getUserWorkspaceFiles(userId, labId) {
    if (!userId || !labId) return [];
    const uId = String(userId);
    const lId = String(labId).toLowerCase();

    try {
      const [rows] = await pool.query(
        `SELECT fileName as name, filePath as path, 'file' as type, content, language
         FROM user_lab_workspaces
         WHERE userId = ? AND labId = ?
         ORDER BY id ASC`,
        [uId, lId]
      );

      return (rows || []).map(r => ({
        name: r.name,
        path: r.path,
        type: "file",
        content: r.content ?? "",
        language: r.language || "python",
      }));
    } catch (err) {
      console.warn(`[UserWorkspaceService] Failed to get files for user ${uId}:`, err.message);
      return [];
    }
  }

  /**
   * Get default starter files if the user has no saved files for the lab.
   * Returns empty array so labs start clean with no default files.
   */
  getDefaultStarterFiles(labId) {
    return [];
  }

  /**
   * Delete all persisted files for a user and lab (used on lab stop to discard changes).
   */
  async clearUserWorkspace(userId, labId) {
    if (!userId || !labId) return;
    const uId = String(userId);
    const lId = String(labId).toLowerCase();

    try {
      await pool.query(
        `DELETE FROM user_lab_workspaces WHERE userId = ? AND labId = ?`,
        [uId, lId]
      );
      console.log(`[UserWorkspaceService] Cleared user workspace files for user ${uId}, lab ${lId}`);
    } catch (err) {
      console.warn(`[UserWorkspaceService] Failed to clear workspace for user ${uId}, lab ${lId}:`, err.message);
    }
  }
}

export const userWorkspaceService = new UserWorkspaceService();
export default userWorkspaceService;
