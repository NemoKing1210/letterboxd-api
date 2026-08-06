import { describe, expect, it, vi } from 'vitest';
import { SynchronizationService } from './synchronization-service';
import type { LetterboxdFilm, LetterboxdProfile, MovieProvider } from '../../../infrastructure/letterboxd';
import type { CacheProvider } from '../../../infrastructure/cache';
import type {
  MovieRepository,
  SyncHistoryRepository,
  UserMovieRepository,
  UserRepository,
} from '../../../infrastructure/database';
import type { AppLogger } from '../../../infrastructure/logger';
import type { Movie, SyncHistory, User, UserMovie } from '@prisma/client';

function createLogger(): AppLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  } as unknown as AppLogger;
}

describe('SynchronizationService', () => {
  it('syncs films into repositories', async () => {
    const films: LetterboxdFilm[] = [
      {
        slug: 'inception',
        title: 'Inception',
        year: 2010,
        rating: 4.5,
        poster: null,
        liked: true,
      },
    ];

    const provider: MovieProvider = {
      getProfile: async (): Promise<LetterboxdProfile> => ({
        username: 'demo',
        displayName: 'Demo',
        filmsCount: 1,
        bio: null,
      }),
      getMovies: async () => films,
      getRatings: async () => [],
      getDiary: async () => [],
      getWatchlist: async () => [],
    };

    const user: User = {
      id: 'u1',
      username: 'demo',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const movie: Movie = {
      id: 'm1',
      title: 'Inception',
      year: 2010,
      tmdbId: null,
      poster: null,
      genres: [],
      director: null,
      slug: 'inception',
    };

    const syncRecord: SyncHistory = {
      id: 's1',
      userId: null,
      username: 'demo',
      status: 'RUNNING',
      startedAt: new Date('2024-01-01T00:00:00.000Z'),
      finishedAt: null,
      error: null,
    };

    const users: UserRepository = {
      findByUsername: vi.fn(),
      findByUsernameWithMovies: vi.fn(),
      upsertByUsername: vi.fn(async () => user),
    };

    const movies: MovieRepository = {
      upsertBySlug: vi.fn(async () => movie),
    };

    const userMovies: UserMovieRepository = {
      upsert: vi.fn(async (): Promise<UserMovie> => ({
        id: 'um1',
        userId: user.id,
        movieId: movie.id,
        rating: 4.5,
        favorite: true,
        watchedDate: null,
      })),
      findFiltered: vi.fn(),
      findAllForUser: vi.fn(),
    };

    const syncHistory: SyncHistoryRepository = {
      create: vi.fn(async () => syncRecord),
      update: vi.fn(async (_id, data) => ({
        ...syncRecord,
        ...data,
        finishedAt: data.finishedAt ?? null,
        status: data.status,
      })),
      findLatest: vi.fn(),
    };

    const cache: CacheProvider = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      deleteByPrefix: vi.fn(),
      clear: vi.fn(),
    };

    const service = new SynchronizationService({
      movieProvider: provider,
      users,
      movies,
      userMovies,
      syncHistory,
      cache,
      logger: createLogger(),
    });

    const result = await service.syncLetterboxdUser('Demo');

    expect(result.status).toBe('SUCCESS');
    expect(result.moviesSynced).toBe(1);
    expect(movies.upsertBySlug).toHaveBeenCalledOnce();
    expect(userMovies.upsert).toHaveBeenCalledOnce();
    expect(cache.delete).toHaveBeenCalled();
  });
});
