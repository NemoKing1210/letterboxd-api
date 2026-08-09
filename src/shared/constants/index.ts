export const CACHE_KEYS = {
  userProfile: (username: string) => `user:profile:${username.toLowerCase()}`,
  userStats: (username: string) => `user:stats:${username.toLowerCase()}`,
  userRatings: (username: string) => `user:ratings:v2:${username.toLowerCase()}`,
  userFavoriteFacets: (username: string) => `user:favorites:facets:v1:${username.toLowerCase()}`,
  userRecommendations: (username: string, limit: number) =>
    `user:recommendations:v1:${username.toLowerCase()}:${limit}`,
  userRecommendationsPrefix: (username: string) =>
    `user:recommendations:v1:${username.toLowerCase()}:`,
} as const;

/** text-embedding-3-small default output size (also forced via API `dimensions`). */
export const OPENAI_EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
export const DEFAULT_OPENAI_CHAT_MODEL = 'gpt-4o-mini';
export const DEFAULT_OPENAI_TIMEOUT_MS = 30_000;
export const DEFAULT_OPENAI_MAX_RETRIES = 3;
/** Max movies to embed lazily per recommendations request. */
export const DEFAULT_AI_EMBED_BUDGET = 48;
export const DEFAULT_AI_EMBED_BATCH_SIZE = 16;
/** ANN candidates fetched before optional LLM rerank. */
export const DEFAULT_AI_CANDIDATE_POOL = 20;
/** Min rating (inclusive) to count toward taste embedding. */
export const TASTE_RATING_THRESHOLD = 4;
/** Extra weight for favorited films when averaging taste. */
export const TASTE_FAVORITE_BOOST = 1.5;
export const TASTE_MAX_ANCHORS = 40;

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
/** Hard cap for any paginated / list movie payload in the API. */
export const MAX_LIMIT = 100;
/** Max length for simple `q` / `search` and advanced string values. */
export const SEARCH_QUERY_MAX_LENGTH = 128;
/** Max nesting depth for advanced search filter groups. */
export const SEARCH_MAX_DEPTH = 5;
/** Max conditions in a single advanced search filter group. */
export const SEARCH_MAX_CONDITIONS = 32;
/** Rating at or above this counts as a favorite when `favorite` flag is false. */
export const FAVORITE_RATING_THRESHOLD = 4.5;
export const DEFAULT_ENRICH_CONCURRENCY = 8;
export const DEFAULT_ENRICH_RETRIES = 3;
export const DEFAULT_RETRY_BASE_MS = 250;
export const DEFAULT_RETRY_MAX_MS = 8_000;

export const LETTERBOXD_BASE_URL = 'https://letterboxd.com';

export const SYNC_STATUS = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;

export type SyncStatusValue = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];
