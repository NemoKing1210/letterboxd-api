import type { CacheProvider } from '../../../infrastructure/cache';
import type {
  SyncHistoryRepository,
  UserMovieRepository,
  UserRepository,
} from '../../../infrastructure/database';
import type { Env } from '../../../app/config/env';
import type { AppLogger } from '../../../infrastructure/logger';
import { CACHE_KEYS } from '../../../shared/constants';
import { average, countBy, normalizeUsername, topN } from '../../../shared/utils';
import type { UserProfile } from '../schemas/user-schemas';
import { ensureLocalUser, type UserSyncTrigger } from './ensure-local-user';

export type UsersServiceDeps = {
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

export class UsersService {
  constructor(private readonly deps: UsersServiceDeps) {}

  async getProfile(username: string): Promise<UserProfile> {
    const normalized = normalizeUsername(username);
    const user = await ensureLocalUser(normalized, this.deps);

    const cacheKey = CACHE_KEYS.userProfile(normalized);
    const cached = await this.deps.cache.get<UserProfile>(cacheKey);
    if (cached) return cached;

    const entries = await this.deps.userMovies.findAllForUser(user.id);
    const ratings = entries.map((e) => e.rating).filter((r): r is number => r !== null);
    const genreCounts = countBy(entries, (e) => {
      const genre = e.movie.genres[0];
      return genre ?? null;
    });

    // Prefer counting all genres when available
    const allGenreCounts = new Map<string, number>();
    for (const entry of entries) {
      for (const genre of entry.movie.genres) {
        allGenreCounts.set(genre, (allGenreCounts.get(genre) ?? 0) + 1);
      }
    }
    const favoriteGenres =
      allGenreCounts.size > 0 ? topN(allGenreCounts, 5) : topN(genreCounts, 5);

    const latestSync = await this.deps.syncHistory.findLatest(normalized);

    const profile: UserProfile = {
      username: user.username,
      moviesCount: entries.length,
      averageRating: average(ratings),
      favoriteGenres,
      lastSyncedAt: latestSync?.finishedAt?.toISOString() ?? latestSync?.startedAt.toISOString() ?? null,
    };

    await this.deps.cache.set(cacheKey, profile, this.deps.env.CACHE_TTL);
    return profile;
  }
}
