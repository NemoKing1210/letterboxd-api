import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  extractSlug,
  parseDiaryPageHtml,
  parseFilmPageHtml,
  parseFilmsPageHtml,
  parsePosterJson,
  parseProfileHtml,
  parseStars,
} from './parsers';

const fixturesDir = join(import.meta.dirname, '../../../tests/fixtures/letterboxd');

describe('Letterboxd parsers', () => {
  it('parses star ratings', () => {
    expect(parseStars('★★★★½')).toBe(4.5);
    expect(parseStars('★★★★★')).toBe(5);
    expect(parseStars('')).toBeNull();
    expect(parseStars(null)).toBeNull();
  });

  it('extracts film slugs from hrefs', () => {
    expect(extractSlug('/film/inception/')).toBe('inception');
    expect(extractSlug('/film/the-dark-knight/reviews/')).toBe('the-dark-knight');
    expect(extractSlug('/list/foo/')).toBeNull();
  });

  it('parses profile HTML', () => {
    const html = readFileSync(join(fixturesDir, 'profile.html'), 'utf8');
    const profile = parseProfileHtml(html, 'demouser');

    expect(profile.username).toBe('demouser');
    expect(profile.displayName).toBe('Demo User');
    expect(profile.filmsCount).toBe(3);
    expect(profile.bio).toBe('Film enthusiast');
  });

  it('parses films page HTML with year-from-title and placeholder posters', () => {
    const html = readFileSync(join(fixturesDir, 'films.html'), 'utf8');
    const films = parseFilmsPageHtml(html);

    expect(films).toHaveLength(3);
    expect(films[0]).toMatchObject({
      slug: 'inception',
      title: 'Inception',
      year: 2010,
      rating: 4.5,
      liked: true,
      poster: null,
    });
    expect(films[1]).toMatchObject({
      slug: 'the-dark-knight',
      title: 'The Dark Knight',
      year: 2008,
      rating: 5,
      poster: 'https://example.com/tdk.jpg',
    });
    expect(films[2]?.slug).toBe('tenet');
    expect(films[2]?.year).toBe(2020);
    expect(films[2]?.poster).toBeNull();
  });

  it('parses film detail JSON-LD', () => {
    const html = readFileSync(join(fixturesDir, 'film-detail.html'), 'utf8');
    const details = parseFilmPageHtml(html, 'the-piano-teacher');

    expect(details).toMatchObject({
      slug: 'the-piano-teacher',
      title: 'The Piano Teacher',
      year: 2001,
      director: 'Michael Haneke',
      poster: 'https://a.ltrbxd.com/resized/film-poster/50791-the-piano-teacher-0-600-0-900-crop.jpg',
      genres: ['romance', 'drama'],
    });
  });

  it('parses diary entries with watched dates', () => {
    const html = readFileSync(join(fixturesDir, 'diary.html'), 'utf8');
    const entries = parseDiaryPageHtml(html);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      slug: 'inception',
      title: 'Inception',
      year: 2010,
      liked: true,
      watchedDate: '2024-06-01T00:00:00.000Z',
    });
    expect(entries[1]).toMatchObject({
      slug: 'arrival',
      watchedDate: '2024-05-15T00:00:00.000Z',
    });
  });

  it('parses poster JSON payloads', () => {
    expect(
      parsePosterJson(
        JSON.stringify({
          url: 'https://a.ltrbxd.com/poster.jpg',
          url2x: 'https://a.ltrbxd.com/poster-2x.jpg',
        }),
      ),
    ).toBe('https://a.ltrbxd.com/poster.jpg');
    expect(parsePosterJson('{bad')).toBeNull();
  });
});
