import { z } from '@hono/zod-openapi';
import { z as zod } from 'zod';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  SEARCH_MAX_CONDITIONS,
  SEARCH_QUERY_MAX_LENGTH,
} from '../../../shared/constants';
import { movieSortSchema } from '../../users/schemas/user-schemas';

export const searchFieldSchema = zod.enum([
  'title',
  'slug',
  'director',
  'genre',
  'year',
  'rating',
  'favorite',
  'watchedDate',
]);

export type SearchField = zod.infer<typeof searchFieldSchema>;

export const searchOperatorSchema = zod.enum([
  'eq',
  'neq',
  'contains',
  'startsWith',
  'endsWith',
  'in',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
]);

export type SearchOperator = zod.infer<typeof searchOperatorSchema>;

const searchValueSchema = zod.union([
  zod.string().min(1).max(SEARCH_QUERY_MAX_LENGTH),
  zod.number(),
  zod.boolean(),
  zod
    .array(zod.union([zod.string().min(1).max(SEARCH_QUERY_MAX_LENGTH), zod.number()]))
    .min(1)
    .max(32),
]);

export const searchAtomSchema = zod.object({
  field: searchFieldSchema,
  op: searchOperatorSchema,
  value: searchValueSchema,
  valueTo: zod.union([zod.string().min(1).max(SEARCH_QUERY_MAX_LENGTH), zod.number()]).optional(),
});

export type SearchAtom = zod.infer<typeof searchAtomSchema>;

export type SearchGroup = {
  op: 'and' | 'or';
  conditions: SearchFilterNode[];
};

export type SearchFilterNode = SearchAtom | SearchGroup;

/** Runtime recursive filter tree (not used directly in OpenAPI generation). */
export const searchGroupSchema: zod.ZodType<SearchGroup> = zod.lazy(() =>
  zod.object({
    op: zod.enum(['and', 'or']),
    conditions: zod
      .array(zod.union([searchAtomSchema, searchGroupSchema]))
      .min(1)
      .max(SEARCH_MAX_CONDITIONS),
  }),
);

export const searchFilterSchema: zod.ZodType<SearchFilterNode> = zod.union([
  searchAtomSchema,
  searchGroupSchema,
]);

export const searchBodySchema = zod.object({
  filter: searchFilterSchema.optional(),
  sort: movieSortSchema.default('rating_desc'),
  page: zod.number().int().min(1).default(DEFAULT_PAGE),
  limit: zod.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export type SearchBody = zod.infer<typeof searchBodySchema>;

/**
 * OpenAPI-safe request body. Filter shape is documented via description/example;
 * runtime validation uses {@link searchBodySchema}.
 */
export const searchBodyOpenApiSchema = z
  .object({
    filter: z
      .unknown()
      .optional()
      .openapi({
        description:
          'Nested filter tree. Groups: { op: "and"|"or", conditions: [...] }. Atoms: { field, op, value, valueTo? }. Fields: title, slug, director, genre, year, rating, favorite, watchedDate.',
        example: {
          op: 'and',
          conditions: [
            { field: 'title', op: 'contains', value: 'matrix' },
            { field: 'year', op: 'gte', value: 1990 },
          ],
        },
      }),
    sort: z
      .enum([
        'rating_desc',
        'rating_asc',
        'date_desc',
        'date_asc',
        'year_desc',
        'year_asc',
        'title_asc',
      ])
      .default('rating_desc'),
    page: z.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  })
  .openapi('SearchBody');
