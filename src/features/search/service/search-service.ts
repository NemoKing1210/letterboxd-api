import type {
  SyncHistoryRepository,
  UserMovieRepository,
  UserRepository,
} from '../../../infrastructure/database';
import type { AppLogger } from '../../../infrastructure/logger';
import { createPaginatedResult, type PaginatedResult } from '../../../shared/types';
import { normalizeUsername } from '../../../shared/utils';
import { toMovieDto } from '../../movies/mappers/to-movie-dto';
import type { MovieDto } from '../../movies/schemas/movie-schemas';
import type { FilmEnrichmentService } from '../../movies/service/film-enrichment-service';
import {
  ensureLocalUser,
  type UserSyncTrigger,
} from '../../users/service/ensure-local-user';
import type { SearchBody } from '../schemas/search-schemas';
import { buildSearchWhere } from './build-search-where';

export type SearchServiceDeps = {
  users: UserRepository;
  userMovies: UserMovieRepository;
  syncHistory: SyncHistoryRepository;
  syncService: UserSyncTrigger;
  enrichment: FilmEnrichmentService;
  logger: AppLogger;
  userSyncTtlSeconds: number;
  autoSyncIfMissing?: boolean;
};

export class SearchService {
  constructor(private readonly deps: SearchServiceDeps) {}

  async search(username: string, body: SearchBody): Promise<PaginatedResult<MovieDto>> {
    const normalized = normalizeUsername(username);
    const user = await ensureLocalUser(normalized, this.deps);

    const filterWhere = buildSearchWhere(body.filter);
    const { items, total } = await this.deps.userMovies.findBySearch(user.id, {
      filterWhere,
      sort: body.sort,
      page: body.page,
      limit: body.limit,
    });
    const enriched = await this.deps.enrichment.enrichEntries(items);

    return createPaginatedResult(
      enriched.map(toMovieDto),
      total,
      body.page,
      body.limit,
    );
  }
}
