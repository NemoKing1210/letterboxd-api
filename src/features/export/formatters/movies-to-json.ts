import type { MovieDto } from '../../movies/schemas/movie-schemas';
import { pickFields } from '../../../shared/utils/fields';
import type { MovieExportJson } from '../schemas/export-schemas';

export function moviesToJsonPayload(
  movies: MovieDto[],
  total: number,
  fields?: readonly string[],
): MovieExportJson {
  const items = fields
    ? movies.map((movie) => pickFields(movie as Record<string, unknown>, fields) as MovieDto)
    : movies;
  return { items, total };
}

export function moviesToJson(
  movies: MovieDto[],
  total: number,
  fields?: readonly string[],
): string {
  return JSON.stringify(moviesToJsonPayload(movies, total, fields));
}
