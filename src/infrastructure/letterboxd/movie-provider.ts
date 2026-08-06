export type LetterboxdProfile = {
  username: string;
  displayName: string | null;
  filmsCount: number | null;
  bio: string | null;
};

export type LetterboxdFilm = {
  slug: string;
  title: string;
  year: number | null;
  rating: number | null;
  poster: string | null;
  liked: boolean;
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
}
