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
        fetcher: () => lmsApiClient.post({
          tenantId,
          url,
          data: { programmeId: id },
        }),
      });
      const filtered = filterSemesterPayload(result.data || {}, semester);
      const courseList = await lmsCourseLabService.attach({
        tenantId,
        programmeId: id,
        semester,
        courses: filtered.courseList,
      });
      return {
        success: true,
        lmsStatus: "LIVE",
        isSuccess: result.data?.isSuccess !== false,
        semesterList: filtered.semesterList,
        courseList,
        rawData: semester == null || semester === "" ? result.data : undefined,
      };
    } catch (err) {
      const lmsStatus = err instanceof LmsApiError ? err.code : "LMS_PROFILE_UNAVAILABLE";
      console.warn(`[LmsCourseService] ${lmsStatus} tenant=${tenantId} programme=${id}: ${err.message}`);
      return { success: true, lmsStatus, semesterList: [], courseList: [] };
    }
  }
}

export const lmsCourseService = new LmsCourseService();
