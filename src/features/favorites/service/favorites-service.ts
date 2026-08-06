import type { CacheProvider } from '../../../infrastructure/cache';
import type { UserMovieRepository, UserRepository } from '../../../infrastructure/database';
import type { Env } from '../../../app/config/env';
import { CACHE_KEYS } from '../../../shared/constants';
import { NotFoundError } from '../../../shared/errors/app-error';
import { countBy, normalizeUsername, topN } from '../../../shared/utils';

export type FavoritesSummary = {
  favoriteMovies: Array<{ title: string; year: number | null; rating: number | null; slug: string | null }>;
  favoriteDirectors: Array<{ name: string; count: number }>;
  favoriteGenres: Array<{ name: string; count: number }>;
  favoriteYears: Array<{ name: string; count: number }>;
};

export type FavoritesServiceDeps = {
  users: UserRepository;
  userMovies: UserMovieRepository;
  cache: CacheProvider;
  env: Env;
};

export class FavoritesService {
  constructor(private readonly deps: FavoritesServiceDeps) {}

  async getFavorites(username: string): Promise<FavoritesSummary> {
    const normalized = normalizeUsername(username);
    const cacheKey = CACHE_KEYS.userFavorites(normalized);
    const cached = await this.deps.cache.get<FavoritesSummary>(cacheKey);
    if (cached) return cached;

    const user = await this.deps.users.findByUsername(normalized);
    if (!user) {
      throw new NotFoundError(`User "${normalized}" not found. Sync the user first.`);
    }

    const entries = await this.deps.userMovies.findAllForUser(user.id);
    const liked = entries.filter((e) => e.favorite || (e.rating !== null && e.rating >= 4.5));

    const genreCounts = new Map<string, number>();
    for (const entry of liked) {
      for (const genre of entry.movie.genres) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }
    }

    const summary: FavoritesSummary = {
      favoriteMovies: liked
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 20)
        .map((e) => ({
          title: e.movie.title,
          year: e.movie.year,
          rating: e.rating,
          slug: e.movie.slug,
        })),
      favoriteDirectors: topN(countBy(liked, (e) => e.movie.director), 10),
      favoriteGenres: topN(genreCounts, 10),
      favoriteYears: topN(
        countBy(liked, (e) => (e.movie.year !== null ? String(e.movie.year) : null)),
        10,
      ),
    };

    await this.deps.cache.set(cacheKey, summary, this.deps.env.CACHE_TTL);
    return summary;
  }
}
