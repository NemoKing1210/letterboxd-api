import type { MovieDto } from '../../movies/schemas/movie-schemas';
import { MOVIE_DTO_FIELDS, type MovieDtoField } from '../../../shared/utils/fields';

const CSV_COLUMNS = MOVIE_DTO_FIELDS;

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function cellFromValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return escapeCsvCell(String(value));
}

function cellFromMovie(movie: MovieDto, column: MovieDtoField): string {
  if (column === 'genres') {
    return cellFromValue(movie.genres.join('|'));
  }
  return cellFromValue(movie[column]);
}

function rowFromMovie(movie: MovieDto, columns: readonly MovieDtoField[]): string {
  return columns.map((column) => cellFromMovie(movie, column)).join(',');
}

function resolveColumns(fields?: readonly string[]): readonly MovieDtoField[] {
  if (!fields || fields.length === 0) {
    return CSV_COLUMNS;
  }
  return fields as MovieDtoField[];
}

/** Serialize movie DTOs to RFC-friendly CSV (header + rows, CRLF line endings). */
export function moviesToCsv(movies: MovieDto[], fields?: readonly string[]): string {
  const columns = resolveColumns(fields);
  const header = columns.join(',');
  if (movies.length === 0) {
    return `${header}\r\n`;
  }
  const rows = movies.map((movie) => rowFromMovie(movie, columns));
  return `${header}\r\n${rows.join('\r\n')}\r\n`;
}
