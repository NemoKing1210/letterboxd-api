import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import type { AppContainer } from './container';
import {
  rateLimitMiddleware,
  requestIdMiddleware,
  requestLoggingMiddleware,
  securityHeadersMiddleware,
} from './middleware';
import {
  favoritesFacetQuerySchema,
  namedCountSchema,
} from '../features/favorites/schemas/favorites-schemas';
import { movieDtoSchema } from '../features/movies/schemas/movie-schemas';
import { searchBodyOpenApiSchema, searchBodySchema } from '../features/search/schemas/search-schemas';
import { movieQuerySchema, usernameParamSchema, userProfileSchema } from '../features/users/schemas/user-schemas';
import { syncResponseSchema } from '../features/synchronization/schemas/sync-schemas';
import { AppError, ValidationError } from '../shared/errors/app-error';

type AppVariables = {
  requestId: string;
};

const ErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});

const PaginatedMoviesSchema = z.object({
  items: z.array(movieDtoSchema),
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

const RatingsSchema = z.object({
  averageRating: z.number().nullable(),
  ratingsCount: z.number(),
  bestMovies: z.array(movieDtoSchema),
  worstMovies: z.array(movieDtoSchema),
  distribution: z.record(z.number()),
});

const PaginatedNamedCountsSchema = z.object({
  items: z.array(namedCountSchema),
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

const StatisticsSchema = z.object({
  moviesWatched: z.number(),
  averageRating: z.number().nullable(),
  topGenres: z.array(z.object({ name: z.string(), count: z.number() })),
  topDirectors: z.array(z.object({ name: z.string(), count: z.number() })),
  topDecades: z.array(z.object({ name: z.string(), count: z.number() })),
});

const RecommendationsSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      reason: z.string(),
      score: z.number(),
      basedOn: z.array(z.string()),
    }),
  ),
});

export function createApp(container: AppContainer) {
  const app = new OpenAPIHono<{ Variables: AppVariables }>();

  app.onError((error, c) => {
    const requestId = c.get('requestId') ?? 'unknown';

    if (error instanceof AppError) {
      const appError = error;
      if (appError.status >= 500) {
        container.logger.error({ err: appError, requestId, code: appError.code }, appError.message);
      } else {
        container.logger.warn({ err: appError, requestId, code: appError.code }, appError.message);
      }

      return c.json(
        {
          error: {
            code: appError.code,
            message: appError.message,
            details: appError.details ?? undefined,
            requestId,
          },
        },
        appError.status as 400,
      );
    }

    // Zod / OpenAPI validation errors
    const maybeStatus = (error as { statusCode?: number }).statusCode;
    if (typeof maybeStatus === 'number') {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
            requestId,
          },
        },
        (maybeStatus >= 400 && maybeStatus < 600 ? maybeStatus : 400) as 400,
      );
    }

    container.logger.error({ err: error, requestId }, 'Unhandled error');
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          requestId,
        },
      },
      500,
    );
  });

  app.use('*', requestIdMiddleware());
  app.use('*', securityHeadersMiddleware());
  app.use('*', requestLoggingMiddleware(container));
  app.use('*', rateLimitMiddleware(container));
  app.use(
    '*',
    cors({
      origin: container.env.CORS_ORIGIN === '*' ? '*' : container.env.CORS_ORIGIN.split(','),
    }),
  );

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      service: 'letterboxd-api',
      timestamp: new Date().toISOString(),
    }),
  );

  const getUserRoute = createRoute({
    method: 'get',
    path: '/api/users/{username}',
    tags: ['Users'],
    summary: 'Get user profile',
    request: {
      params: usernameParamSchema,
    },
    responses: {
      200: {
        description: 'User profile',
        content: { 'application/json': { schema: userProfileSchema } },
      },
      404: {
        description: 'Not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  });

  app.openapi(getUserRoute, async (c) => {
    const { username } = c.req.valid('param');
    const profile = await container.usersService.getProfile(username);
    return c.json(profile, 200);
  });

  const getMoviesRoute = createRoute({
    method: 'get',
    path: '/api/users/{username}/movies',
    tags: ['Movies'],
    summary: 'List user movies with filters',
    request: {
      params: usernameParamSchema,
      query: movieQuerySchema,
    },
    responses: {
      200: {
        description: 'Paginated movies',
        content: { 'application/json': { schema: PaginatedMoviesSchema } },
      },
    },
  });

  app.openapi(getMoviesRoute, async (c) => {
    const { username } = c.req.valid('param');
    const query = c.req.valid('query');
    const result = await container.moviesService.listMovies(username, query);
    return c.json(result, 200);
  });

  const getRatingsRoute = createRoute({
    method: 'get',
    path: '/api/users/{username}/ratings',
    tags: ['Ratings'],
    summary: 'Get ratings summary',
    request: { params: usernameParamSchema },
    responses: {
      200: {
        description: 'Ratings summary',
        content: { 'application/json': { schema: RatingsSchema } },
      },
    },
  });

  app.openapi(getRatingsRoute, async (c) => {
    const { username } = c.req.valid('param');
    const result = await container.ratingsService.getRatings(username);
    return c.json(result, 200);
  });

  const getFavoritesRoute = createRoute({
    method: 'get',
    path: '/api/users/{username}/favorites',
    tags: ['Favorites'],
    summary: 'List favorite movies with filters',
    request: {
      params: usernameParamSchema,
      query: movieQuerySchema,
    },
    responses: {
      200: {
        description: 'Paginated favorite movies (liked or rating ≥ 4.5)',
        content: { 'application/json': { schema: PaginatedMoviesSchema } },
      },
    },
  });

  app.openapi(getFavoritesRoute, async (c) => {
    const { username } = c.req.valid('param');
    const query = c.req.valid('query');
    const result = await container.favoritesService.listFavoriteMovies(username, query);
    return c.json(result, 200);
  });

  const searchMoviesRoute = createRoute({
    method: 'post',
    path: '/api/users/{username}/search',
    tags: ['Search'],
    summary: 'Advanced movie search with nested filter DSL',
    request: {
      params: usernameParamSchema,
      body: {
        content: {
          'application/json': {
            schema: searchBodyOpenApiSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Paginated search results',
        content: { 'application/json': { schema: PaginatedMoviesSchema } },
      },
    },
  });

  app.openapi(searchMoviesRoute, async (c) => {
    const { username } = c.req.valid('param');
    const raw = c.req.valid('json');
    const parsed = searchBodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid search body', parsed.error.flatten());
    }
    const result = await container.searchService.search(username, parsed.data);
    return c.json(result, 200);
  });

  const getFavoriteDirectorsRoute = createRoute({
    method: 'get',
    path: '/api/users/{username}/favorites/directors',
    tags: ['Favorites'],
    summary: 'List favorite directors',
    request: {
      params: usernameParamSchema,
      query: favoritesFacetQuerySchema,
    },
    responses: {
      200: {
        description: 'Paginated favorite directors',
        content: { 'application/json': { schema: PaginatedNamedCountsSchema } },
      },
    },
  });

  app.openapi(getFavoriteDirectorsRoute, async (c) => {
    const { username } = c.req.valid('param');
    const query = c.req.valid('query');
    const result = await container.favoritesService.listFavoriteFacet(username, 'directors', query);
    return c.json(result, 200);
  });

  const getFavoriteGenresRoute = createRoute({
    method: 'get',
    path: '/api/users/{username}/favorites/genres',
    tags: ['Favorites'],
    summary: 'List favorite genres',
    request: {
      params: usernameParamSchema,
      query: favoritesFacetQuerySchema,
    },
    responses: {
      200: {
        description: 'Paginated favorite genres',
        content: { 'application/json': { schema: PaginatedNamedCountsSchema } },
      },
    },
  });

  app.openapi(getFavoriteGenresRoute, async (c) => {
    const { username } = c.req.valid('param');
    const query = c.req.valid('query');
    const result = await container.favoritesService.listFavoriteFacet(username, 'genres', query);
    return c.json(result, 200);
  });

  const getFavoriteYearsRoute = createRoute({
    method: 'get',
    path: '/api/users/{username}/favorites/years',
    tags: ['Favorites'],
    summary: 'List favorite years',
    request: {
      params: usernameParamSchema,
      query: favoritesFacetQuerySchema,
    },
    responses: {
      200: {
        description: 'Paginated favorite years',
        content: { 'application/json': { schema: PaginatedNamedCountsSchema } },
      },
    },
  });

  app.openapi(getFavoriteYearsRoute, async (c) => {
    const { username } = c.req.valid('param');
    const query = c.req.valid('query');
    const result = await container.favoritesService.listFavoriteFacet(username, 'years', query);
    return c.json(result, 200);
  });

  const getStatisticsRoute = createRoute({
    method: 'get',
    path: '/api/users/{username}/statistics',
    tags: ['Statistics'],
    summary: 'Get user statistics',
    request: { params: usernameParamSchema },
    responses: {
      200: {
        description: 'Statistics',
        content: { 'application/json': { schema: StatisticsSchema } },
      },
    },
  });

  app.openapi(getStatisticsRoute, async (c) => {
    const { username } = c.req.valid('param');
    const result = await container.statisticsService.getStatistics(username);
    return c.json(result, 200);
  });

  const syncRoute = createRoute({
    method: 'post',
    path: '/api/users/{username}/sync',
    tags: ['Synchronization'],
    summary: 'Sync Letterboxd user data',
    request: { params: usernameParamSchema },
    responses: {
      200: {
        description: 'Sync result',
        content: { 'application/json': { schema: syncResponseSchema } },
      },
    },
  });

  app.openapi(syncRoute, async (c) => {
    const { username } = c.req.valid('param');
    const result = await container.syncService.syncLetterboxdUser(username);
    return c.json(result, 200);
  });

  const recommendationsRoute = createRoute({
    method: 'get',
    path: '/api/users/{username}/recommendations',
    tags: ['Recommendations'],
    summary: 'Get rule-based recommendations (AI-ready stub)',
    request: {
      params: usernameParamSchema,
      query: z.object({
        limit: z.coerce.number().int().min(1).max(20).optional().default(5),
      }),
    },
    responses: {
      200: {
        description: 'Recommendations',
        content: { 'application/json': { schema: RecommendationsSchema } },
      },
    },
  });

  app.openapi(recommendationsRoute, async (c) => {
    const { username } = c.req.valid('param');
    const { limit } = c.req.valid('query');
    const items = await container.recommendationService.recommend(username, { limit });
    return c.json({ items }, 200);
  });

  // Fallback for non-openapi health already registered
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Letterboxd API',
      version: '2.2.0',
      description:
        'Analyze Letterboxd film taste: sync, filter, search, statistics, and AI-ready recommendations.',
    },
    servers: [{ url: '/' }],
  });

  app.get('/docs', swaggerUI({ url: '/openapi.json' }));

  return app;
}

export type AppType = ReturnType<typeof createApp>;
