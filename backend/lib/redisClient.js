import { createClient } from "redis";
import { ENV } from "../config/env.js";

let client = null;
let connecting = null;
let unavailableUntil = 0;
const REDIS_COOLDOWN_MS = 60000;

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
  if (Date.now() < unavailableUntil) return null;

  connecting = (async () => {
    const next = createClient({
      url: redisUrl(),
      socket: {
        connectTimeout: 400,
        reconnectStrategy: false,
      },
    });
    next.on("error", (err) => {
      console.warn("[Redis]", err.message);
    });
    try {
      await next.connect();
      client = next;
      unavailableUntil = 0;
      console.log("[Redis] Connected for LMS cache");
      return next;
    } catch (err) {
      unavailableUntil = Date.now() + REDIS_COOLDOWN_MS;
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
