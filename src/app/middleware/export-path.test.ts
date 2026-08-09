import { describe, expect, it } from 'vitest';
import { isExportPath } from './index';

describe('isExportPath', () => {
  it('detects movies and favorites export paths', () => {
    expect(isExportPath('/api/users/demo/movies/export/json')).toBe(true);
    expect(isExportPath('/api/users/demo/favorites/export/csv')).toBe(true);
  });

  it('ignores non-export paths', () => {
    expect(isExportPath('/api/users/demo/movies')).toBe(false);
    expect(isExportPath('/api/users/demo/favorites')).toBe(false);
    expect(isExportPath('/api/users/demo/movies/export/xml')).toBe(false);
  });
});
