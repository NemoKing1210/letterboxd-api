import { z } from 'zod';
import { buildDatabaseUrl } from './database-url';

export const AUTH_METHODS = ['api_key', 'bearer', 'basic'] as const;
export type AuthMethodName = (typeof AUTH_METHODS)[number];

const optionalProxyUrl = z
  .string()
  .optional()
  .default('')
  .superRefine((value, ctx) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Must be an http:// or https:// URL',
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be a valid proxy URL',
      });
    }
  });

const booleanish = z
  .union([z.boolean(), z.string()])
  .optional()
  .default(false)
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  });

/** Same as booleanish but defaults to true when unset. */
const booleanishDefaultTrue = z
  .union([z.boolean(), z.string()])
  .optional()
  .default(true)
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === '0' || normalized === 'false' || normalized === 'no') {
      return false;
    }
    return true;
  });

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

const envSchema = z
  .object({
    DATABASE_URL: z.string().optional().default(''),
    DB_HOST: z.string().optional().default(''),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_USER: z.string().optional().default(''),
    DB_PASSWORD: z.string().optional().default(''),
    DB_NAME: z.string().optional().default(''),
    DB_SCHEMA: z.string().optional().default('public'),
    SUPABASE_URL: z.string().optional().default(''),
    SUPABASE_KEY: z.string().optional().default(''),
    HTTP_PROXY: optionalProxyUrl,
    HTTPS_PROXY: optionalProxyUrl,
    NO_PROXY: z.string().optional().default(''),
    LETTERBOXD_TIMEOUT: z.coerce.number().int().positive().default(15_000),
    LETTERBOXD_PAGE_DELAY_MS: z.preprocess((value) => {
      if (value === undefined || value === null || value === '') {
        return process.env.VERCEL ? 200 : 500;
      }
      return value;
    }, z.coerce.number().int().nonnegative()),
    LETTERBOXD_MAX_PAGES: z.coerce.number().int().positive().default(50),
    LETTERBOXD_ENRICH_CONCURRENCY: z.coerce.number().int().positive().default(8),
    LETTERBOXD_ENRICH_RETRIES: z.coerce.number().int().positive().default(3),
    CACHE_TTL: z.coerce.number().int().positive().default(300),
    /** Max age of a successful user sync before GET endpoints re-sync. 0 disables stale refresh. */
    USER_SYNC_TTL_SECONDS: z.coerce.number().int().nonnegative().default(43_200),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    /** Stricter per-IP cap for export endpoints (heavier payloads). */
    RATE_LIMIT_EXPORT_MAX: z.coerce.number().int().positive().default(10),
    CORS_ORIGIN: z.string().default('*'),
    AUTH_ENABLED: booleanish,
    AUTH_METHODS: z.string().optional().default('api_key,bearer'),
    AUTH_TOKENS: z.string().optional().default(''),
    AUTH_BASIC_USERNAME: z.string().optional().default(''),
    AUTH_BASIC_PASSWORD: z.string().optional().default(''),
    AUTH_PUBLIC_PATHS: z
      .string()
      .optional()
      .default('/health,/privacy,/openapi-gpt-actions.yaml'),
    OPENAI_API_KEY: z.string().optional().default(''),
    OPENAI_BASE_URL: z.string().optional().default('https://api.openai.com/v1'),
    OPENAI_EMBEDDING_MODEL: z.string().optional().default('text-embedding-3-small'),
    OPENAI_CHAT_MODEL: z.string().optional().default('gpt-4o-mini'),
    OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    OPENAI_MAX_RETRIES: z.coerce.number().int().positive().default(3),
    RECOMMENDATION_ENGINE: z.enum(['auto', 'ai', 'rules']).default('auto'),
    AI_RECOMMEND_CANDIDATE_POOL: z.coerce.number().int().positive().default(20),
    AI_EMBED_BUDGET: z.coerce.number().int().positive().default(48),
    AI_EMBED_BATCH_SIZE: z.coerce.number().int().positive().default(16),
    AI_RECOMMEND_USE_LLM: booleanishDefaultTrue,
    /**
     * Soft request budget (ms) for scrape/enrichment before yielding.
     * Unset: on Vercel defaults under function maxDuration; locally unlimited.
     */
    REQUEST_BUDGET_MS: z.preprocess(
      (value) => (value === '' || value === undefined || value === null ? undefined : value),
      z.coerce.number().int().positive().optional(),
    ),
  })
  .superRefine((data, ctx) => {
    const hasUrl = Boolean(data.DATABASE_URL?.trim());
    const hasParts = Boolean(data.DB_HOST?.trim() && data.DB_USER?.trim() && data.DB_NAME?.trim());
    if (!hasUrl && !hasParts) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide DATABASE_URL or DB_HOST + DB_USER + DB_NAME',
        path: ['DATABASE_URL'],
      });
    }

    const methods = parseCsv(data.AUTH_METHODS);
    const allowed = new Set<string>(AUTH_METHODS);
    const invalid = methods.filter((method) => !allowed.has(method));
    if (invalid.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid AUTH_METHODS: ${invalid.join(', ')}. Allowed: ${AUTH_METHODS.join(', ')}`,
        path: ['AUTH_METHODS'],
      });
    }

    if (data.RECOMMENDATION_ENGINE === 'ai' && !data.OPENAI_API_KEY.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OPENAI_API_KEY is required when RECOMMENDATION_ENGINE=ai',
        path: ['OPENAI_API_KEY'],
      });
    }

    if (!data.AUTH_ENABLED) {
      return;
    }

    if (methods.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'AUTH_METHODS must list at least one method when AUTH_ENABLED=true',
        path: ['AUTH_METHODS'],
      });
    }

    const usesToken = methods.includes('api_key') || methods.includes('bearer');
    if (usesToken && parseCsv(data.AUTH_TOKENS).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'AUTH_TOKENS must include at least one token when api_key or bearer is enabled',
        path: ['AUTH_TOKENS'],
      });
    }

    if (methods.includes('basic')) {
      if (!data.AUTH_BASIC_USERNAME.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'AUTH_BASIC_USERNAME is required when basic auth is enabled',
          path: ['AUTH_BASIC_USERNAME'],
        });
      }
      if (!data.AUTH_BASIC_PASSWORD.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'AUTH_BASIC_PASSWORD is required when basic auth is enabled',
          path: ['AUTH_BASIC_PASSWORD'],
        });
      }
    }

    for (const path of parseCsv(data.AUTH_PUBLIC_PATHS)) {
      if (!path.startsWith('/')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `AUTH_PUBLIC_PATHS entries must start with / (got "${path}")`,
          path: ['AUTH_PUBLIC_PATHS'],
        });
      }
    }
  })
  .transform((data) => {
    const DATABASE_URL = buildDatabaseUrl({
      DATABASE_URL: data.DATABASE_URL,
      DB_HOST: data.DB_HOST,
      DB_PORT: data.DB_PORT,
      DB_USER: data.DB_USER,
      DB_PASSWORD: data.DB_PASSWORD,
      DB_NAME: data.DB_NAME,
      DB_SCHEMA: data.DB_SCHEMA,
    });

    const authMethods = parseCsv(data.AUTH_METHODS).filter((method): method is AuthMethodName =>
      (AUTH_METHODS as readonly string[]).includes(method),
    );

    return {
      ...data,
      DATABASE_URL,
      HTTP_PROXY: data.HTTP_PROXY.trim(),
      HTTPS_PROXY: data.HTTPS_PROXY.trim(),
      NO_PROXY: data.NO_PROXY.trim(),
      AUTH_METHODS: authMethods,
      AUTH_TOKENS: parseCsv(data.AUTH_TOKENS),
      AUTH_BASIC_USERNAME: data.AUTH_BASIC_USERNAME.trim(),
      AUTH_BASIC_PASSWORD: data.AUTH_BASIC_PASSWORD.trim(),
      AUTH_PUBLIC_PATHS: parseCsv(data.AUTH_PUBLIC_PATHS),
      OPENAI_API_KEY: data.OPENAI_API_KEY.trim(),
      OPENAI_BASE_URL: data.OPENAI_BASE_URL.trim() || 'https://api.openai.com/v1',
    };
  });

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  if (cachedEnv && process.env.NODE_ENV !== 'test') {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  // Prisma reads process.env.DATABASE_URL — keep it in sync when using DB_* parts.
  process.env.DATABASE_URL = parsed.data.DATABASE_URL;

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}
