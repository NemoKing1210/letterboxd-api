import { createHash } from 'node:crypto';
import type { Movie, UserMovie } from '@prisma/client';
import {
  TASTE_FAVORITE_BOOST,
  TASTE_MAX_ANCHORS,
  TASTE_RATING_THRESHOLD,
} from '../../../shared/constants';

export type TasteAnchor = {
  movie: Movie;
  weight: number;
  rating: number | null;
  favorite: boolean;
};

export function buildMovieEmbeddingText(movie: Pick<Movie, 'title' | 'year' | 'director' | 'genres'>): string {
  const year = movie.year != null ? ` (${movie.year})` : '';
  const director = movie.director?.trim() || 'unknown';
  const genres = movie.genres.length > 0 ? movie.genres.join(', ') : 'unknown';
  return `Title: ${movie.title}${year}\nDirector: ${director}\nGenres: ${genres}`;
}

export function selectTasteAnchors(
  entries: Array<UserMovie & { movie: Movie }>,
  maxAnchors = TASTE_MAX_ANCHORS,
): TasteAnchor[] {
  const anchors: TasteAnchor[] = [];

  for (const entry of entries) {
    const qualifies =
      entry.favorite || (entry.rating !== null && entry.rating >= TASTE_RATING_THRESHOLD);
    if (!qualifies) {
      continue;
    }

    const ratingWeight = entry.rating ?? TASTE_RATING_THRESHOLD;
    const weight = ratingWeight * (entry.favorite ? TASTE_FAVORITE_BOOST : 1);
    anchors.push({
      movie: entry.movie,
      weight,
      rating: entry.rating,
      favorite: entry.favorite,
    });
  }

  return anchors
    .sort((a, b) => b.weight - a.weight || a.movie.title.localeCompare(b.movie.title))
    .slice(0, maxAnchors);
}

export function computeTasteSourceHash(anchors: TasteAnchor[]): string {
  const payload = anchors
    .map((anchor) => `${anchor.movie.id}:${anchor.rating ?? ''}:${anchor.favorite ? 1 : 0}`)
    .join('|');
  return createHash('sha256').update(payload).digest('hex');
}

export function weightedAverageEmbedding(
  items: Array<{ embedding: number[]; weight: number }>,
): number[] | null {
  if (items.length === 0) {
    return null;
  }

  const dimensions = items[0]?.embedding.length ?? 0;
  if (dimensions === 0 || items.some((item) => item.embedding.length !== dimensions)) {
    throw new Error('Cannot average embeddings with mismatched dimensions');
  }

  const sums = new Array<number>(dimensions).fill(0);
  let totalWeight = 0;

  for (const item of items) {
    if (item.weight <= 0) continue;
    totalWeight += item.weight;
    for (let i = 0; i < dimensions; i++) {
      sums[i]! += item.embedding[i]! * item.weight;
    }
  }

  if (totalWeight <= 0) {
    return null;
  }

  const averaged = sums.map((value) => value / totalWeight);
  return l2Normalize(averaged);
}

export function l2Normalize(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return values.map(() => 0);
  }
  return values.map((value) => value / norm);
}

export function distanceToScore(distance: number): number {
  // Cosine distance in pgvector is 1 - cosine_similarity for normalized vectors.
  return Math.max(0, 1 - distance);
}
