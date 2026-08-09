import type {
  SyncHistoryRepository,
  UserMovieRepository,
  UserRepository,
} from '../../../infrastructure/database';
import type { AppLogger } from '../../../infrastructure/logger';
import { createPaginatedResult, type PaginatedResult } from '../../../shared/types';
import { normalizeUsername } from '../../../shared/utils';
import {
  ensureLocalUser,
  type UserSyncTrigger,
} from '../../users/service/ensure-local-user';
import { toMovieDto } from '../mappers/to-movie-dto';
import type { MovieDto, MovieQuery } from '../schemas/movie-schemas';
import type { FilmEnrichmentService } from './film-enrichment-service';

export type { MovieDto };

export type MoviesServiceDeps = {
  users: UserRepository;
  userMovies: UserMovieRepository;
  syncHistory: SyncHistoryRepository;
  syncService: UserSyncTrigger;
  enrichment: FilmEnrichmentService;
  logger: AppLogger;
  userSyncTtlSeconds: number;
  autoSyncIfMissing?: boolean;
};

export class MoviesService {
  constructor(private readonly deps: MoviesServiceDeps) {}

  async listMovies(username: string, query: MovieQuery): Promise<PaginatedResult<MovieDto>> {
    const normalized = normalizeUsername(username);
    const user = await ensureLocalUser(normalized, this.deps);

    const { items, total } = await this.deps.userMovies.findFiltered(user.id, query);
    const enriched = await this.deps.enrichment.enrichEntries(items);

    return createPaginatedResult(
      enriched.map(toMovieDto),
      total,
      query.page,
      query.limit,
    );
  }
}
