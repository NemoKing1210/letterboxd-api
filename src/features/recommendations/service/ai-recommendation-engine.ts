import type { Movie } from '@prisma/client';
import type {
  EmbeddingRepository,
  SyncHistoryRepository,
  UserMovieRepository,
  UserRepository,
} from '../../../infrastructure/database';
import type { CacheProvider } from '../../../infrastructure/cache';
import type { AppLogger } from '../../../infrastructure/logger';
import {
  CACHE_KEYS,
  DEFAULT_AI_CANDIDATE_POOL,
} from '../../../shared/constants';
import { countBy, normalizeUsername, topN } from '../../../shared/utils';
import {
  ensureLocalUser,
  type UserSyncTrigger,
} from '../../users/service/ensure-local-user';
import type { LlmProvider } from '../types/llm-provider';
import type {
  Recommendation,
  RecommendationEngine,
  RecommendationOptions,
} from '../types/recommendation-engine';
import type { MovieEmbeddingPipeline } from './movie-embedding-pipeline';
import { distanceToScore, type TasteAnchor } from './taste-math';

export type AiRecommendationEngineDeps = {
  users: UserRepository;
  userMovies: UserMovieRepository;
  syncHistory: SyncHistoryRepository;
  syncService: UserSyncTrigger;
  embeddingStore: EmbeddingRepository;
  pipeline: MovieEmbeddingPipeline;
  llm?: LlmProvider;
  cache: CacheProvider;
  cacheTtlSeconds: number;
  logger: AppLogger;
  userSyncTtlSeconds: number;
  autoSyncIfMissing?: boolean;
  candidatePool?: number;
  useLlmReasons?: boolean;
};

type LlmRecommendationPayload = {
  items?: Array<{
    movieId?: string;
    slug?: string;
    title?: string;
    reason?: string;
    score?: number;
    basedOn?: string[];
  }>;
};

export class AiRecommendationEngine implements RecommendationEngine {
  private readonly candidatePool: number;
  private readonly useLlmReasons: boolean;

  constructor(private readonly deps: AiRecommendationEngineDeps) {
    this.candidatePool = deps.candidatePool ?? DEFAULT_AI_CANDIDATE_POOL;
    this.useLlmReasons = deps.useLlmReasons ?? Boolean(deps.llm);
  }

  async recommend(username: string, options: RecommendationOptions = {}): Promise<Recommendation[]> {
    const limit = options.limit ?? 5;
    const normalized = normalizeUsername(username);
    const cacheKey = CACHE_KEYS.userRecommendations(normalized, limit);
    const cached = await this.deps.cache.get<Recommendation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await ensureLocalUser(normalized, this.deps);
    const entries = await this.deps.userMovies.findAllForUser(user.id);
    const taste = await this.deps.pipeline.refreshUserTaste(user.id, entries);
    if (!taste) {
      throw new Error('AI_NO_TASTE_SIGNAL');
    }

    await this.deps.pipeline.ensureCatalogCoverage();

    const watchedIds = entries.map((entry) => entry.movieId);
    const poolSize = Math.max(limit, this.candidatePool);
    const nearest = await this.deps.embeddingStore.findNearestMovies({
      embedding: taste.embedding,
      excludeMovieIds: watchedIds,
      limit: poolSize,
      model: taste.model,
    });

    if (nearest.length === 0) {
      throw new Error('AI_EMPTY_CANDIDATE_POOL');
    }

    const template = nearest.slice(0, limit).map((hit) =>
      toTemplateRecommendation(hit.movie, hit.distance, taste.anchors),
    );

    let items = template;
    if (this.useLlmReasons && this.deps.llm) {
      try {
        items = await this.rerankWithLlm({
          llm: this.deps.llm,
          anchors: taste.anchors,
          candidates: nearest,
          limit,
          fallback: template,
        });
      } catch (error) {
        this.deps.logger.warn({ err: error, username: normalized }, 'LLM recommendation rerank failed');
      }
    }

    await this.deps.cache.set(cacheKey, items, this.deps.cacheTtlSeconds);
    return items;
  }

  private async rerankWithLlm(params: {
    llm: LlmProvider;
    anchors: TasteAnchor[];
    candidates: Array<{ movie: Movie; distance: number }>;
    limit: number;
    fallback: Recommendation[];
  }): Promise<Recommendation[]> {
    const tasteSummary = buildTasteSummary(params.anchors);
    const candidateLines = params.candidates.map((hit) => ({
      movieId: hit.movie.id,
      slug: hit.movie.slug,
      title: hit.movie.title,
      year: hit.movie.year,
      director: hit.movie.director,
      genres: hit.movie.genres,
      scoreHint: distanceToScore(hit.distance),
    }));

    const payload = await params.llm.completeJson<LlmRecommendationPayload>({
      messages: [
        {
          role: 'system',
          content:
            'You rank film recommendations. Reply with JSON only: {"items":[{"movieId":"...","reason":"...","score":0.0,"basedOn":["..."]}]}. Use only provided movieIds. Keep reasons under 160 characters.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            limit: params.limit,
            taste: tasteSummary,
            candidates: candidateLines,
          }),
        },
      ],
    });

    const byId = new Map(params.candidates.map((hit) => [hit.movie.id, hit]));
    const mapped: Recommendation[] = [];

    for (const item of payload.items ?? []) {
      if (!item.movieId) continue;
      const hit = byId.get(item.movieId);
      if (!hit) continue;
      mapped.push({
        title: hit.movie.title,
        reason: item.reason?.trim() || `Similar to your taste in ${tasteSummary.anchorTitles[0] ?? 'film'}`,
        score: typeof item.score === 'number' ? item.score : distanceToScore(hit.distance),
        basedOn: item.basedOn?.length ? item.basedOn : tasteSummary.anchorTitles.slice(0, 3),
        slug: hit.movie.slug,
        movieId: hit.movie.id,
        year: hit.movie.year,
        poster: hit.movie.poster,
      });
      if (mapped.length >= params.limit) {
        break;
      }
    }

    return mapped.length > 0 ? mapped : params.fallback;
  }
}

function toTemplateRecommendation(
  movie: Movie,
  distance: number,
  anchors: TasteAnchor[],
): Recommendation {
  const basedOn = anchors.slice(0, 3).map((anchor) => anchor.movie.title);
  const reason =
    basedOn.length > 0
      ? `Similar to ${basedOn.join(', ')}`
      : 'Matches your overall Letterboxd taste profile';

  return {
    title: movie.title,
    reason,
    score: distanceToScore(distance),
    basedOn,
    slug: movie.slug,
    movieId: movie.id,
    year: movie.year,
    poster: movie.poster,
  };
}

function buildTasteSummary(anchors: TasteAnchor[]) {
  const topDirectors = topN(
    countBy(
      anchors.filter((a) => a.movie.director),
      (a) => a.movie.director,
    ),
    5,
  ).map((row) => row.name);

  const genreCounts = new Map<string, number>();
  for (const anchor of anchors) {
    for (const genre of anchor.movie.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }
  const topGenres = topN(genreCounts, 5).map((row) => row.name);

  return {
    anchorTitles: anchors.slice(0, 10).map((anchor) => anchor.movie.title),
    topDirectors,
    topGenres,
  };
}
