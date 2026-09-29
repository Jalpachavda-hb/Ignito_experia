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
    if (!forceRefresh) {
      const cached = await this.read(key);
      if (cached) {
        console.log(`[LmsResponseCache] HIT ${key}`);
        return { data: cached, source: "REDIS_CACHE", profileStatus: "LIVE" };
      }
    } else {
      await this.invalidate(key);
    }

    if (inFlight.has(key)) {
      console.log(`[LmsResponseCache] Single-flight join ${key}`);
      return inFlight.get(key);
    }

    const promise = (async () => {
      const data = await fetcher();
      await this.write(key, data, ttlSeconds);
      console.log(`[LmsResponseCache] SET ${key}`);
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
