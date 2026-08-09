import { describe, expect, it } from 'vitest';
import { MAX_EXPORT_LIMIT } from '../../../shared/constants';
import { movieExportQuerySchema } from './export-schemas';

describe('movieExportQuerySchema', () => {
  it('allows omitting limit and page', () => {
    const parsed = movieExportQuerySchema.parse({});
    expect(parsed.limit).toBeUndefined();
    expect(parsed.page).toBeUndefined();
    expect(parsed.sort).toBe('rating_desc');
  });

  it('accepts an explicit limit within export max', () => {
    const parsed = movieExportQuerySchema.parse({ limit: '50', page: '2' });
    expect(parsed.limit).toBe(50);
    expect(parsed.page).toBe(2);
  });

  it('rejects limit above MAX_EXPORT_LIMIT', () => {
    const result = movieExportQuerySchema.safeParse({ limit: MAX_EXPORT_LIMIT + 1 });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched q and search', () => {
    const result = movieExportQuerySchema.safeParse({ q: 'a', search: 'b' });
    expect(result.success).toBe(false);
  });
});
