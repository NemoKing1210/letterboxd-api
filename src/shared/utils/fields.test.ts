import { describe, expect, it } from 'vitest';
import {
  MOVIE_DTO_FIELDS,
  applyItemFields,
  applyObjectFields,
  fieldsQueryField,
  mapItemsFields,
  parseFields,
  pickFields,
  FieldsValidationError,
} from './fields';

describe('parseFields', () => {
  it('returns undefined for missing or blank input', () => {
    expect(parseFields(undefined, MOVIE_DTO_FIELDS)).toBeUndefined();
    expect(parseFields('', MOVIE_DTO_FIELDS)).toBeUndefined();
    expect(parseFields('  ,  , ', MOVIE_DTO_FIELDS)).toBeUndefined();
  });

  it('parses, trims, dedupes, and preserves order', () => {
    expect(parseFields(' year,title, year ,rating ', MOVIE_DTO_FIELDS)).toEqual([
      'year',
      'title',
      'rating',
    ]);
  });

  it('rejects unknown fields', () => {
    expect(() => parseFields('title,nope', MOVIE_DTO_FIELDS)).toThrow(FieldsValidationError);
  });
});

describe('pickFields / mapItemsFields / apply*', () => {
  const movie = {
    id: '1',
    title: 'Arrival',
    year: 2016,
    rating: 4.5,
  };

  it('picks keys in requested order', () => {
    expect(pickFields(movie, ['title', 'year'])).toEqual({ title: 'Arrival', year: 2016 });
  });

  it('maps items when fields set', () => {
    expect(mapItemsFields([movie], ['title'])).toEqual([{ title: 'Arrival' }]);
    expect(mapItemsFields([movie], undefined)).toEqual([movie]);
  });

  it('applies item fields keeping envelope', () => {
    const result = applyItemFields(
      { items: [movie], page: 1, limit: 20, total: 1, totalPages: 1 },
      ['title'],
    );
    expect(result).toEqual({
      items: [{ title: 'Arrival' }],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('applies object fields', () => {
    expect(applyObjectFields({ a: 1, b: 2, c: 3 }, ['b', 'a'])).toEqual({ b: 2, a: 1 });
    expect(applyObjectFields({ a: 1 }, undefined)).toEqual({ a: 1 });
  });
});

describe('fieldsQueryField', () => {
  const schema = fieldsQueryField(MOVIE_DTO_FIELDS);

  it('transforms valid CSV to string[]', () => {
    expect(schema.parse('title,year')).toEqual(['title', 'year']);
  });

  it('accepts omitted fields', () => {
    expect(schema.parse(undefined)).toBeUndefined();
  });

  it('rejects unknown names', () => {
    expect(schema.safeParse('title,bad').success).toBe(false);
  });
});
