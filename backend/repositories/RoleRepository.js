import pool from "../lib/mysql.js";

class RoleRepository {
  async getAll() {
    const [rows] = await pool.query("CALL sp_Role_GetAll()");
    return rows[0];
  }

  async getById(roleId) {
    const [rows] = await pool.query("CALL sp_Role_GetById(?)", [roleId]);
    return rows[0];
  }

  async insert(roleData) {
    const { Name, Description, IsSystem, CreatedBy, PermissionsJson } = roleData;
    const [rows] = await pool.query(
      "CALL sp_Role_Insert(?, ?, ?, ?, ?)",
      [
        Name,
        Description || null,
        IsSystem ? 1 : 0,
        CreatedBy || null,
        PermissionsJson || "[]"
      ]
    );
    return rows[0][0];
  }

  async update(roleId, roleData) {
    const { Name, Description, UpdatedBy, PermissionsJson } = roleData;
    const [rows] = await pool.query(
      "CALL sp_Role_Update(?, ?, ?, ?, ?)",
      [
        roleId,
        Name,
        Description || null,
        UpdatedBy || null,
        PermissionsJson || "[]"
      ]
    );
    return rows[0][0];
  }

  async softDelete(roleId, updatedBy) {
    const [rows] = await pool.query("CALL sp_Role_Delete(?, ?)", [roleId, updatedBy || null]);
    return rows[0][0];
  }
}

export const roleRepository = new RoleRepository();
