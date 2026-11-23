import { ENV } from "../../config/env.js";
import { getRedis } from "../../lib/redisClient.js";

const memory = new Map();
const inFlight = new Map();

class LmsResponseCache {
  async read(key) {
    const redis = await getRedis();
    if (redis) {
      try {
        const raw = await redis.get(key);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch (err) {
        console.warn("[LmsResponseCache] Redis read failed:", err.message);
      }
    }

    const entry = memory.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.data;
    return null;
  }

  async write(key, data, ttlSeconds) {
    if (data == null) return;
    const ttl = ttlSeconds || ENV.redisTtlSeconds || 600;
    const redis = await getRedis();
    if (redis) {
      try {
        await redis.set(key, JSON.stringify(data), { EX: ttl });
      } catch (err) {
        console.warn("[LmsResponseCache] Redis write failed:", err.message);
      }
    }
    memory.set(key, { data, expiresAt: Date.now() + ttl * 1000 });
  }

  async invalidate(key) {
    memory.delete(key);
    const redis = await getRedis();
    if (redis) {
      try {
        await redis.del(key);
      } catch (err) {
        console.warn("[LmsResponseCache] Redis delete failed:", err.message);
      }
    }
  }

  async invalidatePrefix(prefix) {
    const needle = String(prefix || "");
    if (!needle) return;
    for (const key of memory.keys()) {
      if (String(key).startsWith(needle)) memory.delete(key);
    }
    const redis = await getRedis();
    if (!redis) return;
    try {
      const matched = [];
      for await (const key of redis.scanIterator({ MATCH: `${needle}*`, COUNT: 100 })) {
        matched.push(key);
      }
      if (matched.length) await redis.del(matched);
    } catch (err) {
      console.warn("[LmsResponseCache] Redis prefix delete failed:", err.message);
    }
  }

  /**
   * Cache hit returns cached LMS payload. Miss calls fetcher once per key (single-flight).
   */
  async getOrFetch(key, { forceRefresh = false, ttlSeconds, fetcher }) {
    // Read first even on a forced refresh: the current copy is the fallback if the LMS fails.
    const cached = await this.read(key);
    if (cached && !forceRefresh) {
      return { data: cached, source: "REDIS_CACHE", profileStatus: "LIVE" };
    }

    if (inFlight.has(key)) {
      return inFlight.get(key);
    }

    const promise = (async () => {
      let data;
      try {
        data = await fetcher();
      } catch (err) {
        // A forced refresh that fails keeps (and returns) the still-valid cached copy instead of
        // wiping it; nothing is fabricated and nothing is overwritten with an empty value.
        if (cached) {
          console.warn(`[LmsResponseCache] refresh failed for ${key}, keeping cached copy: ${err.message}`);
          return { data: cached, source: "CACHE_FALLBACK", profileStatus: "LIVE", refreshError: err.code || "LMS_UNAVAILABLE" };
        }
        throw err;
      }
      await this.write(key, data, ttlSeconds);
      return { data, source: "LMS_API", profileStatus: "LIVE" };
    })();

    inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      inFlight.delete(key);
    }
  }
}

export const lmsResponseCache = new LmsResponseCache();
