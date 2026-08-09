import { describe, expect, it } from 'vitest';
import { movieQuerySchema, usernameParamSchema } from './user-schemas';

describe('user schemas', () => {
  it('accepts valid usernames', () => {
    expect(usernameParamSchema.parse({ username: 'demo_user' }).username).toBe('demo_user');
  });

  it('rejects invalid usernames', () => {
    expect(() => usernameParamSchema.parse({ username: 'bad user' })).toThrow();
  });

  it('applies movie query defaults', () => {
    const query = movieQuerySchema.parse({});
    expect(query.page).toBe(1);
    expect(query.limit).toBe(20);
    expect(query.sort).toBe('rating_desc');
  });

  it('parses movie filters', () => {
    const query = movieQuerySchema.parse({
      ratingMin: '4',
      yearFrom: '2000',
      genre: 'sci-fi',
      sort: 'year_desc',
    });
    expect(query.ratingMin).toBe(4);
    expect(query.yearFrom).toBe(2000);
    expect(query.genre).toBe('sci-fi');
  });

  it('rejects movie list limits above 100', () => {
    expect(() => movieQuerySchema.parse({ limit: '101' })).toThrow();
  });
});
