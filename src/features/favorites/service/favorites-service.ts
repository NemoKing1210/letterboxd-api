import type { CacheProvider } from '../../../infrastructure/cache';
import type {
  SyncHistoryRepository,
  UserMovieRepository,
  UserRepository,
} from '../../../infrastructure/database';
import type { Env } from '../../../app/config/env';
import type { AppLogger } from '../../../infrastructure/logger';
import { CACHE_KEYS, FAVORITE_RATING_THRESHOLD } from '../../../shared/constants';
import { createPaginatedResult, type PaginatedResult } from '../../../shared/types';
import { countBy, normalizeUsername } from '../../../shared/utils';
import { toMovieDto } from '../../movies/mappers/to-movie-dto';
import type { MovieDto } from '../../movies/schemas/movie-schemas';
import type { FilmEnrichmentService } from '../../movies/service/film-enrichment-service';
import {
  ensureLocalUser,
  type UserSyncTrigger,
} from '../../users/service/ensure-local-user';
import type {
  FavoritesFacetKind,
  FavoritesFacetQuery,
  MovieQuery,
  NamedCount,
} from '../schemas/favorites-schemas';

export type FavoriteFacetsCache = {
  directors: NamedCount[];
  genres: NamedCount[];
  years: NamedCount[];
};

export type FavoritesServiceDeps = {
  users: UserRepository;
  userMovies: UserMovieRepository;
  syncHistory: SyncHistoryRepository;
  syncService: UserSyncTrigger;
  enrichment: FilmEnrichmentService;
  cache: CacheProvider;
  env: Env;
  logger: AppLogger;
  userSyncTtlSeconds: number;
  autoSyncIfMissing?: boolean;
};

export class FavoritesService {
  constructor(private readonly deps: FavoritesServiceDeps) {}

  async listFavoriteMovies(
    username: string,
    query: MovieQuery,
  ): Promise<PaginatedResult<MovieDto>> {
    const normalized = normalizeUsername(username);
    const user = await ensureLocalUser(normalized, this.deps);

    const { items, total } = await this.deps.userMovies.findFiltered(user.id, {
      ...query,
      likedOnly: true,
    });
    const enriched = await this.deps.enrichment.enrichEntries(items);

    return createPaginatedResult(
      enriched.map(toMovieDto),
      total,
      query.page,
      query.limit,
    );
  }

  async listFavoriteFacet(
    username: string,
    facet: FavoritesFacetKind,
    query: FavoritesFacetQuery,
  ): Promise<PaginatedResult<NamedCount>> {
    const normalized = normalizeUsername(username);
    await ensureLocalUser(normalized, this.deps);

    const facets = await this.loadFavoriteFacets(normalized);
    const all = facets[facet];
    const start = (query.page - 1) * query.limit;
    const items = all.slice(start, start + query.limit);

    return createPaginatedResult(items, all.length, query.page, query.limit);
  }

  private async loadFavoriteFacets(username: string): Promise<FavoriteFacetsCache> {
    const cacheKey = CACHE_KEYS.userFavoriteFacets(username);
    const cached = await this.deps.cache.get<FavoriteFacetsCache>(cacheKey);
    if (cached) return cached;

    const user = await this.deps.users.findByUsername(username);
    if (!user) {
      const empty: FavoriteFacetsCache = { directors: [], genres: [], years: [] };
      return empty;
    }

    const entries = await this.deps.userMovies.findAllForUser(user.id);
    const liked = entries.filter(isLikedEntry);

    const genreCounts = new Map<string, number>();
    for (const entry of liked) {
      for (const genre of entry.movie.genres) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }
    }

    const facets: FavoriteFacetsCache = {
      directors: sortNamedCounts(countBy(liked, (e) => e.movie.director)),
      genres: sortNamedCounts(genreCounts),
      years: sortNamedCounts(
        countBy(liked, (e) => (e.movie.year !== null ? String(e.movie.year) : null)),
      ),
    };

    await this.deps.cache.set(cacheKey, facets, this.deps.env.CACHE_TTL);
    return facets;
  }
}

function isLikedEntry(entry: { favorite: boolean; rating: number | null }): boolean {
  return entry.favorite || (entry.rating !== null && entry.rating >= FAVORITE_RATING_THRESHOLD);
}

function sortNamedCounts(map: Map<string, number>): NamedCount[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}
