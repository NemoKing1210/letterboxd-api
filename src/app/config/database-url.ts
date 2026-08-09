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

export function buildDatabaseUrl(parts: DatabaseEnvParts): string {
  const explicit = parts.DATABASE_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const host = parts.DB_HOST?.trim();
  const user = parts.DB_USER?.trim();
  const password = parts.DB_PASSWORD ?? '';
  const name = parts.DB_NAME?.trim();
  const port = String(parts.DB_PORT ?? '5432').trim();
  const schema = (parts.DB_SCHEMA?.trim() || 'public');

  if (!host || !user || !name) {
    throw new Error(
      'Database config missing: set DATABASE_URL or DB_HOST, DB_USER, and DB_NAME',
    );
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const auth = password === '' ? encodedUser : `${encodedUser}:${encodedPassword}`;

  return `postgresql://${auth}@${host}:${port}/${name}?schema=${encodeURIComponent(schema)}`;
}
