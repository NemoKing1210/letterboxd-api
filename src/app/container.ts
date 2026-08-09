import { loadEnv, type Env } from './config/env';
import { createAuthenticator, type AuthAuthenticator } from './auth';
import { MemoryCache, type CacheProvider } from '../infrastructure/cache';
import {
  createPrismaClient,
  PrismaMovieRepository,
  PrismaSyncHistoryRepository,
  PrismaUserMovieRepository,
  PrismaUserRepository,
  type PrismaClient,
} from '../infrastructure/database';
import { HttpClient } from '../infrastructure/http';
import { LetterboxdScraperProvider, type MovieProvider } from '../infrastructure/letterboxd';
import { createLogger, type AppLogger } from '../infrastructure/logger';
import { SynchronizationService } from '../features/synchronization/service/synchronization-service';
import { UsersService } from '../features/users/service/users-service';
import { MoviesService } from '../features/movies/service/movies-service';
import { FilmEnrichmentService } from '../features/movies/service/film-enrichment-service';
import { RatingsService } from '../features/ratings/service/ratings-service';
import { FavoritesService } from '../features/favorites/service/favorites-service';
import { SearchService } from '../features/search/service/search-service';
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
  authenticator: AuthAuthenticator;
  movieProvider: MovieProvider;
  syncService: SynchronizationService;
  usersService: UsersService;
  moviesService: MoviesService;
  ratingsService: RatingsService;
  favoritesService: FavoritesService;
  searchService: SearchService;
  statisticsService: StatisticsService;
  recommendationService: RecommendationService;
};

let container: AppContainer | null = null;

export function createContainer(overrides?: Partial<AppContainer>): AppContainer {
  const env = overrides?.env ?? loadEnv();
  const logger = overrides?.logger ?? createLogger(env);
  const prisma = overrides?.prisma ?? createPrismaClient();
  const cache = overrides?.cache ?? new MemoryCache();
  const authenticator = overrides?.authenticator ?? createAuthenticator(env);

  if (authenticator.enabled) {
    logger.info(
      { methods: authenticator.methods, publicPaths: [...authenticator.publicPaths] },
      'API authentication enabled',
    );
  }

  const users = new PrismaUserRepository(prisma);
  const movies = new PrismaMovieRepository(prisma);
  const userMovies = new PrismaUserMovieRepository(prisma);
  const syncHistory = new PrismaSyncHistoryRepository(prisma);
  const userSyncTtlSeconds = env.USER_SYNC_TTL_SECONDS;

  const proxyConfigured = Boolean(env.HTTP_PROXY || env.HTTPS_PROXY);
  if (proxyConfigured) {
    logger.info({ proxyConfigured: true }, 'Outbound HTTP proxy configured');
  }

  const movieProvider =
    overrides?.movieProvider ??
    new LetterboxdScraperProvider({
      timeoutMs: env.LETTERBOXD_TIMEOUT,
      pageDelayMs: env.LETTERBOXD_PAGE_DELAY_MS,
      maxPages: env.LETTERBOXD_MAX_PAGES,
      logger,
      httpClient: new HttpClient({
        timeoutMs: env.LETTERBOXD_TIMEOUT,
        proxy: {
          httpProxy: env.HTTP_PROXY,
          httpsProxy: env.HTTPS_PROXY,
          noProxy: env.NO_PROXY,
        },
      }),
    });

  const enrichment = new FilmEnrichmentService({
    movieProvider,
    movies,
    logger,
    concurrency: env.LETTERBOXD_ENRICH_CONCURRENCY,
    maxAttempts: env.LETTERBOXD_ENRICH_RETRIES,
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
      logger,
      userSyncTtlSeconds,
    });

  const moviesService =
    overrides?.moviesService ??
    new MoviesService({
      users,
      userMovies,
      syncHistory,
      syncService,
      enrichment,
      logger,
      userSyncTtlSeconds,
    });
  const ratingsService =
    overrides?.ratingsService ??
    new RatingsService({
      users,
      userMovies,
      syncHistory,
      syncService,
      enrichment,
      cache,
      env,
      logger,
      userSyncTtlSeconds,
    });
  const favoritesService =
    overrides?.favoritesService ??
    new FavoritesService({
      users,
      userMovies,
      syncHistory,
      syncService,
      enrichment,
      cache,
      env,
      logger,
      userSyncTtlSeconds,
    });
  const searchService =
    overrides?.searchService ??
    new SearchService({
      users,
      userMovies,
      syncHistory,
      syncService,
      enrichment,
      logger,
      userSyncTtlSeconds,
    });
  const statisticsService =
    overrides?.statisticsService ??
    new StatisticsService({
      users,
      userMovies,
      syncHistory,
      syncService,
      cache,
      env,
      logger,
      userSyncTtlSeconds,
    });
  const recommendationService =
    overrides?.recommendationService ??
    new RecommendationService(
      new RuleBasedRecommendationEngine({
        users,
        userMovies,
        syncHistory,
        syncService,
        logger,
        userSyncTtlSeconds,
      }),
    );

  return {
    env,
    logger,
    prisma,
    cache,
    authenticator,
    movieProvider,
    syncService,
    usersService,
    moviesService,
    ratingsService,
    favoritesService,
    searchService,
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
