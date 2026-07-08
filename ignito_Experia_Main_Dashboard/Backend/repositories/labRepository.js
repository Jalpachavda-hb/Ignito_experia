import pool from "../config/db.js";

class LabRepository {
  async getAllAdmin(status) {
    const [rows] = await pool.query("CALL sp_Lab_GetAll(?)", [status || null]);
    return rows[0];
  }

  async getAllActive() {
    const [rows] = await pool.query("CALL sp_Lab_GetActiveLabs()");
    return rows[0];
  }

  async getById(labId) {
    const [rows] = await pool.query("CALL sp_Lab_GetById(?)", [labId]);
    return rows[0][0] || null;
  }

  async insert(labData) {
    const {
      LabCode, Title, Subtitle, Semester, Logo,
      DurationMinutes, Credits, Complexity, Category,
      Description, TaskDefinition, RuntimeType, RuntimePort,
      RuntimePath, ContainerApiEnabled, ContainerApiPort,
      DisplayOrder, CreatedBy,
    } = labData;

    const [rows] = await pool.query(
      `CALL sp_Lab_Insert(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        LabCode, Title, Subtitle || null, Semester || null, Logo || null,
        DurationMinutes || 0, Credits || 0, Complexity || null,
        Category || null, Description || null, TaskDefinition || null,
        RuntimeType || "ide", RuntimePort || null, RuntimePath || null,
        ContainerApiEnabled ? 1 : 0, ContainerApiPort || null,
        DisplayOrder || 0, CreatedBy || null,
      ]
    );
    return rows[0][0];
  }

  async update(labId, labData) {
    const {
      LabCode, Title, Subtitle, Semester, Logo,
      DurationMinutes, Credits, Complexity, Category,
      Description, TaskDefinition, RuntimeType, RuntimePort,
      RuntimePath, ContainerApiEnabled, ContainerApiPort,
      DisplayOrder, UpdatedBy,
    } = labData;

    const [rows] = await pool.query(
      `CALL sp_Lab_Update(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        labId, LabCode, Title, Subtitle || null, Semester || null, Logo || null,
        DurationMinutes || 0, Credits || 0, Complexity || null,
        Category || null, Description || null, TaskDefinition || null,
        RuntimeType || "ide", RuntimePort || null, RuntimePath || null,
        ContainerApiEnabled ? 1 : 0, ContainerApiPort || null,
        DisplayOrder || null, UpdatedBy || null,
      ]
    );
    return rows[0][0];
  }

  async softDelete(labId, updatedBy) {
    const [rows] = await pool.query("CALL sp_Lab_Delete(?, ?)", [labId, updatedBy || null]);
    return rows[0][0];
  }

  async updateStatus(labId, status, updatedBy) {
    const [rows] = await pool.query("CALL sp_Lab_UpdateStatus(?, ?, ?)", [
      labId, status, updatedBy || null,
    ]);
    return rows[0][0];
  }
}

export const labRepository = new LabRepository();
