/**
 * Interactive helper to link the repo to Vercel and pull env locally.
 * Usage: bun run setup:vercel
 */
/* eslint-disable no-console -- CLI progress output */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const vercelDir = join(root, '.vercel');

function run(cmd: string[], inherit = true): number {
  const result = Bun.spawnSync(cmd, {
    cwd: root,
    stdout: inherit ? 'inherit' : 'pipe',
    stderr: inherit ? 'inherit' : 'pipe',
    stdin: inherit ? 'inherit' : undefined,
  });
  return result.exitCode ?? 1;
}

function hasVercelCli(): boolean {
  const result = Bun.spawnSync(['vercel', '--version'], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return (result.exitCode ?? 1) === 0;
}

console.log('Letterboxd API — Vercel setup\n');

if (!hasVercelCli()) {
  console.error('Vercel CLI not found. Install it first:\n');
  console.error('  bun add -g vercel\n  # or: npm i -g vercel\n');
  console.error('Then run: bun run setup:vercel');
  process.exit(1);
}

if (!existsSync(vercelDir)) {
  console.log('Linking this directory to a Vercel project…\n');
  const linkCode = run(['vercel', 'link']);
  if (linkCode !== 0) {
    process.exit(linkCode);
  }
} else {
  console.log('Already linked (.vercel/ present). Skipping vercel link.\n');
}

console.log('Pulling Production env into .env.local…\n');
const pullCode = run(['vercel', 'env', 'pull', '.env.local', '--environment', 'production', '--yes']);
if (pullCode !== 0) {
  console.error('\nEnv pull failed. Add variables in the Vercel dashboard first — see .env.vercel.example');
  process.exit(pullCode);
}

console.log(`
Next steps:
  1. Ensure Postgres migrations are applied (Direct or Session pooler — not transaction :6543):
       set DATABASE_URL=<migrate-url>
       bun run db:migrate:deploy
  2. Match Supabase region in vercel.json "regions" if you add one (see docs/vercel.md)
  3. Runtime DATABASE_URL on Vercel should be transaction pooler (:6543 + pgbouncer=true)
  4. Preview like production:
       bun run vercel:dev
  5. Deploy:
       bun run deploy

Guides: docs/supabase.md · docs/vercel.md
`);
