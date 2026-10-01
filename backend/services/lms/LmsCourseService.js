import { LMS_PROVIDER_CONFIG } from "../../config/lms/lmsProviderConfig.js";
import { lmsApiClient } from "./LmsApiClient.js";
import { LmsApiError } from "./LmsApiError.js";
import { lmsCourseLabService } from "./LmsCourseLabService.js";
import { lmsResponseCache } from "./LmsResponseCache.js";
import { endpointUrl, numericLmsId } from "./lmsIds.js";
import { filterSemesterPayload } from "./programmeNormalize.js";

class LmsCourseService {
  cacheKey(tenantId, provider, externalStudentId, programmeId, semester = "all") {
    const student = externalStudentId == null || externalStudentId === "" ? "na" : String(externalStudentId);
    const term = semester == null || semester === "" ? "all" : String(semester);
    return `lms:courses:${tenantId}:${provider || LMS_PROVIDER_CONFIG.provider}:${student}:${programmeId}:${term}`;
  }

  cachePrefix(tenantId, provider, externalStudentId) {
    const student = externalStudentId == null || externalStudentId === "" ? "na" : String(externalStudentId);
    return `lms:courses:${tenantId}:${provider || LMS_PROVIDER_CONFIG.provider}:${student}:`;
  }

  async getBySemesterId({ tenantId, provider, semesterId, externalStudentId = null, forceRefresh = false }) {
    const sId = numericLmsId(semesterId);
    if (!tenantId || sId == null) {
      return { success: true, lmsStatus: "LMS_STUDENT_NOT_FOUND", courseList: [] };
    }

    const url = endpointUrl(LMS_PROVIDER_CONFIG.baseUrl, LMS_PROVIDER_CONFIG.coursesBySemesterEndpoint || "/api/ExperiaAPI/GetCourseBySemesterId");
    const key = `lms:courses-by-sem:${tenantId}:${provider || LMS_PROVIDER_CONFIG.provider}:${sId}`;

    try {
      const result = await lmsResponseCache.getOrFetch(key, {
        forceRefresh,
        ttlSeconds: 60,
        fetcher: () => lmsApiClient.post({
          tenantId,
          url,
          data: { semesterId: sId, SemesterId: sId },
        }),
      });

      const rawCourses =
        result.data?.courseList ||
        result.data?.courselist ||
        result.data?.courses ||
        result.data?.data ||
        (Array.isArray(result.data) ? result.data : []);
      const courseList = await lmsCourseLabService.attach({
        tenantId,
        semester: sId,
        courses: rawCourses,
      });

      return {
        success: true,
        lmsStatus: "LIVE",
        isSuccess: result.data?.isSuccess !== false,
        courseList,
        rawData: result.data,
      };
    } catch (err) {
      const lmsStatus = err instanceof LmsApiError ? err.code : "LMS_COURSES_UNAVAILABLE";
      console.warn(`[LmsCourseService] ${lmsStatus} tenant=${tenantId} semester=${sId}: ${err.message}`);
      return { success: true, lmsStatus, courseList: [] };
    }
  }

  async getByProgramme({ tenantId, provider, programmeId, semester = null, externalStudentId = null, forceRefresh = false }) {
    const id = numericLmsId(programmeId);
    if (!tenantId || id == null) {
      return { success: true, lmsStatus: "LMS_STUDENT_NOT_FOUND", semesterList: [], courseList: [] };
    }

    const url = endpointUrl(LMS_PROVIDER_CONFIG.baseUrl, LMS_PROVIDER_CONFIG.semesterCoursesEndpoint);
    const key = this.cacheKey(tenantId, provider, externalStudentId, id, "all");

    try {
      const result = await lmsResponseCache.getOrFetch(key, {
        forceRefresh,
        ttlSeconds: 60,
        fetcher: () => lmsApiClient.post({
          tenantId,
          url,
          data: { programmeId: String(id) },
        }),
      });
      const filtered = filterSemesterPayload(result.data || {}, semester);

      // Determine which semesters to enrich from GetCourseBySemesterId
      const semesterIdsToFetch = semester != null && semester !== ""
        ? [numericLmsId(semester) || semester]
        : [...new Set([
            ...filtered.courseList.map((c) => numericLmsId(c.semesterId ?? c.semesterNumber)).filter(Boolean),
            ...filtered.semesterList.map((s) => numericLmsId(s.semesterId ?? s.semesterNumber)).filter(Boolean),
          ])];

      const enrichedByCode = new Map();
      const enrichedById = new Map();

      if (semesterIdsToFetch.length > 0) {
        const semResults = await Promise.allSettled(
          semesterIdsToFetch.map((sId) =>
            this.getBySemesterId({
              tenantId,
              provider,
              semesterId: sId,
              externalStudentId,
              forceRefresh,
            })
          )
        );

        for (const res of semResults) {
          if (res.status === "fulfilled" && Array.isArray(res.value?.courseList)) {
            for (const semCourse of res.value.courseList) {
              const code = String(semCourse.courseCode || semCourse.code || semCourse.subjectCode || "").trim().toUpperCase();
              const cId = semCourse.courseDetailsId != null ? String(semCourse.courseDetailsId).trim() : null;
              if (code) enrichedByCode.set(code, semCourse);
              if (cId) enrichedById.set(cId, semCourse);
            }
          }
        }
      }

      let coursesToUse = filtered.courseList;
      if (coursesToUse.length > 0) {
        coursesToUse = coursesToUse.map((course) => {
          const code = String(course.courseCode || course.code || course.subjectCode || "").trim().toUpperCase();
          const cId = course.courseDetailsId != null ? String(course.courseDetailsId).trim() : null;
          const enriched = (code && enrichedByCode.get(code)) || (cId && enrichedById.get(cId));

          if (!enriched) return course;

          return {
            ...course,
            practicalCredit: enriched.practicalCredit != null && !isNaN(Number(enriched.practicalCredit))
              ? Number(enriched.practicalCredit)
              : course.practicalCredit,
            courseBannerImage: enriched.courseBannerImage || course.courseBannerImage,
            courseDescrpition: enriched.courseDescrpition || enriched.courseDescription || course.courseDescrpition,
            ...(enriched.mappedLab ? { mappedLab: enriched.mappedLab } : {}),
          };
        });
      } else if (enrichedByCode.size > 0) {
        coursesToUse = Array.from(enrichedByCode.values());
      }

      const courseList = await lmsCourseLabService.attach({
        tenantId,
        programmeId: id,
        semester,
        courses: coursesToUse,
      });

      let rawData = semester == null || semester === "" ? result.data : undefined;
      if (rawData && Array.isArray(rawData.courseList)) {
        rawData = {
          ...rawData,
          courseList: rawData.courseList.map((course) => {
            const code = String(course.courseCode || course.code || course.subjectCode || "").trim().toUpperCase();
            const cId = course.courseDetailsId != null ? String(course.courseDetailsId).trim() : null;
            const enriched = (code && enrichedByCode.get(code)) || (cId && enrichedById.get(cId));
            if (!enriched) return course;
            return {
              ...course,
              practicalCredit: enriched.practicalCredit != null && !isNaN(Number(enriched.practicalCredit))
                ? Number(enriched.practicalCredit)
                : course.practicalCredit,
              courseBannerImage: enriched.courseBannerImage || course.courseBannerImage,
              courseDescrpition: enriched.courseDescrpition || enriched.courseDescription || course.courseDescrpition,
            };
          }),
        };
      }

      return {
        success: true,
        lmsStatus: "LIVE",
        isSuccess: result.data?.isSuccess !== false,
        semesterList: filtered.semesterList,
        courseList,
        rawData,
      };
    } catch (err) {
      const lmsStatus = err instanceof LmsApiError ? err.code : "LMS_PROFILE_UNAVAILABLE";
      console.warn(`[LmsCourseService] ${lmsStatus} tenant=${tenantId} programme=${id}: ${err.message}`);
      return { success: true, lmsStatus, semesterList: [], courseList: [] };
    }
  }
}

export const lmsCourseService = new LmsCourseService();
