import { loadEnv, type Env } from './config/env';
import { MemoryCache, type CacheProvider } from '../infrastructure/cache';
import {
  createPrismaClient,
  PrismaMovieRepository,
  PrismaSyncHistoryRepository,
  PrismaUserMovieRepository,
  PrismaUserRepository,
  type PrismaClient,
} from '../infrastructure/database';
import { LetterboxdScraperProvider, type MovieProvider } from '../infrastructure/letterboxd';
import { createLogger, type AppLogger } from '../infrastructure/logger';
import { SynchronizationService } from '../features/synchronization/service/synchronization-service';
import { UsersService } from '../features/users/service/users-service';
import { MoviesService } from '../features/movies/service/movies-service';
import { RatingsService } from '../features/ratings/service/ratings-service';
import { FavoritesService } from '../features/favorites/service/favorites-service';
import { StatisticsService } from '../features/statistics/service/statistics-service';
import {
  RecommendationService,
  RuleBasedRecommendationEngine,
} from '../features/recommendations/service/recommendation-service';

export type AppContainer = {
  env: Env;
  logger: AppLogger;
  prisma: PrismaClient;
  cache: CacheProvider;
  movieProvider: MovieProvider;
  syncService: SynchronizationService;
  usersService: UsersService;
  moviesService: MoviesService;
  ratingsService: RatingsService;
  favoritesService: FavoritesService;
  statisticsService: StatisticsService;
  recommendationService: RecommendationService;
};

let container: AppContainer | null = null;

export function createContainer(overrides?: Partial<AppContainer>): AppContainer {
  const env = overrides?.env ?? loadEnv();
  const logger = overrides?.logger ?? createLogger(env);
  const prisma = overrides?.prisma ?? createPrismaClient();
  const cache = overrides?.cache ?? new MemoryCache();

  const users = new PrismaUserRepository(prisma);
  const movies = new PrismaMovieRepository(prisma);
  const userMovies = new PrismaUserMovieRepository(prisma);
  const syncHistory = new PrismaSyncHistoryRepository(prisma);

  const movieProvider =
    overrides?.movieProvider ??
    new LetterboxdScraperProvider({
      timeoutMs: env.LETTERBOXD_TIMEOUT,
      pageDelayMs: env.LETTERBOXD_PAGE_DELAY_MS,
      maxPages: env.LETTERBOXD_MAX_PAGES,
      logger,
    });

  const syncService =
    overrides?.syncService ??
    new SynchronizationService({
      movieProvider,
      users,
      movies,
      userMovies,
      syncHistory,
      cache,
      logger,
    });

  const usersService =
    overrides?.usersService ??
    new UsersService({
      users,
      userMovies,
      syncHistory,
      syncService,
      cache,
      env,
    });

  const moviesService = overrides?.moviesService ?? new MoviesService({ users, userMovies });
  const ratingsService =
    overrides?.ratingsService ?? new RatingsService({ users, userMovies, cache, env });
  const favoritesService =
    overrides?.favoritesService ?? new FavoritesService({ users, userMovies, cache, env });
  const statisticsService =
    overrides?.statisticsService ?? new StatisticsService({ users, userMovies, cache, env });
  const recommendationService =
    overrides?.recommendationService ??
    new RecommendationService(new RuleBasedRecommendationEngine(users, userMovies));

  return {
    env,
    logger,
    prisma,
    cache,
    movieProvider,
    syncService,
    usersService,
    moviesService,
    ratingsService,
    favoritesService,
    statisticsService,
    recommendationService,
  };
}

export function getContainer(): AppContainer {
  if (!container) {
    container = createContainer();
  }
  return container;
}

export function setContainer(next: AppContainer | null): void {
  container = next;
}
