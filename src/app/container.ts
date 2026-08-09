import { loadEnv, type Env } from './config/env';
import { createAuthenticator, type AuthAuthenticator } from './auth';
import { MemoryCache, type CacheProvider } from '../infrastructure/cache';
import {
  createPrismaClient,
  PrismaEmbeddingRepository,
  PrismaMovieRepository,
  PrismaSyncHistoryRepository,
  PrismaUserMovieRepository,
  PrismaUserRepository,
  type PrismaClient,
} from '../infrastructure/database';
import { HttpClient } from '../infrastructure/http';
import { LetterboxdScraperProvider, type MovieProvider } from '../infrastructure/letterboxd';
import {
  OpenAiEmbeddingProvider,
  OpenAiHttpClient,
  OpenAiLlmProvider,
} from '../infrastructure/external';
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
import { AiRecommendationEngine } from '../features/recommendations/service/ai-recommendation-engine';
import { FallbackRecommendationEngine } from '../features/recommendations/service/fallback-recommendation-engine';
import { MovieEmbeddingPipeline } from '../features/recommendations/service/movie-embedding-pipeline';
import type { RecommendationEngine } from '../features/recommendations/types/recommendation-engine';
import { OPENAI_EMBEDDING_DIMENSIONS } from '../shared/constants';

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
  const embeddingStore = new PrismaEmbeddingRepository(prisma);
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

  const openAi = createOpenAiStack(env, logger);
  const pipeline = openAi
    ? new MovieEmbeddingPipeline({
        embeddings: openAi.embeddings,
        embeddingStore,
        logger,
        embedBudget: env.AI_EMBED_BUDGET,
        embedBatchSize: env.AI_EMBED_BATCH_SIZE,
      })
    : null;

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
      onSyncSuccess:
        pipeline && openAi
          ? async ({ username, userId }) => {
              const entries = await userMovies.findAllForUser(userId);
              await pipeline.refreshUserTaste(userId, entries);
              await pipeline.ensureCatalogCoverage(env.AI_EMBED_BUDGET);
              logger.debug({ username, userId }, 'Post-sync embedding refresh completed');
            }
          : undefined,
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
      createRecommendationEngine({
        env,
        logger,
        users,
        userMovies,
        syncHistory,
        syncService,
        embeddingStore,
        pipeline,
        openAi,
        cache,
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

type OpenAiStack = {
  embeddings: OpenAiEmbeddingProvider;
  llm: OpenAiLlmProvider;
};

function createOpenAiStack(env: Env, logger: AppLogger): OpenAiStack | null {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  const client = new OpenAiHttpClient({
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    timeoutMs: env.OPENAI_TIMEOUT_MS,
    maxRetries: env.OPENAI_MAX_RETRIES,
  });

  logger.info(
    {
      embeddingModel: env.OPENAI_EMBEDDING_MODEL,
      chatModel: env.OPENAI_CHAT_MODEL,
      recommendationEngine: env.RECOMMENDATION_ENGINE,
    },
    'OpenAI recommendation stack enabled',
  );

  return {
    embeddings: new OpenAiEmbeddingProvider({
      client,
      model: env.OPENAI_EMBEDDING_MODEL,
      dimensions: OPENAI_EMBEDDING_DIMENSIONS,
    }),
    llm: new OpenAiLlmProvider({
      client,
      model: env.OPENAI_CHAT_MODEL,
    }),
  };
}

function createRecommendationEngine(params: {
  env: Env;
  logger: AppLogger;
  users: PrismaUserRepository;
  userMovies: PrismaUserMovieRepository;
  syncHistory: PrismaSyncHistoryRepository;
  syncService: SynchronizationService;
  embeddingStore: PrismaEmbeddingRepository;
  pipeline: MovieEmbeddingPipeline | null;
  openAi: OpenAiStack | null;
  cache: CacheProvider;
  userSyncTtlSeconds: number;
}): RecommendationEngine {
  const rules = new RuleBasedRecommendationEngine({
    users: params.users,
    userMovies: params.userMovies,
    syncHistory: params.syncHistory,
    syncService: params.syncService,
    logger: params.logger,
    userSyncTtlSeconds: params.userSyncTtlSeconds,
  });

  const useAi =
    params.env.RECOMMENDATION_ENGINE === 'ai' ||
    (params.env.RECOMMENDATION_ENGINE === 'auto' && Boolean(params.openAi && params.pipeline));

  if (!useAi || !params.openAi || !params.pipeline) {
    if (params.env.RECOMMENDATION_ENGINE === 'ai') {
      params.logger.warn('RECOMMENDATION_ENGINE=ai but OpenAI stack is unavailable; using rules');
    }
    return rules;
  }

  const ai = new AiRecommendationEngine({
    users: params.users,
    userMovies: params.userMovies,
    syncHistory: params.syncHistory,
    syncService: params.syncService,
    embeddingStore: params.embeddingStore,
    pipeline: params.pipeline,
    llm: params.env.AI_RECOMMEND_USE_LLM ? params.openAi.llm : undefined,
    cache: params.cache,
    cacheTtlSeconds: params.env.CACHE_TTL,
    logger: params.logger,
    userSyncTtlSeconds: params.userSyncTtlSeconds,
    candidatePool: params.env.AI_RECOMMEND_CANDIDATE_POOL,
    useLlmReasons: params.env.AI_RECOMMEND_USE_LLM,
  });

  return new FallbackRecommendationEngine({
    primary: ai,
    fallback: rules,
    logger: params.logger,
  });
}
