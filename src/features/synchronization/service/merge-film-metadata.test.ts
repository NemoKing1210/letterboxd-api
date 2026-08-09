import { describe, expect, it } from 'vitest';
import { realPoster } from './merge-film-metadata';

describe('realPoster', () => {
  it('nulls placeholder posters', () => {
    expect(realPoster('https://s.ltrbxd.com/static/img/empty-poster-70.png')).toBeNull();
    expect(realPoster('https://a.ltrbxd.com/poster.jpg')).toBe('https://a.ltrbxd.com/poster.jpg');
    expect(realPoster(null)).toBeNull();
  });
});
