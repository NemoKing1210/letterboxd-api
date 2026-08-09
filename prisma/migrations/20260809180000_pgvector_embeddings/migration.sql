-- Enable pgvector for taste / movie ANN recommendations (v3).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "MovieEmbedding" (
    "movieId" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "model" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovieEmbedding_pkey" PRIMARY KEY ("movieId")
);

CREATE TABLE "UserTasteEmbedding" (
    "userId" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "model" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTasteEmbedding_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "MovieEmbedding_embedding_hnsw_idx"
  ON "MovieEmbedding"
  USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "MovieEmbedding"
  ADD CONSTRAINT "MovieEmbedding_movieId_fkey"
  FOREIGN KEY ("movieId") REFERENCES "Movie"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTasteEmbedding"
  ADD CONSTRAINT "UserTasteEmbedding_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
