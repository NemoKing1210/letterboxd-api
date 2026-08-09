import { z } from 'zod';
import { MAX_EXPORT_LIMIT, SEARCH_QUERY_MAX_LENGTH } from '../../../shared/constants';
import { movieSortSchema } from '../../users/schemas/user-schemas';
import { movieDtoSchema } from '../../movies/schemas/movie-schemas';

export const EXPORT_FORMATS = ['json', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const exportFormatSchema = z.enum(EXPORT_FORMATS);

export const exportFormatParamSchema = z.object({
  format: exportFormatSchema,
});

export const movieExportQuerySchema = z
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
    /** Optional; omit to export all matching rows (up to MAX_EXPORT_LIMIT). */
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(MAX_EXPORT_LIMIT).optional(),
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

export type MovieExportQuery = z.infer<typeof movieExportQuerySchema>;

/** Resolve list filters for the repository (`q` wins over alias `search`). */
export function resolveMovieExportSearch(query: MovieExportQuery): string | undefined {
  return query.q ?? query.search;
}

export const movieExportJsonSchema = z.object({
  items: z.array(movieDtoSchema),
  total: z.number().int(),
});

export type MovieExportJson = z.infer<typeof movieExportJsonSchema>;
