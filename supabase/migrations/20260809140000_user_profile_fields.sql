-- Mirrored from prisma/migrations — do not edit by hand.
-- Regenerate: bun run db:sync:supabase

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "followingCount" INTEGER,
ADD COLUMN     "followersCount" INTEGER,
ADD COLUMN     "externalLinks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "favoriteFilms" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "recentLikes" JSONB NOT NULL DEFAULT '[]';
