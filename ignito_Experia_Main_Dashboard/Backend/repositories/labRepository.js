import pool from "../config/db.js";

class LabRepository {
  async getAllAdmin(status) {
    let sql = "SELECT * FROM labs WHERE COALESCE(IsDeleted, 0) = 0";
    const params = [];
    if (status) {
      sql += " AND Status = ?";
      params.push(status);
    }
    sql += " ORDER BY DisplayOrder ASC, LabId DESC";
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async getAllActive() {
    const [rows] = await pool.query(
      "SELECT * FROM labs WHERE Status = 'active' AND COALESCE(IsDeleted, 0) = 0 ORDER BY DisplayOrder ASC, LabId DESC"
    );
    return rows;
  }

  async getById(labId) {
    const [rows] = await pool.query(
      "SELECT * FROM labs WHERE (LabCode = ? OR LabId = ?) AND COALESCE(IsDeleted, 0) = 0",
      [labId, labId]
    );
    return rows[0] || null;
  }

  async insert(labData) {
    const {
      LabCode, Title, Subtitle, Logo,
      DurationMinutes, Credits, Complexity, Category,
      Description, TaskDefinition, RuntimeType, RuntimePort,
      RuntimePath, ContainerApiEnabled, ContainerApiPort,
      DisplayOrder, CreatedBy,
    } = labData;

    const [res] = await pool.query(
      `INSERT INTO labs (
        LabCode, Title, Subtitle, Logo, DurationMinutes, Credits,
        Complexity, Category, Description, TaskDefinition, RuntimeType,
        RuntimePort, RuntimePath, ContainerApiEnabled, ContainerApiPort,
        DisplayOrder, Status, CreatedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        LabCode, Title, Subtitle || null, Logo || null,
        DurationMinutes || 0, Credits || 0, Complexity || null,
        Category || null, Description || null, TaskDefinition || null,
        RuntimeType || "ide", RuntimePort || null, RuntimePath || null,
        ContainerApiEnabled ? 1 : 0, ContainerApiPort || null,
        DisplayOrder || 0, CreatedBy || null
      ]
    );
    return { LabId: res.insertId, LabCode };
  }

  async update(labId, labData) {
    const {
      LabCode, Title, Subtitle, Logo,
      DurationMinutes, Credits, Complexity, Category,
      Description, TaskDefinition, RuntimeType, RuntimePort,
      RuntimePath, ContainerApiEnabled, ContainerApiPort,
      DisplayOrder, UpdatedBy,
    } = labData;

    await pool.query(
      `UPDATE labs SET 
        LabCode = ?, Title = ?, Subtitle = ?, Logo = ?,
        DurationMinutes = ?, Credits = ?, Complexity = ?, Category = ?,
        Description = ?, TaskDefinition = ?, RuntimeType = ?,
        RuntimePort = ?, RuntimePath = ?, ContainerApiEnabled = ?,
        ContainerApiPort = ?, DisplayOrder = ?, UpdatedDate = NOW()
       WHERE LabCode = ? OR LabId = ?`,
      [
        LabCode, Title, Subtitle || null, Logo || null,
        DurationMinutes || 0, Credits || 0, Complexity || null,
        Category || null, Description || null, TaskDefinition || null,
        RuntimeType || "ide", RuntimePort || null, RuntimePath || null,
        ContainerApiEnabled ? 1 : 0, ContainerApiPort || null,
        DisplayOrder || 0,
        labId, labId
      ]
    );
    return { success: true, labId };
  }

  async softDelete(labId, updatedBy) {
    await pool.query(
      `DELETE FROM labs WHERE LabCode = ? OR LabId = ?`,
      [labId, labId]
    );
    return { success: true, labId };
  }

  async updateStatus(labId, status, updatedBy) {
    await pool.query(
      `UPDATE labs SET Status = ?, UpdatedDate = NOW() WHERE LabCode = ? OR LabId = ?`,
      [status, labId, labId]
    );
    return { success: true, labId, status };
  }
}

export const labRepository = new LabRepository();
