import { z } from 'zod';

export const syncResponseSchema = z.object({
  syncId: z.string(),
  username: z.string(),
  status: z.enum(['PENDING', 'RUNNING', 'SUCCESS', 'FAILED']),
  moviesSynced: z.number().int().nonnegative(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  error: z.string().nullable().optional(),
});

export type SyncResponse = z.infer<typeof syncResponseSchema>;

export const letterboxdFilmSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  year: z.number().int().nullable(),
  rating: z.number().min(0).max(5).nullable(),
  poster: z.string().nullable(),
  liked: z.boolean(),
});
