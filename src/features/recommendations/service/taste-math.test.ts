import { describe, expect, it } from 'vitest';
import {
  buildMovieEmbeddingText,
  computeTasteSourceHash,
  distanceToScore,
  l2Normalize,
  selectTasteAnchors,
  weightedAverageEmbedding,
} from './taste-math';
import { parseVectorText, toVectorLiteral } from '../../../infrastructure/database/embedding-repository';
import { OPENAI_EMBEDDING_DIMENSIONS } from '../../../shared/constants';

function movie(partial: {
  id: string;
  title: string;
  director?: string | null;
  genres?: string[];
  year?: number | null;
}) {
  return {
    id: partial.id,
    title: partial.title,
    year: partial.year ?? 2000,
    tmdbId: null,
    poster: null,
    genres: partial.genres ?? ['drama'],
    director: partial.director ?? 'Nolan',
    slug: partial.id,
    enriched: true,
  };
}

describe('taste-math', () => {
  it('builds deterministic movie embedding text', () => {
    expect(
      buildMovieEmbeddingText({
        title: 'Inception',
        year: 2010,
        director: 'Christopher Nolan',
        genres: ['sci-fi', 'thriller'],
      }),
    ).toBe('Title: Inception (2010)\nDirector: Christopher Nolan\nGenres: sci-fi, thriller');
  });

  it('selects highly rated and favorite anchors', () => {
    const anchors = selectTasteAnchors([
      {
        id: '1',
        userId: 'u',
        movieId: 'a',
        rating: 4.5,
        favorite: false,
        watchedDate: null,
        movie: movie({ id: 'a', title: 'A' }),
      },
      {
        id: '2',
        userId: 'u',
        movieId: 'b',
        rating: 2,
        favorite: false,
        watchedDate: null,
        movie: movie({ id: 'b', title: 'B' }),
      },
      {
        id: '3',
        userId: 'u',
        movieId: 'c',
        rating: 3,
        favorite: true,
        watchedDate: null,
        movie: movie({ id: 'c', title: 'C' }),
      },
    ]);

    expect(anchors.map((a) => a.movie.id)).toEqual(['a', 'c']);
  });

  it('hashes taste sources stably', () => {
    const anchors = selectTasteAnchors([
      {
        id: '1',
        userId: 'u',
        movieId: 'a',
        rating: 5,
        favorite: true,
        watchedDate: null,
        movie: movie({ id: 'a', title: 'A' }),
      },
    ]);
    expect(computeTasteSourceHash(anchors)).toEqual(computeTasteSourceHash(anchors));
  });

  it('averages and L2-normalizes embeddings', () => {
    const result = weightedAverageEmbedding([
      { embedding: [1, 0], weight: 1 },
      { embedding: [0, 1], weight: 1 },
    ]);
    expect(result).not.toBeNull();
    const norm = Math.sqrt((result![0]! ** 2) + (result![1]! ** 2));
    expect(norm).toBeCloseTo(1);
  });

  it('maps cosine distance to score', () => {
    expect(distanceToScore(0)).toBe(1);
    expect(distanceToScore(0.25)).toBe(0.75);
    expect(l2Normalize([3, 4])).toEqual([0.6, 0.8]);
  });
});

describe('vector literals', () => {
  it('round-trips vector text', () => {
    const values = Array.from({ length: OPENAI_EMBEDDING_DIMENSIONS }, (_, i) => i / 1000);
    const literal = toVectorLiteral(values);
    expect(parseVectorText(literal)).toEqual(values);
  });
});
