import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  extractSlug,
  parseFilmsPageHtml,
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

  it('parses films page HTML', () => {
    const html = readFileSync(join(fixturesDir, 'films.html'), 'utf8');
    const films = parseFilmsPageHtml(html);

    expect(films).toHaveLength(3);
    expect(films[0]).toMatchObject({
      slug: 'inception',
      title: 'Inception',
      year: 2010,
      rating: 4.5,
      liked: true,
    });
    expect(films[1]?.rating).toBe(5);
    expect(films[2]?.slug).toBe('tenet');
  });
});
