import { z } from 'zod';

/** Movie DTO keys (list / export / search items). */
export const MOVIE_DTO_FIELDS = [
  'id',
  'title',
  'year',
  'slug',
  'url',
  'poster',
  'genres',
  'director',
  'rating',
  'favorite',
  'watchedDate',
] as const;

/** User profile keys (list items and GET profile). */
export const USER_PROFILE_FIELDS = [
  'username',
  'url',
  'moviesCount',
  'averageRating',
  'favoriteGenres',
  'lastSyncedAt',
  'followingCount',
  'followersCount',
  'externalLinks',
  'favoriteFilms',
  'recentLikes',
] as const;

/** Named count facet item keys. */
export const NAMED_COUNT_FIELDS = ['name', 'count'] as const;

/** Ratings summary top-level keys. */
export const RATINGS_FIELDS = [
  'averageRating',
  'ratingsCount',
  'bestMovies',
  'worstMovies',
  'distribution',
] as const;

/** Statistics top-level keys. */
export const STATISTICS_FIELDS = [
  'moviesWatched',
  'averageRating',
  'topGenres',
  'topDirectors',
  'topDecades',
] as const;

/** Recommendation item keys. */
export const RECOMMENDATION_ITEM_FIELDS = [
  'title',
  'reason',
  'score',
  'basedOn',
  'slug',
  'movieId',
  'year',
  'poster',
] as const;

/** Sync response top-level keys. */
export const SYNC_RESPONSE_FIELDS = [
  'syncId',
  'username',
  'status',
  'moviesSynced',
  'startedAt',
  'finishedAt',
  'error',
] as const;

export type MovieDtoField = (typeof MOVIE_DTO_FIELDS)[number];

/**
 * Parse a comma-separated `fields` query value against an allowlist.
 * Empty / whitespace-only → `undefined` (no filtering).
 * Preserves first-seen order; dedupes.
 */
export function parseFields(
  raw: string | undefined,
  allowed: readonly string[],
): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return undefined;
  }

  const allowedSet = new Set(allowed);
  const seen = new Set<string>();
  const fields: string[] = [];
  const unknown: string[] = [];

  for (const part of trimmed.split(',')) {
    const name = part.trim();
    if (name === '') {
      continue;
    }
    if (!allowedSet.has(name)) {
      unknown.push(name);
      continue;
    }
    if (!seen.has(name)) {
      seen.add(name);
      fields.push(name);
    }
  }

  if (unknown.length > 0) {
    throw new FieldsValidationError(
      `Unknown field(s): ${unknown.join(', ')}. Allowed: ${allowed.join(', ')}`,
      { unknown, allowed: [...allowed] },
    );
  }

  if (fields.length === 0) {
    return undefined;
  }

  return fields;
}

/** Error thrown by {@link parseFields}; convert to App ValidationError at boundaries if needed. */
export class FieldsValidationError extends Error {
  readonly details: { unknown: string[]; allowed: string[] };

  constructor(message: string, details: { unknown: string[]; allowed: string[] }) {
    super(message);
    this.name = 'FieldsValidationError';
    this.details = details;
  }
}

/** Pick only the requested keys from an object, in `fields` order. */
export function pickFields<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly string[],
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of fields) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      out[key as keyof T] = obj[key as keyof T];
    }
  }
  return out;
}

export function mapItemsFields<T extends Record<string, unknown>>(
  items: readonly T[],
  fields: readonly string[] | undefined,
): T[] | Array<Partial<T>> {
  if (!fields) {
    return [...items];
  }
  return items.map((item) => pickFields(item, fields));
}

/** Apply sparse fields to `items` of a paginated (or `{ items, total }`) envelope. */
export function applyItemFields<TItems extends object, TMeta extends { items: TItems[] }>(
  result: TMeta,
  fields: readonly string[] | undefined,
): TMeta {
  if (!fields) {
    return result;
  }
  return {
    ...result,
    // Full schema remains the OpenAPI contract; sparse responses omit keys at runtime.
    items: result.items.map((item) => pickFields(item as Record<string, unknown>, fields)) as TItems[],
  };
}

/** Apply sparse fields to a top-level response object. */
export function applyObjectFields<T extends object>(
  obj: T,
  fields: readonly string[] | undefined,
): T {
  if (!fields) {
    return obj;
  }
  // Full schema remains the OpenAPI contract; sparse responses omit keys at runtime.
  return pickFields(obj as Record<string, unknown>, fields) as T;
}

/**
 * Zod field for optional comma-separated `fields` query param.
 * OpenAPI sees a string; runtime output is `string[] | undefined`.
 */
export function fieldsQueryField(allowed: readonly string[]) {
  return z
    .string()
    .optional()
    .superRefine((raw, ctx) => {
      if (raw === undefined) {
        return;
      }
      try {
        parseFields(raw, allowed);
      } catch (error) {
        if (error instanceof FieldsValidationError) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: error.message,
          });
          return;
        }
        throw error;
      }
    })
    .transform((raw) => parseFields(raw, allowed));
}

/** Standalone query schema `{ fields?: string[] }` for routes without other query params. */
export function fieldsOnlyQuerySchema(allowed: readonly string[]) {
  return z.object({
    fields: fieldsQueryField(allowed),
  });
}
