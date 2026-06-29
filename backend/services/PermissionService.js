import pool from "../lib/mysql.js";
import { cacheProvider } from "../lib/cache.js";

class PermissionService {
  /**
   * Evaluates if a user has a specific permission.
   * Resolves via Cache first, or computes the matrix on cache miss.
   * SuperAdmin implicitly bypasses checks.
   */
  async hasPermission(userId, roleCode, permissionCode) {
    if (roleCode === 'SUPER_ADMIN') return true;

    const matrix = await this.getUserPermissionMatrix(userId, roleCode);

    // Explicit User Deny
    if (matrix.userDeny.has(permissionCode)) return false;

    // Explicit User Allow
    if (matrix.userAllow.has(permissionCode)) return true;

    // Role Allow
    if (matrix.roleAllow.has(permissionCode)) return true;

    // Default Deny
    return false;
  }

  /**
   * Retrieves the fully resolved permission matrix for a user.
   * Uses the Roles + RolePermissions tables (module-based CRUD flags).
   * Permission codes are generated as "MODULE_CODE.CREATE" / ".READ" / ".UPDATE" / ".DELETE".
   */
  async getUserPermissionMatrix(userId, roleCode) {
    const cacheKey = `permissions:user:${userId}`;
    const cached = await cacheProvider.get(cacheKey);

    if (cached) {
      return {
        userAllow: new Set(cached.userAllow),
        userDeny: new Set(cached.userDeny),
        roleAllow: new Set(cached.roleAllow)
      };
    }

    const matrix = {
      userAllow: new Set(),
      userDeny: new Set(),
      roleAllow: new Set()
    };

    // Resolve Role permissions from RolePermissions (module CRUD flags)
    if (roleCode) {
      const [roleData] = await pool.query(
        "SELECT RoleId FROM Roles WHERE Name = ? AND IsActive = 1",
        [roleCode]
      );

      if (roleData.length > 0) {
        const roleId = roleData[0].RoleId;

        const [rolePerms] = await pool.query(
          `SELECT ModuleCode, CanCreate, CanRead, CanUpdate, CanDelete
           FROM RolePermissions
           WHERE RoleId = ?`,
          [roleId]
        );

        // Build permission codes: e.g. "USER_MANAGEMENT.CREATE"
        for (const rp of rolePerms) {
          if (rp.CanCreate) matrix.roleAllow.add(`${rp.ModuleCode}.CREATE`);
          if (rp.CanRead)   matrix.roleAllow.add(`${rp.ModuleCode}.READ`);
          if (rp.CanUpdate) matrix.roleAllow.add(`${rp.ModuleCode}.UPDATE`);
          if (rp.CanDelete) matrix.roleAllow.add(`${rp.ModuleCode}.DELETE`);
        }
      }
    }

    // Store array representations in cache (1 hour TTL)
    await cacheProvider.set(cacheKey, {
      userAllow: Array.from(matrix.userAllow),
      userDeny:  Array.from(matrix.userDeny),
      roleAllow: Array.from(matrix.roleAllow)
    }, 3600);

    return matrix;
  }

  async clearUserCache(userId) {
    await cacheProvider.del(`permissions:user:${userId}`);
  }

  async clearRoleCache(roleId) {
    // A role change could affect many users — flush all permission caches
    await cacheProvider.clear();
  }
}

export const permissionService = new PermissionService();
export default permissionService;
