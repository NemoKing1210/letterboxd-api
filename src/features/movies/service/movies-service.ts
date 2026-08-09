import type { UserMovieRepository, UserRepository } from '../../../infrastructure/database';
import { createPaginatedResult, type PaginatedResult } from '../../../shared/types';
import { normalizeUsername } from '../../../shared/utils';
import {
  ensureLocalUser,
  type UserSyncTrigger,
} from '../../users/service/ensure-local-user';
import type { MovieQuery } from '../schemas/movie-schemas';

export type MovieDto = {
  id: string;
  title: string;
  year: number | null;
  slug: string | null;
  poster: string | null;
  genres: string[];
  director: string | null;
  rating: number | null;
  favorite: boolean;
  watchedDate: string | null;
};

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

    const mapped: MovieDto[] = items.map((entry) => ({
      id: entry.movie.id,
      title: entry.movie.title,
      year: entry.movie.year,
      slug: entry.movie.slug,
      poster: entry.movie.poster,
      genres: entry.movie.genres,
      director: entry.movie.director,
      rating: entry.rating,
      favorite: entry.favorite,
      watchedDate: entry.watchedDate?.toISOString() ?? null,
    }));

    return createPaginatedResult(mapped, total, query.page, query.limit);
  }
}
