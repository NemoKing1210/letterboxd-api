import { describe, expect, it, vi } from 'vitest';
import type { Movie, SyncHistory, User, UserMovie } from '@prisma/client';
import type { CacheProvider } from '../../../infrastructure/cache';
import type {
  SyncHistoryRepository,
  UserMovieRepository,
  UserRepository,
} from '../../../infrastructure/database';
import type { Env } from '../../../app/config/env';
import type { AppLogger } from '../../../infrastructure/logger';
import type { FilmEnrichmentService } from '../../movies/service/film-enrichment-service';
import { FavoritesService } from './favorites-service';

function user(username = 'demo'): User {
  return {
    id: 'u1',
    username,
    followingCount: null,
    followersCount: null,
    externalLinks: [],
    favoriteFilms: [],
    recentLikes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function entry(partial: {
  id: string;
  title: string;
  rating: number | null;
  favorite: boolean;
  director?: string | null;
  genres?: string[];
  year?: number | null;
}): UserMovie & { movie: Movie } {
  return {
    id: `um-${partial.id}`,
    userId: 'u1',
    movieId: partial.id,
    rating: partial.rating,
    favorite: partial.favorite,
    watchedDate: null,
    movie: {
      id: partial.id,
      slug: partial.title.toLowerCase().replace(/\s+/g, '-'),
      title: partial.title,
      year: partial.year ?? 2020,
      tmdbId: null,
      poster: null,
      genres: partial.genres ?? [],
      director: partial.director ?? null,
      enriched: true,
    },
  };
}

function createService(entries: Array<UserMovie & { movie: Movie }>) {
  const existing = user();
  const users: UserRepository = {
    findByUsername: vi.fn(async () => existing),
    findByUsernameWithMovies: vi.fn(),
    upsertByUsername: vi.fn(),
  };
  const userMovies: UserMovieRepository = {
    upsert: vi.fn(),
    findFiltered: vi.fn(async (_userId, filters) => {
      let items = entries;
      if (filters.likedOnly) {
        items = items.filter((e) => e.favorite || (e.rating !== null && e.rating >= 4.5));
      }
      const total = items.length;
      const start = (filters.page - 1) * filters.limit;
      return { items: items.slice(start, start + filters.limit), total };
    }),
    findBySearch: vi.fn(),
    findAllForUser: vi.fn(async () => entries),
  };
  const latestSuccess: SyncHistory = {
    id: 's1',
    userId: 'u1',
    username: 'demo',
    status: 'SUCCESS',
    startedAt: new Date(),
    finishedAt: new Date(),
    error: null,
  };
  const syncHistory: SyncHistoryRepository = {
    create: vi.fn(),
    update: vi.fn(),
    findLatest: vi.fn(),
    findLatestSuccessful: vi.fn(async () => latestSuccess),
  };
  const cacheStore = new Map<string, unknown>();
  const cache = {
    get: async <T>(key: string): Promise<T | null> =>
      (cacheStore.get(key) as T | undefined) ?? null,
    set: async (key: string, value: unknown): Promise<void> => {
      cacheStore.set(key, value);
    },
    delete: async (key: string): Promise<void> => {
      cacheStore.delete(key);
    },
    deleteByPrefix: async (): Promise<void> => undefined,
    clear: async (): Promise<void> => {
      cacheStore.clear();
    },
  } satisfies CacheProvider;
  const enrichment = {
    enrichEntries: vi.fn(async (items: typeof entries) => items),
  } as unknown as FilmEnrichmentService;

  const service = new FavoritesService({
    users,
    userMovies,
    syncHistory,
    syncService: { syncLetterboxdUser: vi.fn() },
    enrichment,
    cache,
    env: { CACHE_TTL: 60 } as Env,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as AppLogger,
    userSyncTtlSeconds: 43_200,
  });

  return { service, userMovies, enrichment, cache };
}

describe('FavoritesService', () => {
  const catalog = [
    entry({
      id: '1',
      title: 'Arrival',
      rating: 5,
      favorite: false,
      director: 'Denis Villeneuve',
      genres: ['sci-fi'],
      year: 2016,
    }),
    entry({
      id: '2',
      title: 'Dune',
      rating: 4.5,
      favorite: true,
      director: 'Denis Villeneuve',
      genres: ['sci-fi', 'adventure'],
      year: 2021,
    }),
    entry({
      id: '3',
      title: 'Okay Film',
      rating: 3,
      favorite: false,
      director: 'Someone Else',
      genres: ['drama'],
      year: 2010,
    }),
    entry({
      id: '4',
      title: 'Heart Film',
      rating: null,
      favorite: true,
      director: 'Jane Doe',
      genres: ['drama'],
      year: 2016,
    }),
  ];

  it('lists only liked movies with pagination', async () => {
    const { service, userMovies, enrichment } = createService(catalog);

    const page1 = await service.listFavoriteMovies('demo', {
      page: 1,
      limit: 2,
      sort: 'rating_desc',
    });

    expect(userMovies.findFiltered).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ likedOnly: true, page: 1, limit: 2 }),
    );
    expect(enrichment.enrichEntries).toHaveBeenCalled();
    expect(page1.total).toBe(3);
    expect(page1.items).toHaveLength(2);
    expect(page1.totalPages).toBe(2);
    expect(page1.limit).toBe(2);
  });

  it('paginates favorite directors by count', async () => {
    const { service } = createService(catalog);

    const result = await service.listFavoriteFacet('demo', 'directors', {
      page: 1,
      limit: 1,
    });

    expect(result.total).toBe(2);
    expect(result.items).toEqual([{ name: 'Denis Villeneuve', count: 2 }]);
    expect(result.totalPages).toBe(2);

    const page2 = await service.listFavoriteFacet('demo', 'directors', {
      page: 2,
      limit: 1,
    });
    expect(page2.items).toEqual([{ name: 'Jane Doe', count: 1 }]);
  });

  it('aggregates favorite genres and years from liked set only', async () => {
    const { service } = createService(catalog);

    const genres = await service.listFavoriteFacet('demo', 'genres', {
      page: 1,
      limit: 20,
    });
    expect(genres.items).toEqual([
      { name: 'sci-fi', count: 2 },
      { name: 'adventure', count: 1 },
      { name: 'drama', count: 1 },
    ]);

    const years = await service.listFavoriteFacet('demo', 'years', {
      page: 1,
      limit: 20,
    });
    expect(years.items.find((y) => y.name === '2016')?.count).toBe(2);
    expect(years.items.some((y) => y.name === '2010')).toBe(false);
  });
});
