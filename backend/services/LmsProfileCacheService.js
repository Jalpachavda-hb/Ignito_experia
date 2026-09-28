import { lmsStudentProfileService } from "./lms/LmsStudentProfileService.js";

/**
 * Compatibility wrapper. Profile reads go through LmsStudentProfileService,
 * LmsApiClient, and the shared Redis/memory cache.
 */
class LmsProfileCacheService {
  getCacheKey(tenantId, provider, externalStudentId) {
    return lmsStudentProfileService.cacheKey(tenantId, provider, externalStudentId);
  }

  async getOrFetchProfile(args) {
    return lmsStudentProfileService.getProfile(args);
  }

  async invalidateProfile(tenantId, provider, externalStudentId) {
    const { lmsResponseCache } = await import("./lms/LmsResponseCache.js");
    await lmsResponseCache.invalidate(this.getCacheKey(tenantId, provider, externalStudentId));
  }
}

export const lmsProfileCacheService = new LmsProfileCacheService();
export default lmsProfileCacheService;
