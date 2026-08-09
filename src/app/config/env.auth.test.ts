import { describe, expect, it } from 'vitest';
import { loadEnv, resetEnvCache } from './env';

const baseEnv = {
  DB_HOST: '127.0.0.1',
  DB_USER: 'postgres',
  DB_NAME: 'letterboxd',
  DB_PASSWORD: 'postgres',
};

describe('loadEnv auth', () => {
  it('defaults auth to disabled', () => {
    resetEnvCache();
    const env = loadEnv({ ...baseEnv } as NodeJS.ProcessEnv);
    expect(env.AUTH_ENABLED).toBe(false);
    expect(env.AUTH_METHODS).toEqual(['api_key', 'bearer']);
    expect(env.AUTH_TOKENS).toEqual([]);
    expect(env.AUTH_PUBLIC_PATHS).toEqual(['/health']);
  });

  it('parses AUTH_ENABLED and AUTH_TOKENS when enabled', () => {
    resetEnvCache();
    const env = loadEnv({
      ...baseEnv,
      AUTH_ENABLED: 'true',
      AUTH_METHODS: 'api_key,bearer',
      AUTH_TOKENS: ' secret-one , secret-two ',
    } as NodeJS.ProcessEnv);
    expect(env.AUTH_ENABLED).toBe(true);
    expect(env.AUTH_TOKENS).toEqual(['secret-one', 'secret-two']);
  });

  it('rejects enabled auth without tokens for api_key/bearer', () => {
    resetEnvCache();
    expect(() =>
      loadEnv({
        ...baseEnv,
        AUTH_ENABLED: 'true',
        AUTH_METHODS: 'api_key',
        AUTH_TOKENS: '',
      } as NodeJS.ProcessEnv),
    ).toThrow(/AUTH_TOKENS/);
  });

  it('rejects invalid AUTH_METHODS', () => {
    resetEnvCache();
    expect(() =>
      loadEnv({
        ...baseEnv,
        AUTH_METHODS: 'api_key,jwt',
      } as NodeJS.ProcessEnv),
    ).toThrow(/Invalid AUTH_METHODS/);
  });

  it('requires basic credentials when basic is enabled', () => {
    resetEnvCache();
    expect(() =>
      loadEnv({
        ...baseEnv,
        AUTH_ENABLED: 'true',
        AUTH_METHODS: 'basic',
        AUTH_BASIC_USERNAME: '',
        AUTH_BASIC_PASSWORD: 'x',
      } as NodeJS.ProcessEnv),
    ).toThrow(/AUTH_BASIC_USERNAME/);
  });

  it('rejects public paths without leading slash', () => {
    resetEnvCache();
    expect(() =>
      loadEnv({
        ...baseEnv,
        AUTH_ENABLED: 'true',
        AUTH_METHODS: 'api_key',
        AUTH_TOKENS: 'tok',
        AUTH_PUBLIC_PATHS: 'health',
      } as NodeJS.ProcessEnv),
    ).toThrow(/AUTH_PUBLIC_PATHS/);
  });
});
