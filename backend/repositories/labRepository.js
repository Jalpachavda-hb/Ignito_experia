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
    const found = await this.findByCode(labId);
    return found?.row || null;
  }

  async findByCode(labId) {
    const variants = codeVariants(labId);
    if (!variants.length) return { row: null, ownerReachable: false };
    let ownerReachable = false;
    try {
      const row = await queryByVariants("`ignito_experia_owner`.`labs`", variants, labId);
      ownerReachable = true;
      if (row) return { row, ownerReachable };
    } catch {
      ownerReachable = false;
    }
    try {
      const row = await queryByVariants("Labs", variants, labId);
      return { row, ownerReachable };
    } catch {
      return { row: null, ownerReachable };
    }
  }

  async getByCodes(ids) {
    const list = [...new Set((ids || []).flatMap((id) => codeVariants(id)))];
    if (!list.length) return [];
    const numeric = [...new Set((ids || []).map((id) => String(id)).filter((id) => /^\d+$/.test(id)))];
    const load = async (table) => {
      const placeholders = list.map(() => "?").join(", ");
      const params = [...list];
      let idSql = "";
      if (numeric.length) {
        idSql = ` OR LabId IN (${numeric.map(() => "?").join(", ")})`;
        params.push(...numeric);
      }
      const [rows] = await pool.query(
        `SELECT * FROM ${table} WHERE IsDeleted = 0 AND (LabCode IN (${placeholders})${idSql})`,
        params
      );
      return rows || [];
    };
    try {
      const rows = await load("`ignito_experia_owner`.`labs`");
      if (rows.length) return rows;
    } catch {
      // Owner schema is optional; local Labs is the fallback.
    }
    try {
      return await load("Labs");
    } catch {
      return [];
    }
  }
}

function codeVariants(labId) {
  const raw = String(labId ?? "").trim();
  if (!raw) return [];
  const lower = raw.toLowerCase();
  const clean = lower.replace(/-lab$/, "").replace(/^lab-/, "");
  return [...new Set([
    raw,
    lower,
    clean,
    `${clean}-lab`,
    `lab-${clean}`,
    lower.replace(/\s+/g, "-"),
    clean.replace(/-/g, " "),
  ].filter(Boolean))];
}

async function queryByVariants(table, variants, labId) {
  const numeric = /^\d+$/.test(String(labId)) ? String(labId) : null;
  const placeholders = variants.map(() => "?").join(", ");
  const run = async (includeTitle) => {
    const params = [...variants];
    let titleSql = "";
    if (includeTitle) {
      titleSql = ` OR Title IN (${placeholders})`;
      params.push(...variants);
    }
    if (numeric != null) params.push(numeric);
    const [rows] = await pool.query(
      `SELECT * FROM ${table} WHERE IsDeleted = 0 AND (LabCode IN (${placeholders})${titleSql}${numeric != null ? " OR LabId = ?" : ""}) LIMIT 1`,
      params
    );
    return rows?.[0] || null;
  };
  try {
    return await run(true);
  } catch (err) {
    if (!/title/i.test(String(err?.message || ""))) throw err;
    return run(false);
  }
}

export const labRepository = new LabRepository();
