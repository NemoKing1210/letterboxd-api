import { z } from 'zod';
import { movieQuerySchema } from '../../users/schemas/user-schemas';

export { movieQuerySchema };
export type { MovieQuery } from '../../users/schemas/user-schemas';

export const movieDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  year: z.number().nullable(),
  slug: z.string().nullable(),
  poster: z.string().nullable(),
  genres: z.array(z.string()),
  director: z.string().nullable(),
  rating: z.number().nullable(),
  favorite: z.boolean(),
  watchedDate: z.string().nullable(),
});

export type MovieDto = z.infer<typeof movieDtoSchema>;
