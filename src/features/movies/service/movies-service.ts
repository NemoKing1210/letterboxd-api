import type { UserMovieRepository, UserRepository } from '../../../infrastructure/database';
import { createPaginatedResult, type PaginatedResult } from '../../../shared/types';
import { normalizeUsername } from '../../../shared/utils';
import {
  ensureLocalUser,
  type UserSyncTrigger,
} from '../../users/service/ensure-local-user';
import { toMovieDto } from '../mappers/to-movie-dto';
import type { MovieDto, MovieQuery } from '../schemas/movie-schemas';

export type { MovieDto };

export type MoviesServiceDeps = {
  users: UserRepository;
  userMovies: UserMovieRepository;
  syncService: UserSyncTrigger;
  autoSyncIfMissing?: boolean;
};

export class MoviesService {
  constructor(private readonly deps: MoviesServiceDeps) {}

  async listMovies(username: string, query: MovieQuery): Promise<PaginatedResult<MovieDto>> {
    const normalized = normalizeUsername(username);
    const user = await ensureLocalUser(normalized, this.deps);

    const { items, total } = await this.deps.userMovies.findFiltered(user.id, query);

    return createPaginatedResult(
      items.map(toMovieDto),
      total,
      query.page,
      query.limit,
    );
  }
}
