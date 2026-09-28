import { LMS_PROVIDER_CONFIG } from "../../config/lms/lmsProviderConfig.js";
import { lmsApiClient } from "./LmsApiClient.js";
import { LmsApiError } from "./LmsApiError.js";
import { lmsAttendanceService } from "./LmsAttendanceService.js";
import { lmsResultService } from "./LmsResultService.js";
import { lmsResponseCache } from "./LmsResponseCache.js";
import { endpointUrl, numericLmsId } from "./lmsIds.js";
import { normalizeProgramme } from "./programmeNormalize.js";

const PROGRESS_FIELDS = [
  "gpa",
  "cgpa",
  "attendance",
  "attendancePercentage",
  "marks",
  "grades",
  "credits",
  "completionPercentage",
  "overallProgress",
  "results",
  "subjects",
  "currentCourses",
];

function pickProgress(source, into = {}) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return into;
  for (const field of PROGRESS_FIELDS) {
    if (source[field] != null && source[field] !== "") into[field] = source[field];
  }
  if (source.academicProgress && typeof source.academicProgress === "object") {
    pickProgress(source.academicProgress, into);
  }
  return into;
}

class LmsAcademicProgressService {
  async getProgress({ tenantId, provider, admissionId, studentId, profile, programmes }) {
    const id = numericLmsId(admissionId) ?? numericLmsId(studentId);
    const academicProgress = pickProgress(profile);
    const normalizedProgrammes = (programmes || [])
      .map((item) => normalizeProgramme(item))
      .filter((item) => item && item.programmeName);

    if (!tenantId || id == null) {
      return {
        success: true,
        progressStatus: "LMS_STUDENT_NOT_FOUND",
        programmes: normalizedProgrammes,
        academicProgress,
      };
    }

    const endpoint = LMS_PROVIDER_CONFIG.academicProgressEndpoint;
    if (endpoint) {
      const key = `lms:academic:${tenantId}:${provider || LMS_PROVIDER_CONFIG.provider}:${id}`;
      try {
        const result = await lmsResponseCache.getOrFetch(key, {
          fetcher: () => lmsApiClient.post({
            tenantId,
            url: endpointUrl(LMS_PROVIDER_CONFIG.baseUrl, endpoint),
            data: { studentDegreeAdmissionId: id, studentId: numericLmsId(studentId) || id },
          }),
        });
        pickProgress(result.data, academicProgress);
      } catch (err) {
        const progressStatus = err instanceof LmsApiError ? err.code : "LMS_PROFILE_UNAVAILABLE";
        return {
          success: true,
          progressStatus,
          programmes: normalizedProgrammes,
          academicProgress,
        };
      }
    }

    const [attendance, results] = await Promise.all([
      lmsAttendanceService.getAttendance({ tenantId, provider, admissionId: id }),
      lmsResultService.getResults({ tenantId, provider, admissionId: id }),
    ]);
    if (attendance.status === "LIVE") pickProgress(attendance.attendance, academicProgress);
    if (results.status === "LIVE") pickProgress(results.results, academicProgress);

    return {
      success: true,
      progressStatus: profile ? "LIVE" : "LMS_PROFILE_UNAVAILABLE",
      programmes: normalizedProgrammes,
      academicProgress,
      attendanceStatus: attendance.status,
      resultsStatus: results.status,
    };
  }
}

export const lmsAcademicProgressService = new LmsAcademicProgressService();
