import type { Movie, PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { OPENAI_EMBEDDING_DIMENSIONS } from '../../shared/constants';

export type StoredEmbedding = {
  embedding: number[];
  model: string;
  sourceHash?: string;
  updatedAt: Date;
};

export type NearestMovieHit = {
  movie: Movie;
  distance: number;
};

export type EmbeddingRepository = {
  upsertMovieEmbedding(movieId: string, embedding: number[], model: string): Promise<void>;
  getMovieEmbeddings(movieIds: string[]): Promise<Map<string, StoredEmbedding>>;
  findMoviesMissingEmbeddings(limit: number): Promise<Movie[]>;
  upsertUserTasteEmbedding(
    userId: string,
    embedding: number[],
    model: string,
    sourceHash: string,
  ): Promise<void>;
  getUserTasteEmbedding(userId: string): Promise<StoredEmbedding | null>;
  findNearestMovies(params: {
    embedding: number[];
    excludeMovieIds: string[];
    limit: number;
    model?: string;
  }): Promise<NearestMovieHit[]>;
};

type EmbeddingRow = {
  movieId?: string;
  userId?: string;
  embedding: string;
  model: string;
  sourceHash?: string;
  updatedAt: Date;
};

type NearestRow = {
  id: string;
  title: string;
  year: number | null;
  tmdbId: number | null;
  poster: string | null;
  genres: string[];
  director: string | null;
  slug: string | null;
  enriched: boolean;
  distance: number;
};

export class PrismaEmbeddingRepository implements EmbeddingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertMovieEmbedding(movieId: string, embedding: number[], model: string): Promise<void> {
    assertEmbeddingDimensions(embedding);
    const vector = toVectorLiteral(embedding);
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "MovieEmbedding" ("movieId", embedding, model, "updatedAt")
       VALUES ($1, $2::vector, $3, NOW())
       ON CONFLICT ("movieId") DO UPDATE SET
         embedding = EXCLUDED.embedding,
         model = EXCLUDED.model,
         "updatedAt" = NOW()`,
      movieId,
      vector,
      model,
    );
  }

  async getMovieEmbeddings(movieIds: string[]): Promise<Map<string, StoredEmbedding>> {
    const unique = [...new Set(movieIds.filter(Boolean))];
    const map = new Map<string, StoredEmbedding>();
    if (unique.length === 0) {
      return map;
    }

    const rows = await this.prisma.$queryRaw<EmbeddingRow[]>`
      SELECT "movieId", embedding::text AS embedding, model, "updatedAt"
      FROM "MovieEmbedding"
      WHERE "movieId" IN (${Prisma.join(unique)})
    `;

    for (const row of rows) {
      if (!row.movieId) continue;
      map.set(row.movieId, {
        embedding: parseVectorText(row.embedding),
        model: row.model,
        updatedAt: row.updatedAt,
      });
    }
    return map;
  }

  findMoviesMissingEmbeddings(limit: number): Promise<Movie[]> {
    return this.prisma.movie.findMany({
      where: { embedding: null },
      orderBy: [{ enriched: 'desc' }, { title: 'asc' }],
      take: Math.max(0, limit),
    });
  }

  async upsertUserTasteEmbedding(
    userId: string,
    embedding: number[],
    model: string,
    sourceHash: string,
  ): Promise<void> {
    assertEmbeddingDimensions(embedding);
    const vector = toVectorLiteral(embedding);
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "UserTasteEmbedding" ("userId", embedding, model, "sourceHash", "updatedAt")
       VALUES ($1, $2::vector, $3, $4, NOW())
       ON CONFLICT ("userId") DO UPDATE SET
         embedding = EXCLUDED.embedding,
         model = EXCLUDED.model,
         "sourceHash" = EXCLUDED."sourceHash",
         "updatedAt" = NOW()`,
      userId,
      vector,
      model,
      sourceHash,
    );
  }

  async getUserTasteEmbedding(userId: string): Promise<StoredEmbedding | null> {
    const rows = await this.prisma.$queryRaw<EmbeddingRow[]>`
      SELECT "userId", embedding::text AS embedding, model, "sourceHash", "updatedAt"
      FROM "UserTasteEmbedding"
      WHERE "userId" = ${userId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      embedding: parseVectorText(row.embedding),
      model: row.model,
      sourceHash: row.sourceHash,
      updatedAt: row.updatedAt,
    };
  }

  async findNearestMovies(params: {
    embedding: number[];
    excludeMovieIds: string[];
    limit: number;
    model?: string;
  }): Promise<NearestMovieHit[]> {
    assertEmbeddingDimensions(params.embedding);
    const limit = Math.max(0, params.limit);
    if (limit === 0) {
      return [];
    }

    const vector = toVectorLiteral(params.embedding);
    const exclude = [...new Set(params.excludeMovieIds.filter(Boolean))];
    const sqlParams: unknown[] = [vector];
    let paramIndex = 2;

    let excludeClause = '';
    if (exclude.length > 0) {
      const placeholders = exclude.map(() => {
        const placeholder = `$${paramIndex}`;
        paramIndex += 1;
        return placeholder;
      });
      excludeClause = `AND e."movieId" NOT IN (${placeholders.join(', ')})`;
      sqlParams.push(...exclude);
    }

    let modelClause = '';
    if (params.model) {
      modelClause = `AND e.model = $${paramIndex}`;
      paramIndex += 1;
      sqlParams.push(params.model);
    }

    sqlParams.push(limit);

    const rows = await this.prisma.$queryRawUnsafe<NearestRow[]>(
      `SELECT
         m.id,
         m.title,
         m.year,
         m."tmdbId",
         m.poster,
         m.genres,
         m.director,
         m.slug,
         m.enriched,
         (e.embedding <=> $1::vector) AS distance
       FROM "MovieEmbedding" e
       INNER JOIN "Movie" m ON m.id = e."movieId"
       WHERE TRUE
         ${excludeClause}
         ${modelClause}
       ORDER BY e.embedding <=> $1::vector ASC
       LIMIT $${paramIndex}`,
      ...sqlParams,
    );

    return rows.map((row) => ({
      distance: Number(row.distance),
      movie: {
        id: row.id,
        title: row.title,
        year: row.year,
        tmdbId: row.tmdbId,
        poster: row.poster,
        genres: row.genres,
        director: row.director,
        slug: row.slug,
        enriched: row.enriched,
      },
    }));
  }
}

export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export function parseVectorText(raw: string): number[] {
  const trimmed = raw.trim();
  const inner = trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed;
  if (!inner) {
    return [];
  }
  return inner.split(',').map((part) => Number(part.trim()));
}

function assertEmbeddingDimensions(embedding: number[]): void {
  if (embedding.length !== OPENAI_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected embedding length ${OPENAI_EMBEDDING_DIMENSIONS}, got ${embedding.length}`,
    );
  }
  if (embedding.some((value) => !Number.isFinite(value))) {
    throw new Error('Embedding contains non-finite values');
  }
}
