/**
 * Abstract Cache Provider
 */
export class ICacheProvider {
  async get(key) { throw new Error("Not implemented"); }
  async set(key, value, ttlSeconds) { throw new Error("Not implemented"); }
  async del(key) { throw new Error("Not implemented"); }
  async clear() { throw new Error("Not implemented"); }
}

/**
 * Basic In-Memory Cache Provider
 */
export class MemoryCacheProvider extends ICacheProvider {
  constructor() {
    super();
    this.cache = new Map();
  }

  async get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key, value, ttlSeconds = 300) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  async del(key) {
    this.cache.delete(key);
  }

  async clear() {
    this.cache.clear();
  }
}

// Export a singleton instance. This can later be swapped for RedisCacheProvider.
export const cacheProvider = new MemoryCacheProvider();
