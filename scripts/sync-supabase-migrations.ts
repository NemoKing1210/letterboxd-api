/**
 * Mirrors Prisma migration SQL into `supabase/migrations/` for Supabase GitHub
 * integration / `supabase db push`. Prisma remains the schema authoring source.
 *
 * Usage: bun run scripts/sync-supabase-migrations.ts
 */
/* eslint-disable no-console -- CLI progress output */
import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const PRISMA_MIGRATIONS = join(ROOT, 'prisma', 'migrations');
const SUPABASE_MIGRATIONS = join(ROOT, 'supabase', 'migrations');

const HEADER = `-- Mirrored from prisma/migrations — do not edit by hand.
-- Regenerate: bun run db:sync:supabase
`;

async function main(): Promise<void> {
  const entries = await readdir(PRISMA_MIGRATIONS, { withFileTypes: true });
  const folders = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  if (folders.length === 0) {
    console.error('No Prisma migrations found under prisma/migrations/');
    process.exit(1);
  }

  await rm(SUPABASE_MIGRATIONS, { recursive: true, force: true });
  await mkdir(SUPABASE_MIGRATIONS, { recursive: true });

  for (const folder of folders) {
    const source = join(PRISMA_MIGRATIONS, folder, 'migration.sql');
    const sql = await readFile(source, 'utf8');
    const target = join(SUPABASE_MIGRATIONS, `${folder}.sql`);
    await writeFile(target, `${HEADER}\n${sql.trimEnd()}\n`, 'utf8');
    console.log(`synced ${folder}.sql`);
  }

  console.log(`Done — ${folders.length} migration(s) → supabase/migrations/`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
