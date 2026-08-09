import type { MovieDto } from '../schemas/movie-schemas';

/** Minimal shape needed to project a user–movie row into the public MovieDto. */
export type MovieDtoSource = {
  rating: number | null;
  favorite: boolean;
  watchedDate: Date | null;
  movie: {
    id: string;
    title: string;
    year: number | null;
    slug: string | null;
    poster: string | null;
    genres: string[];
    director: string | null;
  };
};

export function toMovieDto(entry: MovieDtoSource): MovieDto {
  return {
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
  };
}
