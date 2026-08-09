import type { MovieDto } from '../../movies/schemas/movie-schemas';
import type { MovieExportJson } from '../schemas/export-schemas';

export function moviesToJsonPayload(movies: MovieDto[], total: number): MovieExportJson {
  return { items: movies, total };
}

export function moviesToJson(movies: MovieDto[], total: number): string {
  return JSON.stringify(moviesToJsonPayload(movies, total));
}
