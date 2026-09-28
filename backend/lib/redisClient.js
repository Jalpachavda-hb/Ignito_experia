import { createClient } from "redis";
import { ENV } from "../config/env.js";

let client = null;
let connecting = null;

function redisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const auth = ENV.redisPassword ? `:${encodeURIComponent(ENV.redisPassword)}@` : "";
  return `redis://${auth}${ENV.redisHost}:${ENV.redisPort}`;
}

/**
 * Lazy Redis connection. Returns null when Redis is down so callers keep an in-memory fallback.
 * LMS data is never treated as permanently stored here.
 */
export async function getRedis() {
  if (client?.isOpen) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    const next = createClient({
      url: redisUrl(),
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: false,
      },
    });
    next.on("error", (err) => {
      console.warn("[Redis]", err.message);
    });
    try {
      await next.connect();
      client = next;
      console.log("[Redis] Connected for LMS cache");
      return next;
    } catch (err) {
      console.warn("[Redis] Unavailable, LMS cache will use process memory:", err.message);
      try {
        await next.disconnect();
      } catch {
        // ignore
      }
      client = null;
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}
