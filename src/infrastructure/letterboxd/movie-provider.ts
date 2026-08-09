export type LetterboxdProfileFilm = {
  slug: string;
  title: string;
  year: number | null;
  poster: string | null;
};

export type LetterboxdExternalLink = {
  label: string;
  url: string;
};

export type LetterboxdProfile = {
  username: string;
  displayName: string | null;
  filmsCount: number | null;
  bio: string | null;
  followingCount: number | null;
  followersCount: number | null;
  externalLinks: LetterboxdExternalLink[];
  favoriteFilms: LetterboxdProfileFilm[];
  recentLikes: LetterboxdProfileFilm[];
};

export type LetterboxdFilm = {
  slug: string;
  title: string;
  year: number | null;
  rating: number | null;
  poster: string | null;
  liked: boolean;
};

export type LetterboxdFilmDetails = {
  slug: string;
  title: string;
  year: number | null;
  poster: string | null;
  genres: string[];
  director: string | null;
};

export type LetterboxdRating = LetterboxdFilm & {
  rating: number;
};

export type LetterboxdDiaryEntry = LetterboxdFilm & {
  watchedDate: string | null;
  review: string | null;
};

export interface MovieProvider {
  getProfile(username: string): Promise<LetterboxdProfile>;
  getMovies(username: string): Promise<LetterboxdFilm[]>;
  getRatings(username: string): Promise<LetterboxdRating[]>;
  getDiary(username: string): Promise<LetterboxdDiaryEntry[]>;
  getWatchlist(username: string): Promise<LetterboxdFilm[]>;
  getFilmDetails(slug: string): Promise<LetterboxdFilmDetails>;
}
