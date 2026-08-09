import type { CacheProvider } from '../../../infrastructure/cache';
import type {
  SyncHistoryRepository,
  UserMovieRepository,
  UserRepository,
} from '../../../infrastructure/database';
import type { Env } from '../../../app/config/env';
import type { AppLogger } from '../../../infrastructure/logger';
import { CACHE_KEYS } from '../../../shared/constants';
import { average, countBy, decadeFromYear, normalizeUsername, topN } from '../../../shared/utils';
import {
  ensureLocalUser,
  type UserSyncTrigger,
} from '../../users/service/ensure-local-user';

export type StatisticsSummary = {
  moviesWatched: number;
  averageRating: number | null;
  topGenres: Array<{ name: string; count: number }>;
  topDirectors: Array<{ name: string; count: number }>;
  topDecades: Array<{ name: string; count: number }>;
};

export type StatisticsServiceDeps = {
  users: UserRepository;
  userMovies: UserMovieRepository;
  syncHistory: SyncHistoryRepository;
  syncService: UserSyncTrigger;
  cache: CacheProvider;
  env: Env;
  logger: AppLogger;
  userSyncTtlSeconds: number;
  autoSyncIfMissing?: boolean;
};

export class StatisticsService {
  constructor(private readonly deps: StatisticsServiceDeps) {}

  async getStatistics(username: string): Promise<StatisticsSummary> {
    const normalized = normalizeUsername(username);
    const user = await ensureLocalUser(normalized, this.deps);

    const cacheKey = CACHE_KEYS.userStats(normalized);
    const cached = await this.deps.cache.get<StatisticsSummary>(cacheKey);
    if (cached) return cached;

    const entries = await this.deps.userMovies.findAllForUser(user.id);
    const ratings = entries.map((e) => e.rating).filter((r): r is number => r !== null);

    const genreCounts = new Map<string, number>();
    for (const entry of entries) {
      for (const genre of entry.movie.genres) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }
    }

    const summary: StatisticsSummary = {
      moviesWatched: entries.length,
      averageRating: average(ratings),
      topGenres: topN(genreCounts, 10),
      topDirectors: topN(countBy(entries, (e) => e.movie.director), 10),
      topDecades: topN(
        countBy(entries, (e) => (e.movie.year !== null ? decadeFromYear(e.movie.year) : null)),
        10,
      ),
    };

    await this.deps.cache.set(cacheKey, summary, this.deps.env.CACHE_TTL);
    return summary;
  }
}
