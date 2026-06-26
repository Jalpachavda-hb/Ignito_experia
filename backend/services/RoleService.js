import { roleRepository } from "../repositories/RoleRepository.js";

const groupPermissions = (rows) => {
  const rolesMap = {};
  for (const row of rows) {
    if (!rolesMap[row.RoleId]) {
      rolesMap[row.RoleId] = {
        roleId: row.RoleId,
        name: row.Name,
        description: row.Description,
        isSystem: Boolean(row.IsSystem),
        isActive: Boolean(row.IsActive),
        userCount: row.UserCount ?? 0,
        createdBy: row.CreatedBy,
        updatedBy: row.UpdatedBy,
        createdDate: row.CreatedDate,
        updatedDate: row.UpdatedDate,
        permissions: {}
      };
    }

    if (row.ModuleCode) {
      rolesMap[row.RoleId].permissions[row.ModuleCode] = {
        create: Boolean(row.CanCreate),
        read: Boolean(row.CanRead),
        update: Boolean(row.CanUpdate),
        delete: Boolean(row.CanDelete)
      };
    }
  }
  return Object.values(rolesMap);
};

class RoleService {
  async getAllRoles() {
    const rows = await roleRepository.getAll();
    return groupPermissions(rows);
  }

  async getRoleById(roleId) {
    const rows = await roleRepository.getById(roleId);
    if (!rows || rows.length === 0) return null;
    return groupPermissions(rows)[0] || null;
  }

  async createRole(roleData, createdBy) {
    const { Name, Description, Permissions } = roleData;
    
    // Convert permissions map to JSON array of objects for SP
    const permissionsArray = [];
    if (Permissions) {
      Object.entries(Permissions).forEach(([moduleCode, actions]) => {
        permissionsArray.push({
          ModuleCode: moduleCode,
          CanCreate: actions.create ? 1 : 0,
          CanRead: actions.read ? 1 : 0,
          CanUpdate: actions.update ? 1 : 0,
          CanDelete: actions.delete ? 1 : 0
        });
      });
    }

    const result = await roleRepository.insert({
      Name,
      Description,
      IsSystem: 0, // Custom created roles are not system roles
      CreatedBy: createdBy,
      PermissionsJson: JSON.stringify(permissionsArray)
    });

    if (result && result.Status === "Error") {
      throw new Error(result.Message);
    }
    return result;
  }

  async updateRole(roleId, roleData, updatedBy) {
    const { Name, Description, Permissions } = roleData;

    // First check if role exists and is system role
    const existing = await this.getRoleById(roleId);
    if (!existing) {
      throw new Error("Role not found.");
    }

    // Convert permissions map to JSON array
    const permissionsArray = [];
    if (Permissions) {
      Object.entries(Permissions).forEach(([moduleCode, actions]) => {
        permissionsArray.push({
          ModuleCode: moduleCode,
          CanCreate: actions.create ? 1 : 0,
          CanRead: actions.read ? 1 : 0,
          CanUpdate: actions.update ? 1 : 0,
          CanDelete: actions.delete ? 1 : 0
        });
      });
    }

    const result = await roleRepository.update(roleId, {
      Name,
      Description,
      UpdatedBy: updatedBy,
      PermissionsJson: JSON.stringify(permissionsArray)
    });

    if (result && result.Status === "Error") {
      throw new Error(result.Message);
    }
    return result;
  }

  async deleteRole(roleId, userId) {
    const existing = await this.getRoleById(roleId);
    if (!existing) {
      throw new Error("Role not found.");
    }
    if (existing.isSystem) {
      throw new Error("System roles cannot be deleted.");
    }

    const result = await roleRepository.softDelete(roleId, userId);
    if (result && result.Status === "Error") {
      throw new Error(result.Message);
    }
    return result;
  }
}

export const roleService = new RoleService();
