import { ENV } from "../../config/env.js";
import { LMS_PROVIDER_CONFIG } from "../../config/lms/lmsProviderConfig.js";
import { lmsApiClient } from "./LmsApiClient.js";
import { LmsApiError } from "./LmsApiError.js";
import { lmsResponseCache } from "./LmsResponseCache.js";
import { endpointUrl, numericLmsId } from "./lmsIds.js";

function profileUrl() {
  return endpointUrl(
    LMS_PROVIDER_CONFIG.baseUrl,
    LMS_PROVIDER_CONFIG.studentProfileEndpoint || ENV.studentProfileApiUrl
  );
}

function isLiveProfile(raw) {
  return Boolean(raw && typeof raw === "object" && raw.isSuccess !== false);
}

class LmsStudentProfileService {
  cacheKey(tenantId, provider, externalStudentId) {
    const tenant = String(tenantId || "").trim();
    const lms = String(provider || LMS_PROVIDER_CONFIG.provider).trim();
    const student = String(externalStudentId || "").trim();
    return `lms:profile:${tenant}:${lms}:${student}`;
  }

  async getProfile({
    tenantId,
    provider,
    externalStudentId,
    admissionId,
    studentId = null,
    token = null,
    forceRefresh = false,
  }) {
    const student = numericLmsId(studentId);
    const admission = numericLmsId(admissionId) ?? (student == null ? numericLmsId(externalStudentId) : null);
    const cacheIdentity = student ?? admission;
    if (!tenantId || cacheIdentity == null || (admission == null && student == null)) {
      return { data: null, source: "NONE", profileStatus: "LMS_STUDENT_NOT_FOUND" };
    }

    const key = this.cacheKey(tenantId, provider, cacheIdentity);
    try {
      const result = await lmsResponseCache.getOrFetch(key, {
        forceRefresh,
        fetcher: async () => {
          const url = profileUrl();
          const body = {};
          if (admission != null) body.studentDegreeAdmissionId = admission;
          if (student != null) body.studentId = student;
          const raw = await lmsApiClient.postWithCredentialFallback({
            tenantId,
            url,
            data: body,
            bearerToken: token,
          });
          if (!isLiveProfile(raw)) {
            throw new LmsApiError("LMS_STUDENT_NOT_FOUND", "LMS profile response was empty");
          }
          return raw;
        },
      });
      return { ...result, profileStatus: "LIVE" };
    } catch (err) {
      const profileStatus = err instanceof LmsApiError ? err.code : "LMS_PROFILE_UNAVAILABLE";
      console.warn(`[LmsStudentProfile] ${profileStatus} tenant=${tenantId} student=${cacheIdentity}: ${err.message}`);
      return { data: null, source: profileStatus, profileStatus };
    }
  }
}

export const lmsStudentProfileService = new LmsStudentProfileService();
