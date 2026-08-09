import { describe, expect, it, vi } from 'vitest';
import { FallbackRecommendationEngine } from './fallback-recommendation-engine';
import type { RecommendationEngine } from '../types/recommendation-engine';
import type { AppLogger } from '../../../infrastructure/logger';

describe('FallbackRecommendationEngine', () => {
  it('returns primary results when AI succeeds', async () => {
    const primary: RecommendationEngine = {
      recommend: vi.fn(async () => [
        { title: 'AI pick', reason: 'because', score: 0.9, basedOn: ['X'] },
      ]),
    };
    const fallback: RecommendationEngine = {
      recommend: vi.fn(async () => []),
    };
    const logger = { warn: vi.fn() } as unknown as AppLogger;

    const engine = new FallbackRecommendationEngine({ primary, fallback, logger });
    const items = await engine.recommend('user');
    expect(items[0]?.title).toBe('AI pick');
    expect(fallback.recommend).not.toHaveBeenCalled();
  });

  it('falls back when primary throws', async () => {
    const primary: RecommendationEngine = {
      recommend: vi.fn(async () => {
        throw new Error('AI_EMPTY_CANDIDATE_POOL');
      }),
    };
    const fallback: RecommendationEngine = {
      recommend: vi.fn(async () => [
        { title: 'More films by Nolan', reason: 'rules', score: 2, basedOn: ['Nolan'] },
      ]),
    };
    const logger = { warn: vi.fn() } as unknown as AppLogger;

    const engine = new FallbackRecommendationEngine({ primary, fallback, logger });
    const items = await engine.recommend('user');
    expect(items[0]?.title).toContain('Nolan');
    expect(logger.warn).toHaveBeenCalled();
  });
});
