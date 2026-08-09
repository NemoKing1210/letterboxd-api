import type {
  SyncHistoryRepository,
  MovieRepository,
  UserMovieRepository,
  UserRepository,
} from '../../../infrastructure/database';
import type { CacheProvider } from '../../../infrastructure/cache';
import type { LetterboxdDiaryEntry, MovieProvider } from '../../../infrastructure/letterboxd';
import type { AppLogger } from '../../../infrastructure/logger';
import { CACHE_KEYS, SYNC_STATUS } from '../../../shared/constants';
import { AppError } from '../../../shared/errors/app-error';
import { normalizeUsername } from '../../../shared/utils';
import { letterboxdFilmSchema } from '../schemas/sync-schemas';
import type { SyncResponse } from '../schemas/sync-schemas';
import { realPoster } from './merge-film-metadata';

export type SynchronizationServiceDeps = {
  movieProvider: MovieProvider;
  users: UserRepository;
  movies: MovieRepository;
  userMovies: UserMovieRepository;
  syncHistory: SyncHistoryRepository;
  cache: CacheProvider;
  logger: AppLogger;
};

export class SynchronizationService {
  constructor(private readonly deps: SynchronizationServiceDeps) {}

  async syncLetterboxdUser(username: string): Promise<SyncResponse> {
    const normalized = normalizeUsername(username);
    const sync = await this.deps.syncHistory.create({
      username: normalized,
      status: 'RUNNING',
    });

    this.deps.logger.info({ username: normalized, syncId: sync.id }, 'Synchronization started');

    try {
      await this.deps.movieProvider.getProfile(normalized);
      const [films, watchedBySlug] = await Promise.all([
        this.deps.movieProvider.getMovies(normalized),
        this.loadWatchedDates(normalized),
      ]);

      const user = await this.deps.users.upsertByUsername(normalized);
      let moviesSynced = 0;

      for (const raw of films) {
        const parsed = letterboxdFilmSchema.safeParse(raw);
        if (!parsed.success) {
          this.deps.logger.warn(
            { username: normalized, issues: parsed.error.issues, film: raw },
            'Skipping invalid film during sync',
          );
          continue;
        }

        const film = parsed.data;
        const movie = await this.deps.movies.upsertBySlug({
          slug: film.slug,
          title: film.title,
          year: film.year,
          poster: realPoster(film.poster),
        });

        const watchedDateRaw = watchedBySlug.get(film.slug) ?? null;
        await this.deps.userMovies.upsert({
          userId: user.id,
          movieId: movie.id,
          rating: film.rating,
          favorite: film.liked,
          watchedDate: watchedDateRaw ? new Date(watchedDateRaw) : null,
        });

        moviesSynced += 1;
      }

      const finished = await this.deps.syncHistory.update(sync.id, {
        status: 'SUCCESS',
        finishedAt: new Date(),
        userId: user.id,
        error: null,
      });

      await this.invalidateUserCache(normalized);

      this.deps.logger.info(
        { username: normalized, syncId: sync.id, moviesSynced },
        'Synchronization completed',
      );

      return {
        syncId: finished.id,
        username: normalized,
        status: SYNC_STATUS.SUCCESS,
        moviesSynced,
        startedAt: finished.startedAt.toISOString(),
        finishedAt: finished.finishedAt?.toISOString() ?? null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      this.deps.logger.error({ err: error, username: normalized, syncId: sync.id }, 'Synchronization failed');

      const failed = await this.deps.syncHistory.update(sync.id, {
        status: 'FAILED',
        finishedAt: new Date(),
        error: message,
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError({
        message: `Synchronization failed for ${normalized}`,
        code: 'SYNC_FAILED',
        status: 502,
        cause: error,
        details: { syncId: failed.id },
      });
    }
  }

  private async loadWatchedDates(username: string): Promise<Map<string, string>> {
    try {
      const diary = await this.deps.movieProvider.getDiary(username);
      return diaryDatesBySlug(diary);
    } catch (error) {
      this.deps.logger.warn({ err: error, username }, 'Diary scrape failed; continuing without watched dates');
      return new Map();
    }
  }

  private async invalidateUserCache(username: string): Promise<void> {
    await Promise.all([
      this.deps.cache.delete(CACHE_KEYS.userProfile(username)),
      this.deps.cache.delete(CACHE_KEYS.userStats(username)),
      this.deps.cache.delete(CACHE_KEYS.userRatings(username)),
      this.deps.cache.delete(CACHE_KEYS.userFavorites(username)),
    ]);
  }
}

function diaryDatesBySlug(diary: LetterboxdDiaryEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of diary) {
    if (!entry.watchedDate || map.has(entry.slug)) continue;
    map.set(entry.slug, entry.watchedDate);
  }
  return map;
}
