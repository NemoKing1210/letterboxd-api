import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../shared/constants';
import { movieQuerySchema } from '../../users/schemas/user-schemas';

export { movieQuerySchema };
export type { MovieQuery } from '../../users/schemas/user-schemas';

export const favoritesFacetQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export type FavoritesFacetQuery = z.infer<typeof favoritesFacetQuerySchema>;

export const namedCountSchema = z.object({
  name: z.string(),
  count: z.number().int(),
});

export type NamedCount = z.infer<typeof namedCountSchema>;

export const favoritesFacetKindSchema = z.enum(['directors', 'genres', 'years']);

export type FavoritesFacetKind = z.infer<typeof favoritesFacetKindSchema>;
