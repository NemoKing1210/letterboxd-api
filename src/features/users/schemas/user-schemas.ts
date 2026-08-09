import { z } from 'zod';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  SEARCH_QUERY_MAX_LENGTH,
} from '../../../shared/constants';
import { MOVIE_DTO_FIELDS, USER_PROFILE_FIELDS, fieldsQueryField } from '../../../shared/utils/fields';

export const usernameParamSchema = z.object({
  username: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username may contain letters, numbers, _ and -'),
});

export const movieSortSchema = z.enum([
  'rating_desc',
  'rating_asc',
  'date_desc',
  'date_asc',
  'year_desc',
  'year_asc',
  'title_asc',
]);

export type MovieSort = z.infer<typeof movieSortSchema>;

export const movieQuerySchema = z
  .object({
    ratingMin: z.coerce.number().min(0).max(5).optional(),
    ratingMax: z.coerce.number().min(0).max(5).optional(),
    year: z.coerce.number().int().min(1888).max(2100).optional(),
    yearFrom: z.coerce.number().int().min(1888).max(2100).optional(),
    yearTo: z.coerce.number().int().min(1888).max(2100).optional(),
    genre: z.string().min(1).max(64).optional(),
    director: z.string().min(1).max(128).optional(),
    /** Case-insensitive title/slug contains. Alias of `search`. */
    q: z.string().min(1).max(SEARCH_QUERY_MAX_LENGTH).optional(),
    /** Alias of `q`. Must match `q` when both are provided. */
    search: z.string().min(1).max(SEARCH_QUERY_MAX_LENGTH).optional(),
    sort: movieSortSchema.default('rating_desc'),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    /** Comma-separated MovieDto keys to include in each `items[]` entry. */
    fields: fieldsQueryField(MOVIE_DTO_FIELDS),
  })
  .superRefine((data, ctx) => {
    if (data.q !== undefined && data.search !== undefined && data.q !== data.search) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'q and search must be identical when both are provided',
        path: ['search'],
      });
    }
  });

export type MovieQuery = z.infer<typeof movieQuerySchema>;

/** Resolve list filters for the repository (`q` wins over alias `search`). */
export function resolveMovieListSearch(query: MovieQuery): string | undefined {
  return query.q ?? query.search;
}

export const profileFilmSchema = z.object({
  slug: z.string(),
  title: z.string(),
  year: z.number().nullable(),
  poster: z.string().nullable(),
  url: z.string().url(),
});

export const externalLinkSchema = z.object({
  label: z.string(),
  url: z.string().url(),
});

export const userProfileSchema = z.object({
  username: z.string(),
  /** Letterboxd profile URL. */
  url: z.string().url(),
  moviesCount: z.number().int(),
  averageRating: z.number().nullable(),
  favoriteGenres: z.array(z.object({ name: z.string(), count: z.number() })),
  lastSyncedAt: z.string().datetime().nullable().optional(),
  followingCount: z.number().int().nullable(),
  followersCount: z.number().int().nullable(),
  externalLinks: z.array(externalLinkSchema),
  favoriteFilms: z.array(profileFilmSchema),
  recentLikes: z.array(profileFilmSchema),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
export type ProfileFilm = z.infer<typeof profileFilmSchema>;
export type ExternalLink = z.infer<typeof externalLinkSchema>;

export const userSortSchema = z.enum([
  'username_asc',
  'username_desc',
  'created_desc',
  'created_asc',
  'updated_desc',
  'updated_asc',
  'followers_desc',
  'followers_asc',
  'following_desc',
  'following_asc',
  'movies_desc',
  'movies_asc',
]);

export type UserSort = z.infer<typeof userSortSchema>;

export const userQuerySchema = z
  .object({
    followersMin: z.coerce.number().int().min(0).optional(),
    followersMax: z.coerce.number().int().min(0).optional(),
    followingMin: z.coerce.number().int().min(0).optional(),
    followingMax: z.coerce.number().int().min(0).optional(),
    moviesMin: z.coerce.number().int().min(0).optional(),
    moviesMax: z.coerce.number().int().min(0).optional(),
    /** Case-insensitive username contains. Alias of `search`. */
    q: z.string().min(1).max(SEARCH_QUERY_MAX_LENGTH).optional(),
    /** Alias of `q`. Must match `q` when both are provided. */
    search: z.string().min(1).max(SEARCH_QUERY_MAX_LENGTH).optional(),
    sort: userSortSchema.default('username_asc'),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    /** Comma-separated UserProfile keys to include in each `items[]` entry. */
    fields: fieldsQueryField(USER_PROFILE_FIELDS),
  })
  .superRefine((data, ctx) => {
    if (data.q !== undefined && data.search !== undefined && data.q !== data.search) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'q and search must be identical when both are provided',
        path: ['search'],
      });
    }
    if (
      data.followersMin !== undefined &&
      data.followersMax !== undefined &&
      data.followersMin > data.followersMax
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'followersMin must be <= followersMax',
        path: ['followersMax'],
      });
    }
    if (
      data.followingMin !== undefined &&
      data.followingMax !== undefined &&
      data.followingMin > data.followingMax
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'followingMin must be <= followingMax',
        path: ['followingMax'],
      });
    }
    if (
      data.moviesMin !== undefined &&
      data.moviesMax !== undefined &&
      data.moviesMin > data.moviesMax
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'moviesMin must be <= moviesMax',
        path: ['moviesMax'],
      });
    }
  });

export type UserQuery = z.infer<typeof userQuerySchema>;

/** Resolve list filters for the repository (`q` wins over alias `search`). */
export function resolveUserListSearch(query: UserQuery): string | undefined {
  return query.q ?? query.search;
}

/** List items reuse the full profile shape. */
export type UserListItem = UserProfile;

/** Shape stored on User.favoriteFilms / recentLikes JSON columns. */
export const storedProfileFilmSchema = z.object({
  slug: z.string(),
  title: z.string(),
  year: z.number().nullable(),
  poster: z.string().nullable(),
});

export const storedExternalLinkSchema = z.object({
  label: z.string(),
  url: z.string().url(),
});
