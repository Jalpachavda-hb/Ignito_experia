import { LMS_PROVIDER_CONFIG } from "../../config/lms/lmsProviderConfig.js";
import { lmsApiClient } from "./LmsApiClient.js";
import { LmsApiError } from "./LmsApiError.js";
import { lmsResponseCache } from "./LmsResponseCache.js";
import { endpointUrl, numericLmsId } from "./lmsIds.js";

class LmsResultService {
  async getResults({ tenantId, provider, admissionId }) {
    const endpoint = LMS_PROVIDER_CONFIG.resultsEndpoint;
    const id = numericLmsId(admissionId);
    if (!endpoint) return { status: "LMS_PROVIDER_CONFIGURATION_MISSING", results: null };
    if (!tenantId || id == null) return { status: "LMS_STUDENT_NOT_FOUND", results: null };

    const key = `lms:results:${tenantId}:${provider || LMS_PROVIDER_CONFIG.provider}:${id}`;
    try {
      const result = await lmsResponseCache.getOrFetch(key, {
        fetcher: () => lmsApiClient.post({
          tenantId,
          url: endpointUrl(LMS_PROVIDER_CONFIG.baseUrl, endpoint),
          data: { studentDegreeAdmissionId: id },
        }),
      });
      return { status: "LIVE", results: result.data };
    } catch (err) {
      const status = err instanceof LmsApiError ? err.code : "LMS_PROFILE_UNAVAILABLE";
      return { status, results: null };
    }
  }
}

export const lmsResultService = new LmsResultService();
