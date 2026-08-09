import { describe, expect, it } from 'vitest';
import {
  average,
  backoffDelayMs,
  decadeFromYear,
  extractYearFromTitle,
  filmPageUrl,
  isPlaceholderPoster,
  isRetryableExternalError,
  mapWithConcurrency,
  normalizeUsername,
  topN,
  withRetry,
} from './index';
import { ExternalServiceError, NotFoundError } from '../errors/app-error';

describe('shared utils', () => {
  it('normalizes usernames', () => {
    expect(normalizeUsername('@DemoUser')).toBe('demouser');
  });

  it('computes averages', () => {
    expect(average([4, 5, 4.5])).toBe(4.5);
    expect(average([])).toBeNull();
  });

  it('maps years to decades', () => {
    expect(decadeFromYear(2010)).toBe('2010s');
    expect(decadeFromYear(1999)).toBe('1990s');
  });

  it('returns top N counts', () => {
    const map = new Map([
      ['a', 3],
      ['b', 10],
      ['c', 1],
    ]);
    expect(topN(map, 2)).toEqual([
      { name: 'b', count: 10 },
      { name: 'a', count: 3 },
    ]);
  });

  it('extracts year from titles', () => {
    expect(extractYearFromTitle('Crash (1996)')).toEqual({ title: 'Crash', year: 1996 });
    expect(extractYearFromTitle('Inception')).toEqual({ title: 'Inception', year: null });
  });

  it('detects placeholder posters', () => {
    expect(isPlaceholderPoster('https://s.ltrbxd.com/static/img/empty-poster-70.png')).toBe(true);
    expect(isPlaceholderPoster('https://a.ltrbxd.com/resized/film-poster.jpg')).toBe(false);
    expect(isPlaceholderPoster(null)).toBe(true);
  });

  it('builds film page urls', () => {
    expect(filmPageUrl('arrival', 'https://letterboxd.com')).toBe(
      'https://letterboxd.com/film/arrival/',
    );
  });

  it('maps with concurrency', async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8]);
  });

  it('computes jittered backoff within exponential cap', () => {
    expect(backoffDelayMs(0, { baseMs: 100, maxMs: 1000, random: () => 0 })).toBe(0);
    expect(backoffDelayMs(0, { baseMs: 100, maxMs: 1000, random: () => 0.999 })).toBe(99);
    expect(backoffDelayMs(3, { baseMs: 100, maxMs: 500, random: () => 1 })).toBe(500);
  });

  it('withRetry succeeds after transient failures', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new ExternalServiceError('transient', { status: 503 });
        }
        return 'ok';
      },
      { maxAttempts: 3, baseMs: 1, maxMs: 1, random: () => 0 },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('withRetry does not retry NotFoundError', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new NotFoundError('missing');
        },
        { maxAttempts: 3, baseMs: 1, maxMs: 1, random: () => 0 },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(calls).toBe(1);
  });

  it('classifies retryable external errors', () => {
    expect(isRetryableExternalError(new ExternalServiceError('x', { status: 429 }))).toBe(true);
    expect(isRetryableExternalError(new ExternalServiceError('x', { status: 503 }))).toBe(true);
    expect(isRetryableExternalError(new ExternalServiceError('x', { status: 404 }))).toBe(false);
    expect(isRetryableExternalError(new NotFoundError())).toBe(false);
  });
});
