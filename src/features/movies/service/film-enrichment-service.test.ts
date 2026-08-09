import { describe, expect, it, vi } from 'vitest';
import type { Movie, UserMovie } from '@prisma/client';
import { FilmEnrichmentService } from './film-enrichment-service';
import type { MovieProvider } from '../../../infrastructure/letterboxd';
import type { MovieRepository } from '../../../infrastructure/database';
import type { AppLogger } from '../../../infrastructure/logger';

function createLogger(): AppLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  } as unknown as AppLogger;
}

function movie(partial: Partial<Movie> & Pick<Movie, 'id' | 'slug' | 'title'>): Movie {
  return {
    year: null,
    tmdbId: null,
    poster: null,
    genres: [],
    director: null,
    enriched: false,
    ...partial,
  };
}

describe('FilmEnrichmentService', () => {
  it('enriches only non-enriched movies and marks enriched', async () => {
    const pending = movie({ id: 'm1', slug: 'inception', title: 'Inception', year: 2010 });
    const already = movie({
      id: 'm2',
      slug: 'arrival',
      title: 'Arrival',
      year: 2016,
      enriched: true,
      genres: ['sci-fi'],
      director: 'Denis Villeneuve',
      poster: 'https://a.ltrbxd.com/arrival.jpg',
    });

    const enrichedRow = movie({
      id: 'm1',
      slug: 'inception',
      title: 'Inception',
      year: 2010,
      enriched: true,
      genres: ['sci-fi', 'action'],
      director: 'Christopher Nolan',
      poster: 'https://a.ltrbxd.com/inception.jpg',
    });

    const getFilmDetails = vi.fn(async () => ({
      slug: 'inception',
      title: 'Inception',
      year: 2010,
      poster: 'https://a.ltrbxd.com/inception.jpg',
      genres: ['sci-fi', 'action'],
      director: 'Christopher Nolan',
    }));

    const upsertBySlug = vi.fn(async () => enrichedRow);
    const movies: MovieRepository = {
      findBySlugs: vi.fn(),
      upsertBySlug,
    };

    const provider: MovieProvider = {
      getProfile: vi.fn(),
      getMovies: vi.fn(),
      getRatings: vi.fn(),
      getDiary: vi.fn(),
      getWatchlist: vi.fn(),
      getFilmDetails,
    };

    const service = new FilmEnrichmentService({
      movieProvider: provider,
      movies,
      logger: createLogger(),
      concurrency: 2,
    });

    const entry = (m: Movie): UserMovie & { movie: Movie } => ({
      id: `um-${m.id}`,
      userId: 'u1',
      movieId: m.id,
      rating: 5,
      favorite: false,
      watchedDate: null,
      movie: m,
    });

    const result = await service.enrichEntries([entry(pending), entry(already)]);

    expect(getFilmDetails).toHaveBeenCalledOnce();
    expect(getFilmDetails).toHaveBeenCalledWith('inception');
    expect(upsertBySlug).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'inception',
        enriched: true,
        director: 'Christopher Nolan',
      }),
    );
    expect(result[0]?.movie.enriched).toBe(true);
    expect(result[1]?.movie.enriched).toBe(true);
  });

  it('skips work when all movies are already enriched', async () => {
    const getFilmDetails = vi.fn();
    const service = new FilmEnrichmentService({
      movieProvider: {
        getProfile: vi.fn(),
        getMovies: vi.fn(),
        getRatings: vi.fn(),
        getDiary: vi.fn(),
        getWatchlist: vi.fn(),
        getFilmDetails,
      },
      movies: { findBySlugs: vi.fn(), upsertBySlug: vi.fn() },
      logger: createLogger(),
    });

    const m = movie({
      id: 'm1',
      slug: 'inception',
      title: 'Inception',
      enriched: true,
    });

    await service.enrichEntries([
      {
        id: 'um1',
        userId: 'u1',
        movieId: m.id,
        rating: null,
        favorite: false,
        watchedDate: null,
        movie: m,
      },
    ]);

    expect(getFilmDetails).not.toHaveBeenCalled();
  });
});
