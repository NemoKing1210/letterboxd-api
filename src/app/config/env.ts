import { z } from 'zod';
import { buildDatabaseUrl } from './database-url';

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
    LETTERBOXD_TIMEOUT: z.coerce.number().int().positive().default(15_000),
    LETTERBOXD_PAGE_DELAY_MS: z.coerce.number().int().nonnegative().default(500),
    LETTERBOXD_MAX_PAGES: z.coerce.number().int().positive().default(50),
    CACHE_TTL: z.coerce.number().int().positive().default(300),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    CORS_ORIGIN: z.string().default('*'),
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

    return {
      ...data,
      DATABASE_URL,
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
