import { LMS_PROVIDER_CONFIG } from "../../config/lms/lmsProviderConfig.js";
import { lmsApiClient } from "./LmsApiClient.js";
import { LmsApiError } from "./LmsApiError.js";
import { lmsResponseCache } from "./LmsResponseCache.js";
import { endpointUrl, numericLmsId } from "./lmsIds.js";
import { resolveStudentLmsToken } from "./studentLmsToken.js";

class LmsProgrammeService {
  cacheKey(tenantId, provider, studentId) {
    return `lms:programmes:${tenantId}:${provider || LMS_PROVIDER_CONFIG.provider}:${studentId}`;
  }

  async invalidate(tenantId, provider, studentId) {
    const id = numericLmsId(studentId);
    if (!tenantId || id == null) return;
    await lmsResponseCache.invalidate(this.cacheKey(tenantId, provider, id));
  }

  async getPurchased({ tenantId, provider, studentId, bearerToken = null, forceRefresh = false }) {
    const id = numericLmsId(studentId);
    if (!tenantId || id == null) {
      return { success: true, lmsStatus: "LMS_STUDENT_NOT_FOUND", programmeList: [], programList: [], semesterList: [] };
    }

    const url = endpointUrl(LMS_PROVIDER_CONFIG.baseUrl, LMS_PROVIDER_CONFIG.purchasedProgrammesEndpoint);
    const key = this.cacheKey(tenantId, provider, id);

    try {
      const result = await lmsResponseCache.getOrFetch(key, {
        forceRefresh,
        fetcher: () => lmsApiClient.postWithCredentialFallback({
          tenantId,
          url,
          data: { studentId: id },
          bearerToken,
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

  async getPracticalAvailable({ tenantId, provider, bearerToken = null, forceRefresh = false }) {
    const effectiveTenant = tenantId || "PLATFORM";
    const token = bearerToken || resolveStudentLmsToken() || null;

    const url = endpointUrl(LMS_PROVIDER_CONFIG.baseUrl, LMS_PROVIDER_CONFIG.practicalAvailableProgramsEndpoint);
    const key = `lms:practical-programs:${effectiveTenant}:${provider || LMS_PROVIDER_CONFIG.provider}`;

    try {
      const result = await lmsResponseCache.getOrFetch(key, {
        forceRefresh: forceRefresh || Boolean(token),
        fetcher: () => lmsApiClient.post({
          tenantId: effectiveTenant,
          url,
          data: {},
          bearerToken: token,
        }),
      });
      const raw = result.data || {};
      const list = raw.programList || raw.programmeList || (Array.isArray(raw) ? raw : []);
      return {
        success: true,
        lmsStatus: "LIVE",
        isSuccess: raw.isSuccess !== false,
        programList: list,
        programmeList: list,
        rawData: raw,
      };
    } catch (err) {
      const lmsStatus = err instanceof LmsApiError ? err.code : "LMS_PROFILE_UNAVAILABLE";
      console.warn(`[LmsProgrammeService] practical programs ${lmsStatus} tenant=${effectiveTenant}: ${err.message}`);
      return { success: true, lmsStatus, programList: [], programmeList: [] };
    }
  }
}

export const lmsProgrammeService = new LmsProgrammeService();
