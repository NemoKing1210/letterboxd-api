import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/server';
import type { AppContainer } from '../../src/app/container';
import type { Env } from '../../src/app/config/env';
import type { AppLogger } from '../../src/infrastructure/logger';
import { MemoryCache } from '../../src/infrastructure/cache';

function createTestContainer(overrides: Partial<AppContainer> = {}): AppContainer {
  const env: Env = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/letterboxd?schema=public',
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_USER: 'postgres',
    DB_PASSWORD: 'postgres',
    DB_NAME: 'letterboxd',
    DB_SCHEMA: 'public',
    SUPABASE_URL: '',
    SUPABASE_KEY: '',
    HTTP_PROXY: '',
    HTTPS_PROXY: '',
    NO_PROXY: '',
    LETTERBOXD_TIMEOUT: 1000,
    LETTERBOXD_PAGE_DELAY_MS: 0,
    LETTERBOXD_MAX_PAGES: 1,
    LETTERBOXD_ENRICH_CONCURRENCY: 1,
    CACHE_TTL: 60,
    PORT: 3000,
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    RATE_LIMIT_WINDOW_MS: 60_000,
    RATE_LIMIT_MAX: 1000,
    CORS_ORIGIN: '*',
  };

  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  } as unknown as AppLogger;

  return {
    env,
    logger,
    prisma: {} as AppContainer['prisma'],
    cache: new MemoryCache(),
    movieProvider: {} as AppContainer['movieProvider'],
    syncService: {
      syncLetterboxdUser: vi.fn(async () => ({
        syncId: 's1',
        username: 'demo',
        status: 'SUCCESS' as const,
        moviesSynced: 1,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      })),
    } as unknown as AppContainer['syncService'],
    usersService: {
      getProfile: vi.fn(async () => ({
        username: 'demo',
        moviesCount: 3,
        averageRating: 4.2,
        favoriteGenres: [{ name: 'sci-fi', count: 2 }],
        lastSyncedAt: null,
      })),
    } as unknown as AppContainer['usersService'],
    moviesService: {
      listMovies: vi.fn(async () => ({
        items: [],
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 1,
      })),
    } as unknown as AppContainer['moviesService'],
    ratingsService: {
      getRatings: vi.fn(async () => ({
        averageRating: 4.2,
        ratingsCount: 3,
        bestMovies: [],
        worstMovies: [],
        distribution: {},
      })),
    } as unknown as AppContainer['ratingsService'],
    favoritesService: {
      getFavorites: vi.fn(async () => ({
        favoriteMovies: [],
        favoriteDirectors: [],
        favoriteGenres: [],
        favoriteYears: [],
      })),
    } as unknown as AppContainer['favoritesService'],
    statisticsService: {
      getStatistics: vi.fn(async () => ({
        moviesWatched: 3,
        averageRating: 4.2,
        topGenres: [],
        topDirectors: [],
        topDecades: [],
      })),
    } as unknown as AppContainer['statisticsService'],
    recommendationService: {
      recommend: vi.fn(async () => []),
    } as unknown as AppContainer['recommendationService'],
    ...overrides,
  };
}

describe('API integration', () => {
  it('returns health status', async () => {
    const app = createApp(createTestContainer());
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('returns user profile', async () => {
    const app = createApp(createTestContainer());
    const res = await app.request('/api/users/demo');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { username: string; moviesCount: number };
    expect(body.username).toBe('demo');
    expect(body.moviesCount).toBe(3);
  });

  it('returns openapi document', async () => {
    const app = createApp(createTestContainer());
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { openapi: string; info: { title: string } };
    expect(body.openapi).toBe('3.1.0');
    expect(body.info.title).toContain('Letterboxd');
  });

  it('rejects invalid username', async () => {
    const app = createApp(createTestContainer());
    const res = await app.request('/api/users/bad%20name');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
