import { labRepository } from "../../repositories/labRepository.js";
import { lmsCourseService } from "./LmsCourseService.js";
import { loadOwnedProgrammes } from "./studentLmsContext.js";
import {
  collectSemesterNumbers,
  dedupeSemesters,
  programmeMatches,
} from "./programmeNormalize.js";

function labTitle(record, fallback) {
  if (!record) return fallback || "Virtual Lab";
  return record.Title || record.title || record.Name || record.name || record.LabName || fallback || "Virtual Lab";
}

function allowedSemesters(coursePayload, programme) {
  const fromApi = collectSemesterNumbers(
    coursePayload?.semesterList,
    (coursePayload?.courseList || []).map((course) => course?.semesterNumber ?? course?.semesterId ?? course?.semester)
  );
  if (fromApi.size > 0) return fromApi;
  return collectSemesterNumbers(programme?.semesters);
}

class LmsSemesterService {
  async getByProgramme(args) {
    const result = await lmsCourseService.getByProgramme({ ...args, semester: null });
    return {
      success: true,
      lmsStatus: result.lmsStatus,
      semesterList: result.semesterList || [],
    };
  }

  async enrichProgrammes(ctx, programmes) {
    const list = Array.isArray(programmes) ? programmes : [];
    if (!ctx?.tenant || list.length === 0) return list;

    const enriched = [];
    for (const programme of list) {
      const programmeId = programme?.programmeId ?? programme?.programId;
      if (programmeId == null || programmeId === "") {
        enriched.push(programme);
        continue;
      }
      try {
        const result = await lmsCourseService.getByProgramme({
          tenantId: ctx.tenant.TenantId,
          provider: ctx.provider,
          programmeId,
          semester: null,
          externalStudentId: ctx.externalStudentId,
        });
        const numbers = [...allowedSemesters(result, programme)];
        if (numbers.length) {
          enriched.push({ ...programme, semesters: dedupeSemesters(numbers) });
          continue;
        }
      } catch (err) {
        console.warn("[LmsSemesterService] Semester enrichment skipped:", err.message);
      }
      enriched.push(programme);
    }
    return enriched;
  }

  /**
   * Returns labs only when the authenticated student owns the programme and semester.
   * A changed query string cannot read another semester's courses.
   */
  async getAuthorizedLabs({ ctx, programId, semester }) {
    if (!ctx?.universityStudent || !ctx?.tenant) {
      return {
        success: true,
        isLmsStudent: false,
        authorized: false,
        labs: [],
        courses: [],
      };
    }
    if (programId == null || programId === "" || semester == null || semester === "") {
      return {
        success: true,
        isLmsStudent: true,
        authorized: false,
        labs: [],
        courses: [],
        message: "programId and semester are required",
      };
    }

    const owned = await loadOwnedProgrammes(ctx);
    const match = owned.programmes.find((programme) => programmeMatches(programme, programId));
    if (!match) {
      return {
        success: true,
        isLmsStudent: true,
        authorized: false,
        lmsStatus: owned.lmsStatus,
        labs: [],
        courses: [],
      };
    }

    const programmeId = match.programmeId ?? match.programId;
    const catalogue = await lmsCourseService.getByProgramme({
      tenantId: ctx.tenant.TenantId,
      provider: ctx.provider,
      programmeId,
      semester: null,
      externalStudentId: ctx.externalStudentId,
    });
    const wanted = String(semester);
    if (catalogue.lmsStatus !== "LIVE") {
      return {
        success: true,
        isLmsStudent: true,
        authorized: false,
        lmsStatus: catalogue.lmsStatus,
        programId: programmeId,
        programName: match.programmeName || match.programName || null,
        semester: wanted,
        labs: [],
        courses: [],
        message: "LMS course data is temporarily unavailable.",
      };
    }
    const allowed = allowedSemesters(catalogue, match);
    if (!allowed.has(wanted)) {
      return {
        success: true,
        isLmsStudent: true,
        authorized: false,
        lmsStatus: catalogue.lmsStatus,
        programId: programmeId,
        programName: match.programmeName || match.programName || null,
        semester: wanted,
        labs: [],
        courses: [],
      };
    }

    const scoped = await lmsCourseService.getByProgramme({
      tenantId: ctx.tenant.TenantId,
      provider: ctx.provider,
      programmeId,
      semester: wanted,
      externalStudentId: ctx.externalStudentId,
    });

    const courses = scoped.courseList || [];
    const labs = [];
    for (const course of courses) {
      const mapped = course?.mappedLab;
      if (!mapped?.labId) continue;
      const record = await labRepository.getById(mapped.labId).catch(() => null);
      const title = labTitle(record, mapped.title);
      labs.push({
        courseCode: course.courseCode || course.code || course.subjectCode || null,
        courseName: course.courseName || course.name || course.subjectName || null,
        semester: wanted,
        programId: programmeId,
        programName: match.programmeName || match.programName || null,
        mappedLab: {
          ...mapped,
          title,
        },
        lab: {
          id: record?.LabCode || record?.LabId || mapped.labId,
          labId: mapped.labId,
          title,
          subtitle: record?.Subtitle || record?.subtitle || "",
          category: record?.Category || record?.category || "Course Lab",
          durationMinutes: record?.DurationMinutes || record?.durationMinutes || null,
          credits: record?.Credits || record?.credits || null,
          status: record?.Status || record?.status || "active",
        },
      });
    }

    return {
      success: true,
      isLmsStudent: true,
      authorized: true,
      lmsStatus: scoped.lmsStatus,
      tenantId: ctx.tenant.TenantId,
      programId: programmeId,
      programName: match.programmeName || match.programName || null,
      semester: wanted,
      courses,
      labs,
    };
  }
}

export const lmsSemesterService = new LmsSemesterService();
