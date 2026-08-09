export { createPrismaClient } from './prisma-client';
export type { PrismaClient } from './prisma-client';
export {
  PrismaUserRepository,
  PrismaMovieRepository,
  PrismaUserMovieRepository,
  PrismaSyncHistoryRepository,
} from './repositories';
export {
  PrismaEmbeddingRepository,
  toVectorLiteral,
  parseVectorText,
} from './embedding-repository';
export type {
  UserProfileSnapshot,
  UserRepository,
  MovieRepository,
  UserMovieRepository,
  SyncHistoryRepository,
  UserWithMovies,
  MovieListFilters,
  MovieListSort,
  MovieSearchQuery,
} from './repositories';
export type {
  EmbeddingRepository,
  StoredEmbedding,
  NearestMovieHit,
} from './embedding-repository';
