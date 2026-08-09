/**
 * Build a PostgreSQL connection URL from discrete parts or a full DATABASE_URL.
 * Prisma always consumes DATABASE_URL; this keeps OpenServer-friendly env vars.
 */
export type DatabaseEnvParts = {
  DATABASE_URL?: string;
  DB_HOST?: string;
  DB_PORT?: string | number;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_NAME?: string;
  DB_SCHEMA?: string;
};

/**
 * Supabase / PgBouncer transaction poolers (port 6543) reject Prisma prepared
 * statements unless `pgbouncer=true`. Serverless also needs a low connection_limit.
 */
export function normalizeDatabaseUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (parsed.port !== '6543') {
    return url;
  }

  if (!parsed.searchParams.has('pgbouncer')) {
    parsed.searchParams.set('pgbouncer', 'true');
  }
  if (!parsed.searchParams.has('schema')) {
    parsed.searchParams.set('schema', 'public');
  }
  if (!parsed.searchParams.has('connection_limit')) {
    parsed.searchParams.set('connection_limit', '1');
  }

  return parsed.toString();
}

export function buildDatabaseUrl(parts: DatabaseEnvParts): string {
  const explicit = parts.DATABASE_URL?.trim();
  if (explicit) {
    return normalizeDatabaseUrl(explicit);
  }

  const host = parts.DB_HOST?.trim();
  const user = parts.DB_USER?.trim();
  const password = parts.DB_PASSWORD ?? '';
  const name = parts.DB_NAME?.trim();
  const port = String(parts.DB_PORT ?? '5432').trim();
  const schema = parts.DB_SCHEMA?.trim() || 'public';

  if (!host || !user || !name) {
    throw new Error(
      'Database config missing: set DATABASE_URL or DB_HOST, DB_USER, and DB_NAME',
    );
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const auth = password === '' ? encodedUser : `${encodedUser}:${encodedPassword}`;

  return normalizeDatabaseUrl(
    `postgresql://${auth}@${host}:${port}/${name}?schema=${encodeURIComponent(schema)}`,
  );
}
