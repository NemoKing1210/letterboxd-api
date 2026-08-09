export const CACHE_KEYS = {
  userProfile: (username: string) => `user:profile:${username.toLowerCase()}`,
  userStats: (username: string) => `user:stats:${username.toLowerCase()}`,
  userRatings: (username: string) => `user:ratings:v2:${username.toLowerCase()}`,
  userFavorites: (username: string) => `user:favorites:v2:${username.toLowerCase()}`,
} as const;

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

export const LETTERBOXD_BASE_URL = 'https://letterboxd.com';

export const SYNC_STATUS = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;

export type SyncStatusValue = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];
