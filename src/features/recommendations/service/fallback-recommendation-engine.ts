import type { AppLogger } from '../../../infrastructure/logger';
import type {
  Recommendation,
  RecommendationEngine,
  RecommendationOptions,
} from '../types/recommendation-engine';

export type FallbackRecommendationEngineDeps = {
  primary: RecommendationEngine;
  fallback: RecommendationEngine;
  logger: AppLogger;
};

/**
 * Tries the AI engine first; on empty taste / empty pool / provider failure uses rule-based.
 */
export class FallbackRecommendationEngine implements RecommendationEngine {
  constructor(private readonly deps: FallbackRecommendationEngineDeps) {}

  async recommend(username: string, options?: RecommendationOptions): Promise<Recommendation[]> {
    try {
      return await this.deps.primary.recommend(username, options);
    } catch (error) {
      this.deps.logger.warn(
        { err: error, username },
        'AI recommendations unavailable; using rule-based fallback',
      );
      return this.deps.fallback.recommend(username, options);
    }
  }
}
