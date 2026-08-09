import { LETTERBOXD_BASE_URL } from '../../shared/constants';
import { ExternalServiceError, NotFoundError } from '../../shared/errors/app-error';
import { normalizeUsername, sleep } from '../../shared/utils';
import type { AppLogger } from '../logger';
import { HttpClient } from '../http';
import type {
  LetterboxdDiaryEntry,
  LetterboxdFilm,
  LetterboxdProfile,
  LetterboxdRating,
  MovieProvider,
} from './movie-provider';
import { parseFilmsPageHtml, parseHasNextPage, parseProfileHtml } from './parsers';

export type LetterboxdScraperOptions = {
  timeoutMs: number;
  pageDelayMs: number;
  maxPages: number;
  logger: AppLogger;
  httpClient?: HttpClient;
};

export class LetterboxdScraperProvider implements MovieProvider {
  private readonly http: HttpClient;
  private readonly pageDelayMs: number;
  private readonly maxPages: number;
  private readonly logger: AppLogger;

  constructor(options: LetterboxdScraperOptions) {
    this.http = options.httpClient ?? new HttpClient({ timeoutMs: options.timeoutMs });
    this.pageDelayMs = options.pageDelayMs;
    this.maxPages = options.maxPages;
    this.logger = options.logger;
  }

  async getProfile(username: string): Promise<LetterboxdProfile> {
    const normalized = normalizeUsername(username);
    const url = `${LETTERBOXD_BASE_URL}/${normalized}/`;

    try {
      const html = await this.http.getText(url);
      return parseProfileHtml(html, normalized);
    } catch (error) {
      this.logger.error({ err: error, username: normalized }, 'Failed to fetch Letterboxd profile');
      if (error instanceof ExternalServiceError && (error.details as { status?: number })?.status === 404) {
        throw new NotFoundError(`Letterboxd user "${normalized}" not found`);
      }
      throw error;
    }
  }

  async getMovies(username: string): Promise<LetterboxdFilm[]> {
    return this.paginateFilms(username, 'films');
  }

  async getRatings(username: string): Promise<LetterboxdRating[]> {
    const films = await this.paginateFilms(username, 'films/ratings');
    return films.filter((f): f is LetterboxdRating => f.rating !== null);
  }

  async getDiary(username: string): Promise<LetterboxdDiaryEntry[]> {
    const films = await this.paginateFilms(username, 'films/diary');
    return films.map((f) => ({
      ...f,
      watchedDate: null,
      review: null,
    }));
  }

  async getWatchlist(username: string): Promise<LetterboxdFilm[]> {
    return this.paginateFilms(username, 'watchlist');
  }

  private async paginateFilms(username: string, path: string): Promise<LetterboxdFilm[]> {
    const normalized = normalizeUsername(username);
    const all: LetterboxdFilm[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= this.maxPages; page++) {
      const url =
        page === 1
          ? `${LETTERBOXD_BASE_URL}/${normalized}/${path}/`
          : `${LETTERBOXD_BASE_URL}/${normalized}/${path}/page/${page}/`;

      try {
        const html = await this.http.getText(url);
        const films = parseFilmsPageHtml(html);

        for (const film of films) {
          if (seen.has(film.slug)) continue;
          seen.add(film.slug);
          all.push(film);
        }

        const hasNext = parseHasNextPage(html);
        if (!hasNext || films.length === 0) break;

        if (this.pageDelayMs > 0) {
          await sleep(this.pageDelayMs);
        }
      } catch (error) {
        if (page === 1) {
          this.logger.error({ err: error, username: normalized, path }, 'Failed to scrape Letterboxd films');
          if (error instanceof ExternalServiceError && (error.details as { status?: number })?.status === 404) {
            throw new NotFoundError(`Letterboxd user "${normalized}" not found`);
          }
          throw error;
        }
        this.logger.warn({ err: error, username: normalized, path, page }, 'Stopped pagination early');
        break;
      }
    }

    return all;
  }
}
