import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/server';
import type { AppContainer } from '../../src/app/container';
import type { Env } from '../../src/app/config/env';
import { createAuthenticator } from '../../src/app/auth';
import type { AppLogger } from '../../src/infrastructure/logger';
import { MemoryCache } from '../../src/infrastructure/cache';

function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
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
    LETTERBOXD_ENRICH_RETRIES: 1,
    CACHE_TTL: 60,
    USER_SYNC_TTL_SECONDS: 43_200,
    PORT: 3000,
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    RATE_LIMIT_WINDOW_MS: 60_000,
    RATE_LIMIT_MAX: 1000,
    CORS_ORIGIN: '*',
    AUTH_ENABLED: false,
    AUTH_METHODS: ['api_key', 'bearer'],
    AUTH_TOKENS: [],
    AUTH_BASIC_USERNAME: '',
    AUTH_BASIC_PASSWORD: '',
    AUTH_PUBLIC_PATHS: ['/health', '/privacy', '/openapi-gpt-actions.yaml'],
    OPENAI_API_KEY: '',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
    OPENAI_CHAT_MODEL: 'gpt-4o-mini',
    OPENAI_TIMEOUT_MS: 30_000,
    OPENAI_MAX_RETRIES: 3,
    RECOMMENDATION_ENGINE: 'rules',
    AI_RECOMMEND_CANDIDATE_POOL: 20,
    AI_EMBED_BUDGET: 48,
    AI_EMBED_BATCH_SIZE: 16,
    AI_RECOMMEND_USE_LLM: true,
    ...overrides,
  };
}

function createTestContainer(overrides: Partial<AppContainer> = {}): AppContainer {
  const env = overrides.env ?? createTestEnv();

  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  } as unknown as AppLogger;

  const base: AppContainer = {
    env,
    logger,
    prisma: {} as AppContainer['prisma'],
    cache: new MemoryCache(),
    authenticator: createAuthenticator(env),
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
      listUsers: vi.fn(async () => ({
        items: [
          {
            username: 'demo',
            url: 'https://letterboxd.com/demo/',
            moviesCount: 3,
            averageRating: 4.2,
            favoriteGenres: [{ name: 'sci-fi', count: 2 }],
            lastSyncedAt: null,
            followingCount: 1,
            followersCount: 2,
            externalLinks: [],
            favoriteFilms: [],
            recentLikes: [],
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      })),
      getProfile: vi.fn(async () => ({
        username: 'demo',
        url: 'https://letterboxd.com/demo/',
        moviesCount: 3,
        averageRating: 4.2,
        favoriteGenres: [{ name: 'sci-fi', count: 2 }],
        lastSyncedAt: null,
        followingCount: 1,
        followersCount: 2,
        externalLinks: [],
        favoriteFilms: [],
        recentLikes: [],
      })),
    } as unknown as AppContainer['usersService'],
    moviesService: {
      listMovies: vi.fn(async () => ({
        items: [],
        page: 1,
        limit: 20,
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
      listFavoriteMovies: vi.fn(async () => ({
        items: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
      })),
      listFavoriteFacet: vi.fn(async () => ({
        items: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
      })),
    } as unknown as AppContainer['favoritesService'],
    searchService: {
      search: vi.fn(async () => ({
        items: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
      })),
    } as unknown as AppContainer['searchService'],
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
  };

  return {
    ...base,
    ...overrides,
    env: overrides.env ?? base.env,
    authenticator: overrides.authenticator ?? createAuthenticator(overrides.env ?? base.env),
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

  it('lists synced users', async () => {
    const container = createTestContainer();
    const app = createApp(container);
    const res = await app.request('/api/users?sort=movies_desc&page=1&limit=20');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ username: string }>;
      total: number;
      page: number;
    };
    expect(body.items[0]?.username).toBe('demo');
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(container.usersService.listUsers).toHaveBeenCalled();
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

  it('lists favorite movies and facets', async () => {
    const container = createTestContainer();
    const app = createApp(container);

    const moviesRes = await app.request('/api/users/demo/favorites');
    expect(moviesRes.status).toBe(200);
    expect(container.favoritesService.listFavoriteMovies).toHaveBeenCalled();

    const directorsRes = await app.request('/api/users/demo/favorites/directors');
    expect(directorsRes.status).toBe(200);
    expect(container.favoritesService.listFavoriteFacet).toHaveBeenCalledWith(
      'demo',
      'directors',
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it('runs advanced search', async () => {
    const container = createTestContainer();
    const app = createApp(container);

    const res = await app.request('/api/users/demo/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filter: { field: 'title', op: 'contains', value: 'matrix' },
        page: 1,
        limit: 10,
      }),
    });
    expect(res.status).toBe(200);
    expect(container.searchService.search).toHaveBeenCalledWith(
      'demo',
      expect.objectContaining({
        filter: { field: 'title', op: 'contains', value: 'matrix' },
        page: 1,
        limit: 10,
      }),
    );
  });

  describe('authentication', () => {
    function authContainer() {
      return createTestContainer({
        env: createTestEnv({
          AUTH_ENABLED: true,
          AUTH_METHODS: ['api_key', 'bearer'],
          AUTH_TOKENS: ['test-secret'],
          AUTH_PUBLIC_PATHS: ['/health', '/privacy', '/openapi-gpt-actions.yaml'],
        }),
      });
    }

    it('allows API when auth is disabled', async () => {
      const app = createApp(createTestContainer());
      const res = await app.request('/api/users/demo');
      expect(res.status).toBe(200);
    });

    it('rejects protected routes without credentials', async () => {
      const app = createApp(authContainer());
      const res = await app.request('/api/users/demo');
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('accepts X-API-Key', async () => {
      const app = createApp(authContainer());
      const res = await app.request('/api/users/demo', {
        headers: { 'X-API-Key': 'test-secret' },
      });
      expect(res.status).toBe(200);
    });

    it('accepts Bearer token', async () => {
      const app = createApp(authContainer());
      const res = await app.request('/api/users/demo', {
        headers: { Authorization: 'Bearer test-secret' },
      });
      expect(res.status).toBe(200);
    });

    it('keeps health, privacy, and GPT Actions schema public', async () => {
      const app = createApp(authContainer());
      expect((await app.request('/health')).status).toBe(200);
      expect((await app.request('/privacy')).status).toBe(200);
      expect((await app.request('/openapi-gpt-actions.yaml')).status).toBe(200);
    });
  });

  it('serves privacy HTML and ChatGPT Actions OpenAPI schema', async () => {
    const app = createApp(createTestContainer());

    const privacy = await app.request('/privacy');
    expect(privacy.status).toBe(200);
    expect(privacy.headers.get('content-type')).toMatch(/text\/html/);
    const privacyHtml = await privacy.text();
    expect(privacyHtml).toContain('Privacy notice');

    const schema = await app.request('/openapi-gpt-actions.yaml');
    expect(schema.status).toBe(200);
    expect(schema.headers.get('content-type')).toMatch(/yaml/);
    const yaml = await schema.text();
    expect(yaml).toContain('operationId: getRecommendations');
    expect(yaml).toContain('operationId: getUserProfile');
  });
});
