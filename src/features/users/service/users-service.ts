import type { User, UserMovie, Movie } from '@prisma/client';
import type { CacheProvider } from '../../../infrastructure/cache';
import type {
  SyncHistoryRepository,
  UserMovieRepository,
  UserRepository,
  UserMovieProfileStats,
} from '../../../infrastructure/database';
import type { Env } from '../../../app/config/env';
import type { AppLogger } from '../../../infrastructure/logger';
import { CACHE_KEYS, LETTERBOXD_BASE_URL } from '../../../shared/constants';
import { createPaginatedResult, type PaginatedResult } from '../../../shared/types';
import { average, countBy, filmPageUrl, normalizeUsername, topN, userProfileUrl } from '../../../shared/utils';
import {
  resolveUserListSearch,
  storedExternalLinkSchema,
  storedProfileFilmSchema,
  type ExternalLink,
  type ProfileFilm,
  type UserListItem,
  type UserProfile,
  type UserQuery,
} from '../schemas/user-schemas';
import { ensureLocalUser, type UserSyncTrigger } from './ensure-local-user';

type UserMovieEntry = UserMovie & { movie: Movie };

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

export type GetProfileResult =
  | { kind: 'ready'; profile: UserProfile }
  | {
      kind: 'syncing';
      syncId: string;
      username: string;
      startedAt: string;
      poll: string;
    };

export class UsersService {
  constructor(private readonly deps: UsersServiceDeps) {}

  async listUsers(query: UserQuery): Promise<PaginatedResult<UserListItem>> {
    const { items, total } = await this.deps.users.findFiltered({
      ...query,
      q: resolveUserListSearch(query),
    });

    const entries = await this.deps.userMovies.findAllForUsers(items.map((row) => row.user.id));
    const entriesByUserId = new Map<string, UserMovieEntry[]>();
    for (const entry of entries) {
      const bucket = entriesByUserId.get(entry.userId);
      if (bucket) {
        bucket.push(entry);
      } else {
        entriesByUserId.set(entry.userId, [entry]);
      }
    }

    return createPaginatedResult(
      items.map((row) =>
        buildUserProfileFromEntries(
          row.user,
          entriesByUserId.get(row.user.id) ?? [],
          row.lastSyncedAt?.toISOString() ?? null,
        ),
      ),
      total,
      query.page,
      query.limit,
    );
  }

  async getProfile(username: string): Promise<GetProfileResult> {
    const normalized = normalizeUsername(username);
    const existing = await this.deps.users.findByUsername(normalized);

    if (!existing) {
      const running = await this.deps.syncHistory.findLatestRunning(normalized);
      if (running) {
        return {
          kind: 'syncing',
          syncId: running.id,
          username: normalized,
          startedAt: running.startedAt.toISOString(),
          poll: `/api/users/${normalized}/sync/${running.id}`,
        };
      }

      const { syncId } = await this.deps.syncService.startBackgroundSync(normalized);
      const row = await this.deps.syncHistory.findById(syncId);
      return {
        kind: 'syncing',
        syncId,
        username: normalized,
        startedAt: row?.startedAt.toISOString() ?? new Date().toISOString(),
        poll: `/api/users/${normalized}/sync/${syncId}`,
      };
    }

    const user = await ensureLocalUser(normalized, {
      ...this.deps,
      autoSyncIfMissing: false,
    });

    const cacheKey = CACHE_KEYS.userProfile(normalized);
    const cached = await this.deps.cache.get<UserProfile>(cacheKey);
    if (cached) return { kind: 'ready', profile: cached };

    const [stats, latestSync] = await Promise.all([
      this.deps.userMovies.getProfileStats(user.id),
      this.deps.syncHistory.findLatest(normalized),
    ]);

    const profile = buildUserProfileFromStats(
      user,
      stats,
      latestSync?.finishedAt?.toISOString() ?? latestSync?.startedAt.toISOString() ?? null,
    );

    await this.deps.cache.set(cacheKey, profile, this.deps.env.CACHE_TTL);
    return { kind: 'ready', profile };
  }
}

function buildUserProfileFromStats(
  user: User,
  stats: UserMovieProfileStats,
  lastSyncedAt: string | null,
): UserProfile {
  return {
    username: user.username,
    url: userProfileUrl(user.username, LETTERBOXD_BASE_URL),
    moviesCount: stats.moviesCount,
    averageRating: stats.averageRating,
    favoriteGenres: stats.favoriteGenres,
    lastSyncedAt,
    followingCount: user.followingCount,
    followersCount: user.followersCount,
    externalLinks: parseStoredExternalLinks(user.externalLinks),
    favoriteFilms: parseStoredProfileFilms(user.favoriteFilms),
    recentLikes: parseStoredProfileFilms(user.recentLikes),
  };
}

function buildUserProfileFromEntries(
  user: User,
  entries: UserMovieEntry[],
  lastSyncedAt: string | null,
): UserProfile {
  const ratings = entries.map((e) => e.rating).filter((r): r is number => r !== null);
  const genreCounts = countBy(entries, (e) => {
    const genre = e.movie.genres[0];
    return genre ?? null;
  });

  const allGenreCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const genre of entry.movie.genres) {
      allGenreCounts.set(genre, (allGenreCounts.get(genre) ?? 0) + 1);
    }
  }
  const favoriteGenres =
    allGenreCounts.size > 0 ? topN(allGenreCounts, 5) : topN(genreCounts, 5);

  return {
    username: user.username,
    url: userProfileUrl(user.username, LETTERBOXD_BASE_URL),
    moviesCount: entries.length,
    averageRating: average(ratings),
    favoriteGenres,
    lastSyncedAt,
    followingCount: user.followingCount,
    followersCount: user.followersCount,
    externalLinks: parseStoredExternalLinks(user.externalLinks),
    favoriteFilms: parseStoredProfileFilms(user.favoriteFilms),
    recentLikes: parseStoredProfileFilms(user.recentLikes),
  };
}

function parseStoredProfileFilms(value: unknown): ProfileFilm[] {
  const parsed = storedProfileFilmSchema.array().safeParse(value);
  if (!parsed.success) return [];
  return parsed.data.map((film) => ({
    ...film,
    url: filmPageUrl(film.slug, LETTERBOXD_BASE_URL),
  }));
}

function parseStoredExternalLinks(value: unknown): ExternalLink[] {
  const parsed = storedExternalLinkSchema.array().safeParse(value);
  return parsed.success ? parsed.data : [];
}
