import type {
  SyncHistoryRepository,
  UserMovieRepository,
  UserRepository,
} from '../../../infrastructure/database';
import type { AppLogger } from '../../../infrastructure/logger';
import { MAX_EXPORT_LIMIT } from '../../../shared/constants';
import { normalizeUsername } from '../../../shared/utils';
import { toMovieDto } from '../../movies/mappers/to-movie-dto';
import {
  ensureLocalUser,
  type UserSyncTrigger,
} from '../../users/service/ensure-local-user';
import { moviesToCsv } from '../formatters/movies-to-csv';
import { moviesToJson } from '../formatters/movies-to-json';
import {
  resolveMovieExportSearch,
  type ExportFormat,
  type MovieExportQuery,
} from '../schemas/export-schemas';

export type ExportScope = 'movies' | 'favorites';

export type ExportResult = {
  body: string;
  contentType: string;
  filename: string;
};

export type ExportServiceDeps = {
  users: UserRepository;
  userMovies: UserMovieRepository;
  syncHistory: SyncHistoryRepository;
  syncService: UserSyncTrigger;
  logger: AppLogger;
  userSyncTtlSeconds: number;
  autoSyncIfMissing?: boolean;
};

export class ExportService {
  constructor(private readonly deps: ExportServiceDeps) {}

  async exportMovies(
    username: string,
    query: MovieExportQuery,
    format: ExportFormat,
  ): Promise<ExportResult> {
    return this.export(username, query, format, 'movies');
  }

  async exportFavorites(
    username: string,
    query: MovieExportQuery,
    format: ExportFormat,
  ): Promise<ExportResult> {
    return this.export(username, query, format, 'favorites');
  }

  private async export(
    username: string,
    query: MovieExportQuery,
    format: ExportFormat,
    scope: ExportScope,
  ): Promise<ExportResult> {
    const normalized = normalizeUsername(username);
    const user = await ensureLocalUser(normalized, this.deps);

    const limit = query.limit ?? MAX_EXPORT_LIMIT;
    const page = query.limit !== undefined ? (query.page ?? 1) : 1;

    const { items, total } = await this.deps.userMovies.findFiltered(user.id, {
      ratingMin: query.ratingMin,
      ratingMax: query.ratingMax,
      year: query.year,
      yearFrom: query.yearFrom,
      yearTo: query.yearTo,
      genre: query.genre,
      director: query.director,
      q: resolveMovieExportSearch(query),
      sort: query.sort,
      likedOnly: scope === 'favorites',
      page,
      limit,
      maxLimit: MAX_EXPORT_LIMIT,
    });

    const movies = items.map(toMovieDto);
    const filename = `${normalized}-${scope}.${format}`;
    const fields = query.fields;

    if (format === 'csv') {
      return {
        body: moviesToCsv(movies, fields),
        contentType: 'text/csv; charset=utf-8',
        filename,
      };
    }

    return {
      body: moviesToJson(movies, total, fields),
      contentType: 'application/json',
      filename,
    };
  }
}
