import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryCache } from './memory-cache';

describe('MemoryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values', async () => {
    const cache = new MemoryCache();
    await cache.set('a', { n: 1 });
    expect(await cache.get<{ n: number }>('a')).toEqual({ n: 1 });
  });

  it('expires values by TTL', async () => {
    const cache = new MemoryCache();
    await cache.set('a', 'value', 1);
    expect(await cache.get('a')).toBe('value');

    await vi.advanceTimersByTimeAsync(1100);
    expect(await cache.get('a')).toBeNull();
  });

  it('deletes by prefix', async () => {
    const cache = new MemoryCache();
    await cache.set('user:profile:x', 1);
    await cache.set('user:stats:x', 2);
    await cache.set('other', 3);

    await cache.deleteByPrefix('user:');
    expect(await cache.get('user:profile:x')).toBeNull();
    expect(await cache.get('other')).toBe(3);
  });
});
