import { describe, expect, it, vi } from 'vitest';
import { SynchronizationService } from './synchronization-service';
import type { LetterboxdFilm, LetterboxdProfile, MovieProvider } from '../../../infrastructure/letterboxd';
import type { CacheProvider } from '../../../infrastructure/cache';
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
  it('syncs films into repositories without film-page enrichment', async () => {
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

    const getFilmDetails = vi.fn();
    let moviesStarted = false;
    let diaryStarted = false;
    let moviesSawDiaryStarted = false;
    let diarySawMoviesStarted = false;

    const provider: MovieProvider = {
      getProfile: async (): Promise<LetterboxdProfile> => ({
        username: 'demo',
        displayName: 'Demo',
        filmsCount: 1,
        bio: null,
      }),
      getMovies: async () => {
        moviesStarted = true;
        moviesSawDiaryStarted = diaryStarted;
        await Promise.resolve();
        return films;
      },
      getRatings: async () => [],
      getDiary: async () => {
        diaryStarted = true;
        diarySawMoviesStarted = moviesStarted;
        await Promise.resolve();
        return [
          {
            ...films[0]!,
            watchedDate: '2024-06-01T00:00:00.000Z',
            review: null,
          },
        ];
      },
      getWatchlist: async () => [],
      getFilmDetails,
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
      enriched: false,
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

    const upsertBySlug = vi.fn(async () => movie);
    const upsertUserMovie = vi.fn(async (): Promise<UserMovie> => ({
      id: 'um1',
      userId: user.id,
      movieId: movie.id,
      rating: 4.5,
      favorite: true,
      watchedDate: new Date('2024-06-01T00:00:00.000Z'),
    }));

    const service = new SynchronizationService({
      movieProvider: provider,
      users: {
        findByUsername: vi.fn(),
        findByUsernameWithMovies: vi.fn(),
        upsertByUsername: vi.fn(async () => user),
      },
      movies: {
        findBySlugs: vi.fn(),
        upsertBySlug,
      },
      userMovies: {
        upsert: upsertUserMovie,
        findFiltered: vi.fn(),
        findAllForUser: vi.fn(),
      },
      syncHistory: {
        create: vi.fn(async () => syncRecord),
        update: vi.fn(async (_id, data) => ({
          ...syncRecord,
          ...data,
          finishedAt: data.finishedAt ?? null,
          status: data.status,
        })),
        findLatest: vi.fn(),
        findLatestSuccessful: vi.fn(),
      },
      cache: {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        deleteByPrefix: vi.fn(),
        clear: vi.fn(),
      } satisfies CacheProvider,
      logger: createLogger(),
    });

    const result = await service.syncLetterboxdUser('Demo');

    expect(result.status).toBe('SUCCESS');
    expect(result.moviesSynced).toBe(1);
    expect(getFilmDetails).not.toHaveBeenCalled();
    expect(moviesSawDiaryStarted || diarySawMoviesStarted).toBe(true);
    expect(upsertBySlug).toHaveBeenCalledWith({
      slug: 'inception',
      title: 'Inception',
      year: 2010,
      poster: null,
    });
    expect(upsertUserMovie).toHaveBeenCalledWith({
      userId: 'u1',
      movieId: 'm1',
      rating: 4.5,
      favorite: true,
      watchedDate: new Date('2024-06-01T00:00:00.000Z'),
    });
  });

  it('dedupes concurrent syncs for the same username', async () => {
    let resolveProfile!: (value: LetterboxdProfile) => void;
    const profilePromise = new Promise<LetterboxdProfile>((resolve) => {
      resolveProfile = resolve;
    });
    const getProfile = vi.fn(() => profilePromise);

    const provider: MovieProvider = {
      getProfile,
      getMovies: async () => [],
      getRatings: async () => [],
      getDiary: async () => [],
      getWatchlist: async () => [],
      getFilmDetails: vi.fn(),
    };

    const user: User = {
      id: 'u1',
      username: 'demo',
      createdAt: new Date(),
      updatedAt: new Date(),
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

    const create = vi.fn(async () => syncRecord);
    const service = new SynchronizationService({
      movieProvider: provider,
      users: {
        findByUsername: vi.fn(),
        findByUsernameWithMovies: vi.fn(),
        upsertByUsername: vi.fn(async () => user),
      },
      movies: {
        findBySlugs: vi.fn(),
        upsertBySlug: vi.fn(),
      },
      userMovies: {
        upsert: vi.fn(),
        findFiltered: vi.fn(),
        findAllForUser: vi.fn(),
      },
      syncHistory: {
        create,
        update: vi.fn(async (_id, data) => ({
          ...syncRecord,
          ...data,
          finishedAt: data.finishedAt ?? null,
          status: data.status,
        })),
        findLatest: vi.fn(),
        findLatestSuccessful: vi.fn(),
      },
      cache: {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        deleteByPrefix: vi.fn(),
        clear: vi.fn(),
      } satisfies CacheProvider,
      logger: createLogger(),
    });

    const first = service.syncLetterboxdUser('Demo');
    const second = service.syncLetterboxdUser('demo');

    resolveProfile({
      username: 'demo',
      displayName: 'Demo',
      filmsCount: 0,
      bio: null,
    });

    const [a, b] = await Promise.all([first, second]);

    expect(a.syncId).toBe(b.syncId);
    expect(create).toHaveBeenCalledTimes(1);
    expect(getProfile).toHaveBeenCalledTimes(1);
  });
});
