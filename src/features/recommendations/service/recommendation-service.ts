import type { UserMovieRepository, UserRepository } from '../../../infrastructure/database';
import { countBy, normalizeUsername, topN } from '../../../shared/utils';
import {
  ensureLocalUser,
  type UserSyncTrigger,
} from '../../users/service/ensure-local-user';
import type {
  Recommendation,
  RecommendationEngine,
  RecommendationOptions,
} from '../types/recommendation-engine';

export type RuleBasedRecommendationEngineDeps = {
  users: UserRepository;
  userMovies: UserMovieRepository;
  syncService: UserSyncTrigger;
  autoSyncIfMissing?: boolean;
};

/**
 * Rule-based stub. Replace with OpenAI / embeddings / RAG in v3 without changing callers.
 */
export class RuleBasedRecommendationEngine implements RecommendationEngine {
  constructor(private readonly deps: RuleBasedRecommendationEngineDeps) {}

  async recommend(username: string, options: RecommendationOptions = {}): Promise<Recommendation[]> {
    const limit = options.limit ?? 5;
    const normalized = normalizeUsername(username);
    const user = await ensureLocalUser(normalized, this.deps);

    const entries = await this.deps.userMovies.findAllForUser(user.id);
    const highlyRated = entries.filter((e) => e.rating !== null && e.rating >= 4);

    const topDirectors = topN(countBy(highlyRated, (e) => e.movie.director), 3);
    const genreCounts = new Map<string, number>();
    for (const entry of highlyRated) {
      for (const genre of entry.movie.genres) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }
    }
    const topGenres = topN(genreCounts, 3);

    const recommendations: Recommendation[] = [];

    for (const director of topDirectors) {
      recommendations.push({
        title: `More films by ${director.name}`,
        reason: `You rated ${director.count} films by this director highly`,
        score: director.count,
        basedOn: [director.name],
      });
    }

    for (const genre of topGenres) {
      recommendations.push({
        title: `Explore more ${genre.name}`,
        reason: `${genre.count} highly rated films in this genre`,
        score: genre.count,
        basedOn: [genre.name],
      });
    }

    return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

export class RecommendationService {
  constructor(private readonly engine: RecommendationEngine) {}

  recommend(username: string, options?: RecommendationOptions) {
    return this.engine.recommend(username, options);
  }
}
