import { LMS_PROVIDER_CONFIG } from "../../config/lms/lmsProviderConfig.js";
import { lmsApiClient } from "./LmsApiClient.js";
import { LmsApiError } from "./LmsApiError.js";
import { lmsResponseCache } from "./LmsResponseCache.js";
import { endpointUrl, numericLmsId } from "./lmsIds.js";

class LmsAttendanceService {
  async getAttendance({ tenantId, provider, admissionId }) {
    const endpoint = LMS_PROVIDER_CONFIG.attendanceEndpoint;
    const id = numericLmsId(admissionId);
    if (!endpoint) return { status: "LMS_PROVIDER_CONFIGURATION_MISSING", attendance: null };
    if (!tenantId || id == null) return { status: "LMS_STUDENT_NOT_FOUND", attendance: null };

    const key = `lms:attendance:${tenantId}:${provider || LMS_PROVIDER_CONFIG.provider}:${id}`;
    try {
      const result = await lmsResponseCache.getOrFetch(key, {
        fetcher: () => lmsApiClient.post({
          tenantId,
          url: endpointUrl(LMS_PROVIDER_CONFIG.baseUrl, endpoint),
          data: { studentDegreeAdmissionId: id },
        }),
      });
      return { status: "LIVE", attendance: result.data };
    } catch (err) {
      const status = err instanceof LmsApiError ? err.code : "LMS_PROFILE_UNAVAILABLE";
      return { status, attendance: null };
    }
  }
}

export const lmsAttendanceService = new LmsAttendanceService();
