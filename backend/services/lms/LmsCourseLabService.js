import pool from "../../lib/mysql.js";

class LmsCourseLabService {
  courseCode(course) {
    return String(course?.courseCode || course?.code || course?.subjectCode || "").trim();
  }

  /**
   * Attach Experia lab mappings for this tenant, programme, and semester only.
   */
  async attach({ tenantId, programmeId, semester, courses }) {
    const list = Array.isArray(courses) ? courses : [];
    if (!tenantId || list.length === 0) {
      return list.map((course) => ({ ...course, mappedLab: null }));
    }

    const codes = [...new Set(list.map((course) => this.courseCode(course)).filter(Boolean))];
    if (codes.length === 0) {
      return list.map((course) => ({ ...course, mappedLab: null }));
    }

    const semesterValues = [...new Set([
      semester != null && semester !== "" ? String(semester) : null,
      ...list.map((course) => (course?.semesterId != null ? String(course.semesterId) : null)),
      ...list.map((course) => (course?.semesterNumber != null ? String(course.semesterNumber) : null)),
    ].filter(Boolean))];

    const params = [tenantId, ...codes];
    let sql = `
      SELECT program_id, semester_id, course_code, lab_id
      FROM course_lab_mappings
      WHERE tenant_id = ?
        AND status = 'active'
        AND course_code IN (${codes.map(() => "?").join(",")})
    `;
    if (semesterValues.length) {
      sql += ` AND semester_id IN (${semesterValues.map(() => "?").join(",")})`;
      params.push(...semesterValues);
    }
    if (programmeId != null && programmeId !== "") {
      sql += " AND program_id = ?";
      params.push(String(programmeId));
    }

    let rows = [];
    try {
      const [matched] = await pool.query(sql, params);
      rows = matched || [];
      if (rows.length === 0 && programmeId != null && programmeId !== "") {
        const fallbackParams = [tenantId, ...codes, ...semesterValues];
        let fallbackSql = `
          SELECT program_id, semester_id, course_code, lab_id
          FROM course_lab_mappings
          WHERE tenant_id = ?
            AND status = 'active'
            AND course_code IN (${codes.map(() => "?").join(",")})
        `;
        if (semesterValues.length) {
          fallbackSql += ` AND semester_id IN (${semesterValues.map(() => "?").join(",")})`;
        }
        const [fallback] = await pool.query(fallbackSql, fallbackParams);
        rows = fallback || [];
      }
    } catch (err) {
      console.warn("[LmsCourseLabService] Mapping lookup failed:", err.message);
    }

    const byCode = new Map();
    for (const row of rows) {
      const code = String(row.course_code);
      if (!byCode.has(code)) byCode.set(code, []);
      byCode.get(code).push(row);
    }

    return list.map((course) => {
      const code = this.courseCode(course);
      const mapped = byCode.get(code)?.[0];
      if (!mapped) return { ...course, mappedLab: null };
      return {
        ...course,
        mappedLab: {
          labId: mapped.lab_id,
          courseCode: mapped.course_code,
          semesterId: mapped.semester_id,
          programId: mapped.program_id,
        },
      };
    });
  }
}

export const lmsCourseLabService = new LmsCourseLabService();
