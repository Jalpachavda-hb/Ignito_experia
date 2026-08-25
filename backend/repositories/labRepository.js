import pool from "../lib/mysql.js";

class LabRepository {
  async getAllAdmin(status) {
    try {
      let sql = "SELECT * FROM `ignito_experia_owner`.`labs` WHERE 1=1";
      const params = [];
      if (status === "active") {
        sql += " AND `IsDeleted` = 0 AND `Status` = 'active'";
      } else if (status === "inactive") {
        sql += " AND `IsDeleted` = 0 AND `Status` = 'inactive'";
      } else if (status === "deleted") {
        sql += " AND `IsDeleted` = 1";
      }
      sql += " ORDER BY `DisplayOrder` ASC, `CreatedDate` DESC";
      const [rows] = await pool.query(sql, params);
      return rows;
    } catch (err) {
      console.warn("[LabRepository] ignito_experia_owner query failed, falling back to local Labs table:", err.message);
      try {
        const [rows] = await pool.query("CALL sp_Lab_GetAll(?)", [status || null]);
        return rows[0] || [];
      } catch (localErr) {
        console.error("[LabRepository] Local fallback failed:", localErr.message);
        return [];
      }
    }
  }

  async getAllActive() {
    try {
      const sql = "SELECT * FROM `ignito_experia_owner`.`labs` WHERE `IsDeleted` = 0 AND `Status` = 'active' ORDER BY `DisplayOrder` ASC, `CreatedDate` DESC";
      const [rows] = await pool.query(sql);
      if (rows && rows.length > 0) return rows;
    } catch (err) {}
    try {
      const [rows] = await pool.query("SELECT * FROM Labs WHERE IsDeleted = 0 AND Status = 'active'");
      return rows || [];
    } catch (localErr) {
      return [];
    }
  }

  async getById(labId) {
    try {
      const sql = "SELECT * FROM `ignito_experia_owner`.`labs` WHERE (`LabCode` = ? OR `LabId` = ?) AND `IsDeleted` = 0 LIMIT 1";
      const [rows] = await pool.query(sql, [labId, labId]);
      if (rows && rows.length > 0 && rows[0]) return rows[0];
    } catch (err) {}
    try {
      const [rows] = await pool.query("SELECT * FROM Labs WHERE (LabCode = ? OR LabId = ?) AND IsDeleted = 0 LIMIT 1", [labId, labId]);
      return rows[0] || null;
    } catch (localErr) {
      return null;
    }
  }
}

export const labRepository = new LabRepository();
