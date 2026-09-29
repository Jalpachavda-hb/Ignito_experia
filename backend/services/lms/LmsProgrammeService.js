import { LMS_PROVIDER_CONFIG } from "../../config/lms/lmsProviderConfig.js";
import { lmsApiClient } from "./LmsApiClient.js";
import { LmsApiError } from "./LmsApiError.js";
import { lmsResponseCache } from "./LmsResponseCache.js";
import { endpointUrl, numericLmsId } from "./lmsIds.js";

class LmsProgrammeService {
  cacheKey(tenantId, provider, studentId) {
    return `lms:programmes:${tenantId}:${provider || LMS_PROVIDER_CONFIG.provider}:${studentId}`;
  }

  async invalidate(tenantId, provider, studentId) {
    const id = numericLmsId(studentId);
    if (!tenantId || id == null) return;
    await lmsResponseCache.invalidate(this.cacheKey(tenantId, provider, id));
  }

  async getPurchased({ tenantId, provider, studentId, forceRefresh = false }) {
    const id = numericLmsId(studentId);
    if (!tenantId || id == null) {
      return { success: true, lmsStatus: "LMS_STUDENT_NOT_FOUND", programmeList: [], programList: [], semesterList: [] };
    }

    const url = endpointUrl(LMS_PROVIDER_CONFIG.baseUrl, LMS_PROVIDER_CONFIG.purchasedProgrammesEndpoint);
    const key = this.cacheKey(tenantId, provider, id);

    try {
      const result = await lmsResponseCache.getOrFetch(key, {
        forceRefresh,
        fetcher: () => lmsApiClient.post({
          tenantId,
          url,
          data: { studentId: id },
        }),
      });
      const raw = result.data || {};
      const list = raw.programmeList || raw.programList || (Array.isArray(raw) ? raw : []);
      return {
        success: true,
        lmsStatus: "LIVE",
        isSuccess: raw.isSuccess !== false,
        programmeList: list,
        programList: list,
        semesterList: raw.semesterList || [],
        rawData: raw,
      };
    } catch (err) {
      const lmsStatus = err instanceof LmsApiError ? err.code : "LMS_PROFILE_UNAVAILABLE";
      console.warn(`[LmsProgrammeService] ${lmsStatus} tenant=${tenantId} student=${id}: ${err.message}`);
      return {
        success: true,
        lmsStatus,
        programmeList: [],
        programList: [],
        semesterList: [],
      };
    }
  }
}

export const lmsProgrammeService = new LmsProgrammeService();
