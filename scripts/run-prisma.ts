/**
 * Ensures DATABASE_URL is resolved from DB_* parts before running Prisma CLI.
 * Usage: bun run scripts/run-prisma.ts migrate deploy
 */
import { loadEnv, resetEnvCache } from '../src/app/config/env';

resetEnvCache();
loadEnv();

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: bun run scripts/run-prisma.ts <prisma-args...>');
  process.exit(1);
}

const result = Bun.spawnSync(['bunx', 'prisma', ...args], {
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL,
  },
});

process.exit(result.exitCode ?? 1);
