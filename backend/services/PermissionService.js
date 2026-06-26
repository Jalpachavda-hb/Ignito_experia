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
    
    // Role or Inherited Allow
    if (matrix.roleAllow.has(permissionCode)) return true;

    // Default Deny
    return false;
  }

  /**
   * Retrieves the fully resolved permission matrix for a user.
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

    // 1. Fetch User Overrides
    const [userPerms] = await pool.query(
      `SELECT p.PermissionCode, up.IsAllow 
       FROM UserPermissions up
       JOIN Permissions_V2 p ON up.PermissionId = p.PermissionId
       WHERE up.UserId = ?`,
      [userId]
    );

    for (const up of userPerms) {
      if (up.IsAllow) matrix.userAllow.add(up.PermissionCode);
      else matrix.userDeny.add(up.PermissionCode);
    }

    // 2. Resolve Role and Inheritance
    if (roleCode) {
      const [roleData] = await pool.query("SELECT RoleId, ParentRoleId FROM Roles_V2 WHERE RoleCode = ?", [roleCode]);
      if (roleData.length > 0) {
        let currentRoleId = roleData[0].RoleId;
        let parentRoleId = roleData[0].ParentRoleId;
        
        // Loop upwards to collect all inherited permissions (prevent infinite loops with a seen set)
        const seenRoles = new Set([currentRoleId]);
        const roleIdsToFetch = [currentRoleId];

        while (parentRoleId && !seenRoles.has(parentRoleId)) {
          roleIdsToFetch.push(parentRoleId);
          seenRoles.add(parentRoleId);
          const [parentData] = await pool.query("SELECT ParentRoleId FROM Roles_V2 WHERE RoleId = ?", [parentRoleId]);
          parentRoleId = parentData.length > 0 ? parentData[0].ParentRoleId : null;
        }

        // Fetch all permissions for this role hierarchy
        const [rolePerms] = await pool.query(
          `SELECT p.PermissionCode 
           FROM RolePermissions_V2 rp
           JOIN Permissions_V2 p ON rp.PermissionId = p.PermissionId
           WHERE rp.RoleId IN (?)`,
          [roleIdsToFetch]
        );

        for (const rp of rolePerms) {
          matrix.roleAllow.add(rp.PermissionCode);
        }
      }
    }

    // Store array representations in cache
    await cacheProvider.set(cacheKey, {
      userAllow: Array.from(matrix.userAllow),
      userDeny: Array.from(matrix.userDeny),
      roleAllow: Array.from(matrix.roleAllow)
    }, 3600); // 1 hour cache

    return matrix;
  }

  async clearUserCache(userId) {
    await cacheProvider.del(`permissions:user:${userId}`);
  }

  async clearRoleCache(roleId) {
    // A role change could affect many users.
    // In a sophisticated environment, we would use Redis SETs to track users per role.
    // Here we clear the entire cache prefix natively if possible, or flush all.
    await cacheProvider.clear();
  }
}

export const permissionService = new PermissionService();
export default permissionService;
