import type { CacheProvider } from '../../../infrastructure/cache';
import type { UserMovieRepository, UserRepository } from '../../../infrastructure/database';
import type { Env } from '../../../app/config/env';
import { CACHE_KEYS } from '../../../shared/constants';
import { average, normalizeUsername } from '../../../shared/utils';
import { toMovieDto } from '../../movies/mappers/to-movie-dto';
import type { MovieDto } from '../../movies/schemas/movie-schemas';
import type { FilmEnrichmentService } from '../../movies/service/film-enrichment-service';
import {
  ensureLocalUser,
  type UserSyncTrigger,
} from '../../users/service/ensure-local-user';

const TOP_RATED_SLICE = 10;

export type RatingsSummary = {
  averageRating: number | null;
  ratingsCount: number;
  bestMovies: MovieDto[];
  worstMovies: MovieDto[];
  distribution: Record<string, number>;
};

export type RatingsServiceDeps = {
  users: UserRepository;
  userMovies: UserMovieRepository;
  syncService: UserSyncTrigger;
  enrichment: FilmEnrichmentService;
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

    const best = rated.slice(0, TOP_RATED_SLICE);
    const worst = [...rated].sort((a, b) => a.rating - b.rating).slice(0, TOP_RATED_SLICE);
    const toEnrich = [...best, ...worst];
    const enriched = await this.deps.enrichment.enrichEntries(toEnrich);
    const byId = new Map(enriched.map((entry) => [entry.id, entry]));

    const summary: RatingsSummary = {
      averageRating: average(rated.map((r) => r.rating)),
      ratingsCount: rated.length,
      bestMovies: best.map((entry) => toMovieDto(byId.get(entry.id) ?? entry)),
      worstMovies: worst.map((entry) => toMovieDto(byId.get(entry.id) ?? entry)),
      distribution,
    };

    await this.deps.cache.set(cacheKey, summary, this.deps.env.CACHE_TTL);
    return summary;
  }
}
