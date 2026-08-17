import { ENV } from "../config/env.js";
import { lmsApiClient } from "./lms/LmsApiClient.js";
import { LMS_PROVIDER_CONFIG } from "../config/lms/lmsProviderConfig.js";

// In-Memory Fallback Cache for LMS profiles (with fresh TTL + stale retention)
const inMemoryCache = new Map();

// Token store to reuse valid LMS Bearer tokens for profile refreshes
const tokenStore = new Map();

// Single-flight in-flight lock map to prevent thundering herd / cache stampede
const inFlightRequests = new Map();

class LmsProfileCacheService {
  /**
   * Format tenant-isolated Redis cache key: lms:profile:{TenantId}:{Provider}:{ExternalStudentId}
   */
  getCacheKey(tenantId, provider, externalStudentId) {
    const safeTenant = (tenantId || 'TEN000001').trim();
    const safeProvider = (provider || 'GTU_LMS').trim();
    const safeExtId = String(externalStudentId || 'unknown').trim();
    return `lms:profile:${safeTenant}:${safeProvider}:${safeExtId}`;
  }

  /**
   * Retrieve cached LMS student profile (checks fresh TTL first)
   */
  async getProfile(tenantId, provider, externalStudentId) {
    const cacheKey = this.getCacheKey(tenantId, provider, externalStudentId);

    const entry = inMemoryCache.get(cacheKey);
    if (entry && entry.data) {
      if (entry.expiresAt > Date.now()) {
        console.log(`[LmsProfileCache] Cache HIT (Fresh) for key: ${cacheKey}`);
        return entry.data;
      }
    }

    console.log(`[LmsProfileCache] Cache MISS / EXPIRED for key: ${cacheKey}`);
    return null;
  }

  /**
   * Retrieve stale LMS profile fallback (if LMS API is temporarily down)
   */
  async getStaleProfile(tenantId, provider, externalStudentId) {
    const cacheKey = this.getCacheKey(tenantId, provider, externalStudentId);
    const entry = inMemoryCache.get(cacheKey);
    if (entry && entry.data) {
      console.log(`[LmsProfileCache] Returning STALE fallback profile for key: ${cacheKey}`);
      return entry.data;
    }
    return null;
  }

  /**
   * Store LMS student profile in cache with TTL (10 mins fresh, 24 hour stale retention)
   */
  async setProfile(tenantId, provider, externalStudentId, profileData, customTtlSeconds, token = null) {
    if (!profileData) return;

    const cacheKey = this.getCacheKey(tenantId, provider, externalStudentId);
    const ttlSeconds = customTtlSeconds || ENV.redisTtlSeconds || 600;
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    const staleExpiresAt = Date.now() + (86400 * 1000); // 24 hour retention fallback

    inMemoryCache.set(cacheKey, {
      data: profileData,
      expiresAt,
      staleExpiresAt,
      cachedAt: new Date().toISOString()
    });

    if (token) {
      tokenStore.set(cacheKey, token);
    }

    console.log(`[LmsProfileCache] Cache SET for key: ${cacheKey} (Fresh TTL: ${ttlSeconds}s)`);
  }

  /**
   * Invalidate cached LMS student profile (for explicit user refresh)
   */
  async invalidateProfile(tenantId, provider, externalStudentId) {
    const cacheKey = this.getCacheKey(tenantId, provider, externalStudentId);
    inMemoryCache.delete(cacheKey);
    console.log(`[LmsProfileCache] Cache INVALIDATED for key: ${cacheKey}`);
  }

  /**
   * Unified Method with Single-Flight Stampede Protection & Stale Fallback
   */
  async getOrFetchProfile({ tenantId, provider, externalStudentId, token = null, forceRefresh = false }) {
    if (!externalStudentId) {
      return null;
    }

    const cacheKey = this.getCacheKey(tenantId, provider, externalStudentId);

    // Save token if provided
    if (token) {
      tokenStore.set(cacheKey, token);
    }

    // 1. Check Fresh Cache first
    if (!forceRefresh) {
      const cached = await this.getProfile(tenantId, provider, externalStudentId);
      if (cached) {
        return { data: cached, source: 'REDIS_CACHE' };
      }
    } else {
      await this.invalidateProfile(tenantId, provider, externalStudentId);
    }

    // 2. Single-flight lock: if another request is already fetching this exact key, await its promise
    if (inFlightRequests.has(cacheKey)) {
      console.log(`[LmsProfileCache] Single-flight JOIN for in-flight key: ${cacheKey}`);
      try {
        const result = await inFlightRequests.get(cacheKey);
        return result;
      } catch (err) {
        // Fallthrough
      }
    }

    // Resolve active token (from parameter or tokenStore)
    const activeToken = token || tokenStore.get(cacheKey) || null;

    // 3. Initiate single-flight fetch
    const fetchPromise = (async () => {
      try {
        if (activeToken) {
          // SSO Path: Use student's LMS token
          const apiUrl = ENV.studentProfileApiUrl || "https://verse.ignitolearn.com/api/StudentAPI/GetStudentProfile";
          console.log(`[LMS_PROFILE] Redis MISS for tenantId=${tenantId}, admissionId=${externalStudentId}`);
          console.log(`[LMS_API] Calling LMS SSO API (${apiUrl}) for admissionId=${externalStudentId}...`);

          const headers = {
            "Accept": "text/plain",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${activeToken}`
          };

          const res = await fetch(apiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ studentDegreeAdmissionId: Number(externalStudentId) })
          });

          if (res.ok) {
            const rawData = await res.json();
            if (rawData && (rawData.isSuccess !== false && (rawData.applicantFullName || rawData.studentDegreeAdmissionId || rawData.email))) {
              console.log(`[LMS_API] Status=200 OK`);
              await this.setProfile(tenantId, provider, externalStudentId, rawData, null, activeToken);
              console.log(`[LMS_PROFILE] Profile cached in Redis for admissionId=${externalStudentId}`);
              return { data: rawData, source: 'LMS_SSO_API' };
            }
          } else {
            const errText = await res.text().catch(() => '');
            console.error(`[LMS_API] Status=${res.status} HTTP Error: ${errText}`);
          }
        } else {
          // Direct Experia Login Path: Use Auth0 M2M Token Service via LmsApiClient
          const m2mTargetUrl = `${LMS_PROVIDER_CONFIG.baseUrl}${LMS_PROVIDER_CONFIG.studentProfileEndpoint}`;
          console.log(`[LMS_PROFILE] Redis MISS for tenantId=${tenantId}, admissionId=${externalStudentId}`);
          console.log(`[LMS_API] Requesting M2M token & calling GetStudentProfile (${m2mTargetUrl}) for admissionId=${externalStudentId}...`);

          const rawData = await lmsApiClient.post({
            tenantId,
            url: m2mTargetUrl,
            data: { studentDegreeAdmissionId: Number(externalStudentId) },
          });

          if (rawData && (rawData.isSuccess !== false && (rawData.applicantFullName || rawData.studentDegreeAdmissionId || rawData.email))) {
            console.log(`[LMS_API] Status=200 OK`);
            await this.setProfile(tenantId, provider, externalStudentId, rawData, null, null);
            console.log(`[LMS_PROFILE] Profile cached in Redis for admissionId=${externalStudentId}`);
            return { data: rawData, source: 'LMS_M2M_API' };
          }
        }
      } catch (err) {
        console.error("[LMS_API] Error fetching external LMS profile:", err.message);
      }

      // 4. Stale Fallback if LMS API failed or token missing
      const staleData = await this.getStaleProfile(tenantId, provider, externalStudentId);
      if (staleData) {
        console.log(`[LMS_PROFILE] Serving STALE cached profile for admissionId=${externalStudentId}`);
        return { data: staleData, source: 'STALE_CACHE', isStale: true };
      }

      console.warn(`[LMS_PROFILE] Profile UNAVAILABLE for admissionId=${externalStudentId}`);
      return { data: null, source: 'LMS_PROFILE_UNAVAILABLE', profileStatus: 'LMS_PROFILE_UNAVAILABLE' };
    })();

    inFlightRequests.set(cacheKey, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  }
}

export const lmsProfileCacheService = new LmsProfileCacheService();
export default lmsProfileCacheService;
