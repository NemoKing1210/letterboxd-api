import type { CacheProvider } from './cache-provider';

type CacheEntry = {
  value: unknown;
  expiresAt: number | null;
};

export class MemoryCache implements CacheProvider {
  private readonly store = new Map<string, CacheEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

/**
 * Placeholder for future Redis / Upstash / Vercel KV implementations.
 * Keep the CacheProvider interface stable so swapping is a composition-root change.
 */
export class RedisCacheStub implements CacheProvider {
  async get<T>(_key: string): Promise<T | null> {
    throw new Error('RedisCache is not implemented yet. Use MemoryCache or implement RedisCache.');
  }

  async set<T>(_key: string, _value: T, _ttlSeconds?: number): Promise<void> {
    throw new Error('RedisCache is not implemented yet. Use MemoryCache or implement RedisCache.');
  }

  async delete(_key: string): Promise<void> {
    throw new Error('RedisCache is not implemented yet. Use MemoryCache or implement RedisCache.');
  }

  async deleteByPrefix(_prefix: string): Promise<void> {
    throw new Error('RedisCache is not implemented yet. Use MemoryCache or implement RedisCache.');
  }

  async clear(): Promise<void> {
    throw new Error('RedisCache is not implemented yet. Use MemoryCache or implement RedisCache.');
  }
}
