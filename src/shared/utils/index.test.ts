import { describe, expect, it } from 'vitest';
import { average, decadeFromYear, normalizeUsername, topN } from './index';

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
});
