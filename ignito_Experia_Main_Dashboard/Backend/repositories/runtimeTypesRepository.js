import pool from "../config/db.js";

class RuntimeTypesRepository {
  async getAll() {
    const [rows] = await pool.query(
      "SELECT `Value` as value, `Label` as label FROM `runtime_types` ORDER BY `Id`"
    );
    return rows;
  }
}

export const runtimeTypesRepository = new RuntimeTypesRepository();
