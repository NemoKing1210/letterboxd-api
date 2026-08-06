import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
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

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}
