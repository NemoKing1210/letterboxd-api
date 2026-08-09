import { describe, expect, it } from 'vitest';
import { buildDatabaseUrl } from './database-url';
import { loadEnv, resetEnvCache } from './env';

describe('buildDatabaseUrl', () => {
  it('prefers explicit DATABASE_URL', () => {
    expect(
      buildDatabaseUrl({
        DATABASE_URL: 'postgresql://a:b@host:5432/db?schema=public',
        DB_HOST: 'ignored',
      }),
    ).toBe('postgresql://a:b@host:5432/db?schema=public');
  });

  it('builds URL from discrete parts', () => {
    expect(
      buildDatabaseUrl({
        DB_HOST: '127.0.0.1',
        DB_PORT: 5432,
        DB_USER: 'postgres',
        DB_PASSWORD: 'secret',
        DB_NAME: 'letterboxd',
        DB_SCHEMA: 'public',
      }),
    ).toBe('postgresql://postgres:secret@127.0.0.1:5432/letterboxd?schema=public');
  });

  it('encodes special characters in password', () => {
    expect(
      buildDatabaseUrl({
        DB_HOST: 'localhost',
        DB_USER: 'user',
        DB_PASSWORD: 'p@ss/word',
        DB_NAME: 'letterboxd',
      }),
    ).toBe('postgresql://user:p%40ss%2Fword@localhost:5432/letterboxd?schema=public');
  });
});

describe('loadEnv database resolution', () => {
  it('resolves DATABASE_URL from DB_* and sets process.env', () => {
    resetEnvCache();
    const env = loadEnv({
      NODE_ENV: 'test',
      DB_HOST: '127.0.0.1',
      DB_PORT: '5432',
      DB_USER: 'postgres',
      DB_PASSWORD: 'postgres',
      DB_NAME: 'letterboxd',
    } as NodeJS.ProcessEnv);

    expect(env.DATABASE_URL).toContain('127.0.0.1:5432/letterboxd');
    expect(process.env.DATABASE_URL).toBe(env.DATABASE_URL);
  });
});
