import type { Movie, UserMovie } from '@prisma/client';
import type { EmbeddingProvider } from '../types/embedding-provider';
import type { EmbeddingRepository } from '../../../infrastructure/database';
import type { AppLogger } from '../../../infrastructure/logger';
import {
  DEFAULT_AI_EMBED_BATCH_SIZE,
  DEFAULT_AI_EMBED_BUDGET,
} from '../../../shared/constants';
import {
  buildMovieEmbeddingText,
  computeTasteSourceHash,
  selectTasteAnchors,
  weightedAverageEmbedding,
  type TasteAnchor,
} from './taste-math';

export type MovieEmbeddingPipelineDeps = {
  embeddings: EmbeddingProvider;
  embeddingStore: EmbeddingRepository;
  logger: AppLogger;
  embedBudget?: number;
  embedBatchSize?: number;
};

export class MovieEmbeddingPipeline {
  private readonly embedBudget: number;
  private readonly embedBatchSize: number;

  constructor(private readonly deps: MovieEmbeddingPipelineDeps) {
    this.embedBudget = deps.embedBudget ?? DEFAULT_AI_EMBED_BUDGET;
    this.embedBatchSize = deps.embedBatchSize ?? DEFAULT_AI_EMBED_BATCH_SIZE;
  }

  async ensureMoviesEmbedded(movies: Movie[], budget = this.embedBudget): Promise<number> {
    if (movies.length === 0 || budget <= 0) {
      return 0;
    }

    const existing = await this.deps.embeddingStore.getMovieEmbeddings(movies.map((m) => m.id));
    const missing = movies.filter((movie) => !existing.has(movie.id)).slice(0, budget);
    if (missing.length === 0) {
      return 0;
    }

    let embedded = 0;
    for (let i = 0; i < missing.length; i += this.embedBatchSize) {
      const batch = missing.slice(i, i + this.embedBatchSize);
      const texts = batch.map((movie) => buildMovieEmbeddingText(movie));
      const result = await this.deps.embeddings.embed({ texts });

      await Promise.all(
        batch.map((movie, index) =>
          this.deps.embeddingStore.upsertMovieEmbedding(
            movie.id,
            result.embeddings[index]!,
            result.model,
          ),
        ),
      );
      embedded += batch.length;
    }

    this.deps.logger.debug({ embedded, requested: missing.length }, 'Movie embeddings upserted');
    return embedded;
  }

  async ensureCatalogCoverage(budget = this.embedBudget): Promise<number> {
    const missing = await this.deps.embeddingStore.findMoviesMissingEmbeddings(budget);
    return this.ensureMoviesEmbedded(missing, budget);
  }

  async refreshUserTaste(
    userId: string,
    entries: Array<UserMovie & { movie: Movie }>,
  ): Promise<{ embedding: number[]; model: string; anchors: TasteAnchor[] } | null> {
    const anchors = selectTasteAnchors(entries);
    if (anchors.length === 0) {
      return null;
    }

    const sourceHash = computeTasteSourceHash(anchors);
    const cached = await this.deps.embeddingStore.getUserTasteEmbedding(userId);
    if (cached && cached.sourceHash === sourceHash) {
      return { embedding: cached.embedding, model: cached.model, anchors };
    }

    await this.ensureMoviesEmbedded(
      anchors.map((anchor) => anchor.movie),
      Math.max(this.embedBudget, anchors.length),
    );

    const stored = await this.deps.embeddingStore.getMovieEmbeddings(
      anchors.map((anchor) => anchor.movie.id),
    );

    const weighted = anchors
      .map((anchor) => {
        const row = stored.get(anchor.movie.id);
        if (!row) return null;
        return { embedding: row.embedding, weight: anchor.weight };
      })
      .filter((item): item is { embedding: number[]; weight: number } => item !== null);

    const embedding = weightedAverageEmbedding(weighted);
    if (!embedding) {
      return null;
    }

    const model = [...stored.values()][0]?.model ?? 'unknown';
    await this.deps.embeddingStore.upsertUserTasteEmbedding(userId, embedding, model, sourceHash);
    return { embedding, model, anchors };
  }
}
