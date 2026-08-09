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

/** Poll payload while first-time Letterboxd sync is still running. */
export const syncPendingResponseSchema = z.object({
  status: z.literal('RUNNING'),
  syncId: z.string(),
  username: z.string(),
  startedAt: z.string().datetime(),
  poll: z.string(),
});

export type SyncPendingResponse = z.infer<typeof syncPendingResponseSchema>;

/** GET /api/users/:username/sync/:syncId */
export const syncStatusResponseSchema = z.object({
  syncId: z.string(),
  username: z.string(),
  status: z.enum(['PENDING', 'RUNNING', 'SUCCESS', 'FAILED']),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  error: z.string().nullable().optional(),
});

export type SyncStatusResponse = z.infer<typeof syncStatusResponseSchema>;

export const syncIdParamSchema = z.object({
  username: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username may contain letters, numbers, _ and -'),
  syncId: z.string().min(1).max(64),
});

export const letterboxdFilmSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  year: z.number().int().nullable(),
  rating: z.number().min(0).max(5).nullable(),
  poster: z.string().nullable(),
  liked: z.boolean(),
});
