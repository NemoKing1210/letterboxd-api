import type { UserMovieRepository, UserRepository } from '../../../infrastructure/database';
import { NotFoundError } from '../../../shared/errors/app-error';
import { countBy, normalizeUsername, topN } from '../../../shared/utils';
import type {
  Recommendation,
  RecommendationEngine,
  RecommendationOptions,
} from '../types/recommendation-engine';

/**
 * Rule-based stub. Replace with OpenAI / embeddings / RAG in v3 without changing callers.
 */
export class RuleBasedRecommendationEngine implements RecommendationEngine {
  constructor(
    private readonly users: UserRepository,
    private readonly userMovies: UserMovieRepository,
  ) {}

  async recommend(username: string, options: RecommendationOptions = {}): Promise<Recommendation[]> {
    const limit = options.limit ?? 5;
    const normalized = normalizeUsername(username);
    const user = await this.users.findByUsername(normalized);
    if (!user) {
      throw new NotFoundError(`User "${normalized}" not found. Sync the user first.`);
    }

    const entries = await this.userMovies.findAllForUser(user.id);
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
