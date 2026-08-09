-- Mirrored from prisma/migrations — do not edit by hand.
-- Regenerate: bun run db:sync:supabase

-- AlterTable
ALTER TABLE "Movie" ADD COLUMN "enriched" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Movie_enriched_idx" ON "Movie"("enriched");
