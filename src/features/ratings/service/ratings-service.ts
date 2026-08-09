import type { CacheProvider } from '../../../infrastructure/cache';
import type { UserMovieRepository, UserRepository } from '../../../infrastructure/database';
import type { Env } from '../../../app/config/env';
import { CACHE_KEYS } from '../../../shared/constants';
import { average, normalizeUsername } from '../../../shared/utils';
import {
  ensureLocalUser,
  type UserSyncTrigger,
} from '../../users/service/ensure-local-user';

export type RatingsSummary = {
  averageRating: number | null;
  ratingsCount: number;
  bestMovies: Array<{ title: string; year: number | null; rating: number; slug: string | null }>;
  worstMovies: Array<{ title: string; year: number | null; rating: number; slug: string | null }>;
  distribution: Record<string, number>;
};

export type RatingsServiceDeps = {
  users: UserRepository;
  userMovies: UserMovieRepository;
  syncService: UserSyncTrigger;
  cache: CacheProvider;
  env: Env;
  autoSyncIfMissing?: boolean;
};

export class RatingsService {
  constructor(private readonly deps: RatingsServiceDeps) {}

  async getRatings(username: string): Promise<RatingsSummary> {
    const normalized = normalizeUsername(username);
    const cacheKey = CACHE_KEYS.userRatings(normalized);
    const cached = await this.deps.cache.get<RatingsSummary>(cacheKey);
    if (cached) return cached;

    const user = await ensureLocalUser(normalized, this.deps);

    const entries = await this.deps.userMovies.findAllForUser(user.id);
    const rated = entries
      .filter((e): e is typeof e & { rating: number } => e.rating !== null)
      .sort((a, b) => b.rating - a.rating);

    const distribution: Record<string, number> = {};
    for (const entry of rated) {
      const key = entry.rating.toFixed(1);
      distribution[key] = (distribution[key] ?? 0) + 1;
    }

    const toMovie = (e: (typeof rated)[number]) => ({
      title: e.movie.title,
      year: e.movie.year,
      rating: e.rating,
      slug: e.movie.slug,
    });

    const summary: RatingsSummary = {
      averageRating: average(rated.map((r) => r.rating)),
      ratingsCount: rated.length,
      bestMovies: rated.slice(0, 10).map(toMovie),
      worstMovies: [...rated].sort((a, b) => a.rating - b.rating).slice(0, 10).map(toMovie),
      distribution,
    };

    await this.deps.cache.set(cacheKey, summary, this.deps.env.CACHE_TTL);
    return summary;
  }
}
