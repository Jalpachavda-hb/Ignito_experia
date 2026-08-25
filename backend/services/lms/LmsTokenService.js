import axios from "axios";

import {
  LMS_PROVIDER_CONFIG,
} from "../../config/lms/lmsProviderConfig.js";

import {
  lmsSecretProvider,
} from "./LmsSecretProvider.js";

class LmsTokenService {
  constructor() {
    this.redis = null;
    this.tokenMemoryCache = new Map();
    this.inFlight = new Map();
  }

  setRedis(redis) {
    this.redis = redis;
  }

  getCacheKey(tenantId) {
    const safeTenant = (tenantId || 'TEN000001').trim();
    return `lms:token:${safeTenant}:${LMS_PROVIDER_CONFIG.provider}`;
  }

  async getAccessToken(tenantId) {
    const cacheKey =
      this.getCacheKey(tenantId);

    // Redis HIT
    if (this.redis) {
      try {
        const cached =
          await this.redis.get(cacheKey);

        if (cached) {
          return cached;
        }
      } catch (err) {
        console.warn("[LmsTokenService] Redis get failed, using memory cache:", err.message);
      }
    }

    // In-memory HIT fallback
    const mem = this.tokenMemoryCache.get(cacheKey);
    if (mem && mem.expiresAt > Date.now()) {
      return mem.accessToken;
    }

    // Single-flight
    if (this.inFlight.has(cacheKey)) {
      return this.inFlight.get(cacheKey);
    }

    const promise =
      this.requestNewToken(
        tenantId,
        cacheKey
      );

    this.inFlight.set(
      cacheKey,
      promise
    );

    try {
      return await promise;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  async requestNewToken(
    tenantId,
    cacheKey
  ) {
    const secret =
      await lmsSecretProvider.getClientSecret();
    console.log(`[LmsTokenService] Requesting Auth0 M2M Token for tenant: ${tenantId}...`);

    const response =
      await axios.post(
        LMS_PROVIDER_CONFIG
          .tokenEndpoint,
        {
          client_id:
            process.env.LMS_M2M_CLIENT_ID || "",

          client_secret:
            secret,

          audience:
            LMS_PROVIDER_CONFIG.audience,

          grant_type:
            LMS_PROVIDER_CONFIG.grantType,

          ...(LMS_PROVIDER_CONFIG.scope
            ? {
                scope:
                  LMS_PROVIDER_CONFIG.scope,
              }
            : {}),
        },
        {
          timeout: 10000,

          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );

    const accessToken =
      response.data?.access_token;

    const expiresIn =
      Number(
        response.data?.expires_in || 86400
      );

    if (!accessToken) {
      throw new Error(
        "LMS_M2M_TOKEN_NOT_RECEIVED"
      );
    }

    const ttl =
      Math.max(
        expiresIn - 300,
        60
      );

    if (this.redis) {
      try {
        await this.redis.set(
          cacheKey,
          accessToken,
          {
            EX: ttl,
          }
        );
      } catch (err) {
        console.warn("[LmsTokenService] Redis set failed:", err.message);
      }
    }

    this.tokenMemoryCache.set(cacheKey, {
      accessToken,
      expiresAt: Date.now() + (ttl * 1000),
    });

    console.log(`[LmsTokenService] Successfully retrieved M2M token (TTL: ${ttl}s)`);
    return accessToken;
  }

  async invalidateToken(tenantId) {
    const cacheKey = this.getCacheKey(tenantId);
    this.tokenMemoryCache.delete(cacheKey);

    if (this.redis) {
      try {
        await this.redis.del(cacheKey);
      } catch (err) {
        // ignore
      }
    }

    console.log(`[LmsTokenService] Invalidated M2M token for key: ${cacheKey}`);
  }
}

export const lmsTokenService =
  new LmsTokenService();
