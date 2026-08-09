import { describe, expect, it } from 'vitest';
import { SEARCH_MAX_DEPTH } from '../../../shared/constants';
import { ValidationError } from '../../../shared/errors/app-error';
import type { SearchFilterNode } from '../schemas/search-schemas';
import { searchBodySchema } from '../schemas/search-schemas';
import { buildSearchWhere } from './build-search-where';

describe('searchBodySchema', () => {
  it('applies defaults', () => {
    const body = searchBodySchema.parse({});
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(body.sort).toBe('rating_desc');
    expect(body.filter).toBeUndefined();
  });

  it('accepts nested filter groups', () => {
    const body = searchBodySchema.parse({
      filter: {
        op: 'and',
        conditions: [
          { field: 'title', op: 'contains', value: 'matrix' },
          {
            op: 'or',
            conditions: [
              { field: 'genre', op: 'eq', value: 'sci-fi' },
              { field: 'year', op: 'gte', value: 1990 },
            ],
          },
        ],
      },
    });
    expect(body.filter).toBeDefined();
  });
});

describe('buildSearchWhere', () => {
  it('returns undefined for empty filter', () => {
    expect(buildSearchWhere(undefined)).toBeUndefined();
  });

  it('builds title contains filter', () => {
    expect(buildSearchWhere({ field: 'title', op: 'contains', value: 'matrix' })).toEqual({
      movie: { title: { contains: 'matrix', mode: 'insensitive' } },
    });
  });

  it('builds AND/OR groups', () => {
    const where = buildSearchWhere({
      op: 'and',
      conditions: [
        { field: 'director', op: 'contains', value: 'Nolan' },
        {
          op: 'or',
          conditions: [
            { field: 'genre', op: 'eq', value: 'Sci-Fi' },
            { field: 'year', op: 'between', value: 2000, valueTo: 2010 },
          ],
        },
      ],
    });
    expect(where).toEqual({
      AND: [
        { movie: { director: { contains: 'Nolan', mode: 'insensitive' } } },
        {
          OR: [
            { movie: { genres: { has: 'sci-fi' } } },
            { movie: { year: { gte: 2000, lte: 2010 } } },
          ],
        },
      ],
    });
  });

  it('builds rating and favorite atoms', () => {
    expect(buildSearchWhere({ field: 'rating', op: 'gte', value: 4 })).toEqual({
      rating: { gte: 4 },
    });
    expect(buildSearchWhere({ field: 'favorite', op: 'eq', value: true })).toEqual({
      favorite: true,
    });
  });

  it('rejects invalid operator for field', () => {
    expect(() =>
      buildSearchWhere({ field: 'title', op: 'gte', value: 'x' }),
    ).toThrow(ValidationError);
  });

  it('rejects filter deeper than max depth', () => {
    let node: SearchFilterNode = { field: 'title', op: 'eq', value: 'a' };
    for (let i = 0; i <= SEARCH_MAX_DEPTH; i += 1) {
      node = { op: 'and', conditions: [node] };
    }
    expect(() => buildSearchWhere(node)).toThrow(ValidationError);
  });
});
