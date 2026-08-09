import { describe, expect, it } from 'vitest';
import {
  movieQuerySchema,
  resolveUserListSearch,
  usernameParamSchema,
  userQuerySchema,
} from './user-schemas';

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

  it('accepts q and search aliases when identical', () => {
    const withQ = movieQuerySchema.parse({ q: 'matrix' });
    expect(withQ.q).toBe('matrix');
    const withSearch = movieQuerySchema.parse({ search: 'matrix' });
    expect(withSearch.search).toBe('matrix');
    const both = movieQuerySchema.parse({ q: 'matrix', search: 'matrix' });
    expect(both.q).toBe('matrix');
  });

  it('rejects conflicting q and search', () => {
    expect(() => movieQuerySchema.parse({ q: 'a', search: 'b' })).toThrow();
  });

  it('rejects movie list limits above 100', () => {
    expect(() => movieQuerySchema.parse({ limit: '101' })).toThrow();
  });

  it('applies user query defaults', () => {
    const query = userQuerySchema.parse({});
    expect(query.page).toBe(1);
    expect(query.limit).toBe(20);
    expect(query.sort).toBe('username_asc');
  });

  it('parses user filters and resolves search alias', () => {
    const query = userQuerySchema.parse({
      followersMin: '10',
      moviesMax: '500',
      search: 'demo',
      sort: 'movies_desc',
    });
    expect(query.followersMin).toBe(10);
    expect(query.moviesMax).toBe(500);
    expect(query.sort).toBe('movies_desc');
    expect(resolveUserListSearch(query)).toBe('demo');
  });

  it('rejects conflicting user q and search', () => {
    expect(() => userQuerySchema.parse({ q: 'a', search: 'b' })).toThrow();
  });

  it('rejects inverted user range filters', () => {
    expect(() => userQuerySchema.parse({ followersMin: '10', followersMax: '5' })).toThrow();
    expect(() => userQuerySchema.parse({ moviesMin: '20', moviesMax: '1' })).toThrow();
  });
});
