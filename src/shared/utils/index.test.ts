import { describe, expect, it } from 'vitest';
import {
  average,
  decadeFromYear,
  extractYearFromTitle,
  filmPageUrl,
  isPlaceholderPoster,
  mapWithConcurrency,
  normalizeUsername,
  topN,
} from './index';

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
});
