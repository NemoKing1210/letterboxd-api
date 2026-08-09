import type { Movie, UserMovie } from '@prisma/client';
import type { MovieRepository } from '../../../infrastructure/database';
import type { MovieProvider } from '../../../infrastructure/letterboxd';
import type { AppLogger } from '../../../infrastructure/logger';
import {
  DEFAULT_ENRICH_CONCURRENCY,
  DEFAULT_ENRICH_RETRIES,
} from '../../../shared/constants';
import { NotFoundError } from '../../../shared/errors/app-error';
import {
  isPlaceholderPoster,
  isRetryableExternalError,
  mapWithConcurrency,
  getRequestDeadline,
  withRetry,
} from '../../../shared/utils';
import { realPoster } from '../../synchronization/service/merge-film-metadata';

export type UserMovieWithFilm = UserMovie & { movie: Movie };

export type FilmEnrichmentServiceDeps = {
  movieProvider: MovieProvider;
  movies: MovieRepository;
  logger: AppLogger;
  concurrency?: number;
  maxAttempts?: number;
};

/**
 * On-demand Letterboxd film-page enrichment for movies that appear in API responses.
 * Persists `Movie.enriched` (internal flag, not exposed in DTOs).
 */
export class FilmEnrichmentService {
  private readonly concurrency: number;
  private readonly maxAttempts: number;

  constructor(private readonly deps: FilmEnrichmentServiceDeps) {
    this.concurrency = deps.concurrency ?? DEFAULT_ENRICH_CONCURRENCY;
    this.maxAttempts = deps.maxAttempts ?? DEFAULT_ENRICH_RETRIES;
  }

  async enrichEntries(entries: UserMovieWithFilm[]): Promise<UserMovieWithFilm[]> {
    const pending = entries.filter((entry) => !entry.movie.enriched && entry.movie.slug);
    if (pending.length === 0) {
      return entries;
    }

    const uniqueBySlug = new Map<string, Movie>();
    for (const entry of pending) {
      const slug = entry.movie.slug!;
      if (!uniqueBySlug.has(slug)) {
        uniqueBySlug.set(slug, entry.movie);
      }
    }

    const enrichedMovies = await mapWithConcurrency(
      [...uniqueBySlug.values()],
      this.concurrency,
      async (movie) => {
        const deadline = getRequestDeadline();
        if (deadline?.isExpired()) {
          this.deps.logger.warn(
            {
              slug: movie.slug,
              movieId: movie.id,
              remainingMs: deadline.remainingMs(),
              budgetMs: deadline.budgetMs,
            },
            'Skipping on-demand film enrichment to respect request budget',
          );
          return movie;
        }
        return this.enrichOne(movie);
      },
    );

    const byId = new Map(enrichedMovies.map((movie) => [movie.id, movie]));

    return entries.map((entry) => {
      const updated = byId.get(entry.movie.id);
      return updated ? { ...entry, movie: updated } : entry;
    });
  }

  private async enrichOne(movie: Movie): Promise<Movie> {
    const slug = movie.slug;
    if (!slug) {
      return movie;
    }

    try {
      return await withRetry(() => this.fetchAndPersist(movie, slug), {
        maxAttempts: this.maxAttempts,
        isRetryable: isRetryableExternalError,
        onRetry: (error, attempt, delayMs) => {
          this.deps.logger.warn(
            { err: error, slug, movieId: movie.id, attempt, delayMs, maxAttempts: this.maxAttempts },
            'Retrying on-demand film enrichment',
          );
        },
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        this.deps.logger.warn({ slug, movieId: movie.id }, 'Film not found during enrichment; marking enriched');
        return this.markEnriched(movie);
      }

      this.deps.logger.warn(
        { err: error, slug, movieId: movie.id, attempts: this.maxAttempts },
        'On-demand film enrichment failed after retries; will retry on a later request',
      );
      return movie;
    }
  }

  private async fetchAndPersist(movie: Movie, slug: string): Promise<Movie> {
    const details = await this.deps.movieProvider.getFilmDetails(slug);
    const poster = realPoster(details.poster) ?? realPoster(movie.poster);

    return this.deps.movies.upsertBySlug({
      slug,
      title: details.title || movie.title,
      year: details.year ?? movie.year,
      poster,
      genres: details.genres.length > 0 ? details.genres : movie.genres,
      director: details.director ?? movie.director,
      enriched: true,
    });
  }

  private markEnriched(movie: Movie): Promise<Movie> {
    const slug = movie.slug;
    if (!slug) {
      return Promise.resolve(movie);
    }

    return this.deps.movies.upsertBySlug({
      slug,
      title: movie.title,
      year: movie.year,
      poster: isPlaceholderPoster(movie.poster) ? null : movie.poster,
      genres: movie.genres,
      director: movie.director,
      enriched: true,
    });
  }
}
