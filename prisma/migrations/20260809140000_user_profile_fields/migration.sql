-- AlterTable
ALTER TABLE "User" ADD COLUMN     "followingCount" INTEGER,
ADD COLUMN     "followersCount" INTEGER,
ADD COLUMN     "externalLinks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "favoriteFilms" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "recentLikes" JSONB NOT NULL DEFAULT '[]';
