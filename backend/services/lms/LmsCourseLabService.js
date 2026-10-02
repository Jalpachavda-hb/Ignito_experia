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

    const params = [tenantId, tenantId, ...codes];
    let sql = `
      SELECT program_id, semester_id, course_code, lab_id
      FROM course_lab_mappings
      WHERE (tenant_id = ? OR tenant_id = 'PLATFORM')
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
    sql += ` ORDER BY CASE WHEN tenant_id = ? THEN 0 ELSE 1 END, id DESC`;
    params.push(tenantId);

    let rows = [];
    try {
      const [matched] = await pool.query(sql, params);
      rows = matched || [];
      if (rows.length === 0) {
        // Fallback: match by course_code regardless of program_id or semester_id
        const fallbackParams = [tenantId, ...codes, tenantId];
        const fallbackSql = `
          SELECT program_id, semester_id, course_code, lab_id
          FROM course_lab_mappings
          WHERE (tenant_id = ? OR tenant_id = 'PLATFORM')
            AND status = 'active'
            AND course_code IN (${codes.map(() => "?").join(",")})
          ORDER BY CASE WHEN tenant_id = ? THEN 0 ELSE 1 END, id DESC
        `;
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

    // Default title resolver for standard lab IDs
    const resolveLabTitle = (labId) => {
      const id = String(labId || "").toLowerCase();
      if (id.includes("linux")) return "Linux Administration Lab";
      if (id.includes("dbms")) return "DBMS & SQL Lab";
      if (id.includes("python")) return "Python";
      if (id.includes("java")) return "Java Development Lab";
      if (id.includes("dotnet")) return "Web Technology Using .NET";
      if (id.includes("mobile") || id.includes("android")) return "Fundamental of Mobile Application";
      if (id.includes("testing")) return "Software Testing Automation";
      if (id.includes("agile")) return "Agile Methodology";
      if (id.includes("data-science")) return "Data Science-I";
      if (id.includes("big-data")) return "Big Data Analytics-I";
      if (id.includes("software-eng")) return "Software Engineering";
      return "Virtual Lab";
    };

    // Auto-map courses by keywords if not in database
    const resolveFallbackMapping = (course) => {
      const name = String(course?.courseName || course?.name || course?.subjectName || "").toLowerCase();
      const code = this.courseCode(course).toUpperCase();

      if (name.includes("database") || name.includes("dbms") || name.includes("sql") || name.includes("rdbms") || code.includes("4031")) {
        return { lab_id: "dbms-lab", title: "DBMS & SQL Lab" };
      }
      if (name.includes("programming with c") || name.includes("c#") || code.includes("4011") || name.includes("dotnet") || name.includes(".net")) {
        return { lab_id: "dotnet-lab", title: "Web Technology Using .NET" };
      }
      if (name.includes("python")) return { lab_id: "python-lab", title: "Python" };
      if (name.includes("java")) return { lab_id: "java-lab", title: "Java Development Lab" };
      if (name.includes("linux")) return { lab_id: "linux-lab", title: "Linux Administration Lab" };
      if (name.includes("data science")) return { lab_id: "data-science-lab", title: "Data Science-I" };
      if (name.includes("big data")) return { lab_id: "big-data-lab", title: "Big Data Analytics-I" };
      if (name.includes("android") || name.includes("mobile")) return { lab_id: "mobile-app-lab", title: "Fundamental of Mobile Application" };
      if (name.includes("testing")) return { lab_id: "testing-lab", title: "Software Testing Automation" };
      if (name.includes("agile")) return { lab_id: "agile-lab", title: "Agile Methodology" };
      if (name.includes("software eng")) return { lab_id: "software-eng-lab", title: "Software Engineering" };
      return null;
    };

    return list.map((course) => {
      const code = this.courseCode(course);
      let mapped = byCode.get(code)?.[0];
      if (!mapped) {
        const fallback = resolveFallbackMapping(course);
        if (fallback) {
          mapped = {
            lab_id: fallback.lab_id,
            title: fallback.title,
            course_code: code,
            semester_id: semester || course?.semesterNumber || course?.semesterId || "1",
            program_id: programmeId || course?.programId || "2",
          };
        }
      }

      const practicalCredit = (course?.practicalCredit != null && !isNaN(Number(course.practicalCredit)))
        ? Number(course.practicalCredit)
        : (course?.mappedLab?.practicalCredit != null && !isNaN(Number(course.mappedLab.practicalCredit))
            ? Number(course.mappedLab.practicalCredit)
            : (course?.mappedLab?.tokens != null && !isNaN(Number(course.mappedLab.tokens))
                ? Number(course.mappedLab.tokens)
                : 60));

      if (!mapped) return { ...course, practicalCredit, mappedLab: null };

      return {
        ...course,
        practicalCredit,
        mappedLab: {
          labId: mapped.lab_id,
          title: mapped.title || resolveLabTitle(mapped.lab_id),
          courseCode: mapped.course_code || code,
          semesterId: mapped.semester_id,
          programId: mapped.program_id,
          practicalCredit,
          credits: practicalCredit,
          tokens: practicalCredit,
        },
      };
    });
  }
}

export const lmsCourseLabService = new LmsCourseLabService();
