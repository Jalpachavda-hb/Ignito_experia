import pool from "../lib/mysql.js";

class RuntimeTypesRepository {
  async getAllActive() {
    const [rows] = await pool.query("SELECT `Value` as value, `Label` as label FROM `RuntimeTypes` WHERE `IsActive` = 1 ORDER BY `Label` ASC");
    return rows;
  }
}

export const runtimeTypesRepository = new RuntimeTypesRepository();
