import type { MovieDto } from '../../movies/schemas/movie-schemas';

const CSV_COLUMNS = [
  'id',
  'title',
  'year',
  'slug',
  'url',
  'poster',
  'genres',
  'director',
  'rating',
  'favorite',
  'watchedDate',
] as const;

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

function rowFromMovie(movie: MovieDto): string {
  return [
    cellFromValue(movie.id),
    cellFromValue(movie.title),
    cellFromValue(movie.year),
    cellFromValue(movie.slug),
    cellFromValue(movie.url),
    cellFromValue(movie.poster),
    cellFromValue(movie.genres.join('|')),
    cellFromValue(movie.director),
    cellFromValue(movie.rating),
    cellFromValue(movie.favorite),
    cellFromValue(movie.watchedDate),
  ].join(',');
}

/** Serialize movie DTOs to RFC-friendly CSV (header + rows, CRLF line endings). */
export function moviesToCsv(movies: MovieDto[]): string {
  const header = CSV_COLUMNS.join(',');
  if (movies.length === 0) {
    return `${header}\r\n`;
  }
  const rows = movies.map(rowFromMovie);
  return `${header}\r\n${rows.join('\r\n')}\r\n`;
}
