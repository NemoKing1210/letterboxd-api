import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../shared/constants';

export const usernameParamSchema = z.object({
  username: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username may contain letters, numbers, _ and -'),
});

export const movieQuerySchema = z.object({
  ratingMin: z.coerce.number().min(0).max(5).optional(),
  ratingMax: z.coerce.number().min(0).max(5).optional(),
  year: z.coerce.number().int().min(1888).max(2100).optional(),
  yearFrom: z.coerce.number().int().min(1888).max(2100).optional(),
  yearTo: z.coerce.number().int().min(1888).max(2100).optional(),
  genre: z.string().min(1).max(64).optional(),
  director: z.string().min(1).max(128).optional(),
  sort: z
    .enum(['rating_desc', 'rating_asc', 'date_desc', 'date_asc', 'year_desc', 'year_asc', 'title_asc'])
    .default('rating_desc'),
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export type MovieQuery = z.infer<typeof movieQuerySchema>;

export const userProfileSchema = z.object({
  username: z.string(),
  moviesCount: z.number().int(),
  averageRating: z.number().nullable(),
  favoriteGenres: z.array(z.object({ name: z.string(), count: z.number() })),
  lastSyncedAt: z.string().datetime().nullable().optional(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
