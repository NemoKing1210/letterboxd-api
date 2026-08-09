import { describe, expect, it } from 'vitest';
import { timingSafeEqualString, timingSafeIncludes } from './timing-safe';
import {
  authenticateWithMethods,
  tryApiKeyAuth,
  tryBasicAuth,
  tryBearerAuth,
} from './strategies';
import { createAuthenticator } from './create-authenticator';
import { isPublicPath } from './auth-middleware';
import type { Env } from '../config/env';

function headers(map: Record<string, string>) {
  const normalized = Object.fromEntries(
    Object.entries(map).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    get: (name: string) => normalized[name.toLowerCase()],
  };
}

describe('timingSafeEqualString', () => {
  it('matches equal strings', () => {
    expect(timingSafeEqualString('abc', 'abc')).toBe(true);
  });

  it('rejects different strings and lengths', () => {
    expect(timingSafeEqualString('abc', 'abd')).toBe(false);
    expect(timingSafeEqualString('abc', 'ab')).toBe(false);
  });

  it('includes any candidate', () => {
    expect(timingSafeIncludes(['a', 'b', 'c'], 'b')).toBe(true);
    expect(timingSafeIncludes(['a', 'b'], 'z')).toBe(false);
  });
});

describe('auth strategies', () => {
  const tokens = { tokens: ['secret-token', 'rotated-token'] };

  it('accepts valid X-API-Key', () => {
    const result = tryApiKeyAuth(headers({ 'X-API-Key': 'rotated-token' }), tokens);
    expect(result).toEqual({ ok: true, method: 'api_key' });
  });

  it('rejects missing or invalid api key', () => {
    expect(tryApiKeyAuth(headers({}), tokens).ok).toBe(false);
    expect(tryApiKeyAuth(headers({ 'X-API-Key': 'nope' }), tokens).ok).toBe(false);
  });

  it('accepts valid Bearer token', () => {
    const result = tryBearerAuth(headers({ Authorization: 'Bearer secret-token' }), tokens);
    expect(result).toEqual({ ok: true, method: 'bearer' });
  });

  it('rejects invalid Bearer and sets challenge', () => {
    const result = tryBearerAuth(headers({ Authorization: 'Bearer nope' }), tokens);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.challenge).toBe('Bearer');
    }
  });

  it('accepts valid Basic credentials', () => {
    const encoded = Buffer.from('admin:pass', 'utf8').toString('base64');
    const result = tryBasicAuth(headers({ Authorization: `Basic ${encoded}` }), {
      username: 'admin',
      password: 'pass',
    });
    expect(result).toEqual({ ok: true, method: 'basic' });
  });

  it('rejects invalid Basic credentials', () => {
    const encoded = Buffer.from('admin:wrong', 'utf8').toString('base64');
    const result = tryBasicAuth(headers({ Authorization: `Basic ${encoded}` }), {
      username: 'admin',
      password: 'pass',
    });
    expect(result.ok).toBe(false);
  });

  it('succeeds when any configured method matches', () => {
    const result = authenticateWithMethods(
      headers({ 'X-API-Key': 'secret-token' }),
      ['bearer', 'api_key'],
      tokens,
      { username: 'a', password: 'b' },
    );
    expect(result).toEqual({ ok: true, method: 'api_key' });
  });
});

describe('createAuthenticator', () => {
  const baseEnv = {
    AUTH_ENABLED: false,
    AUTH_METHODS: ['api_key', 'bearer'] as const,
    AUTH_TOKENS: [] as string[],
    AUTH_BASIC_USERNAME: '',
    AUTH_BASIC_PASSWORD: '',
    AUTH_PUBLIC_PATHS: ['/health'],
  } as unknown as Env;

  it('noop when disabled', () => {
    const auth = createAuthenticator(baseEnv);
    expect(auth.enabled).toBe(false);
    expect(auth.authenticate(headers({})).ok).toBe(true);
  });

  it('validates tokens when enabled', () => {
    const auth = createAuthenticator({
      ...baseEnv,
      AUTH_ENABLED: true,
      AUTH_TOKENS: ['tok'],
    } as unknown as Env);
    expect(auth.enabled).toBe(true);
    expect(auth.authenticate(headers({ 'X-API-Key': 'tok' })).ok).toBe(true);
    expect(auth.authenticate(headers({})).ok).toBe(false);
  });
});

describe('isPublicPath', () => {
  it('matches exact paths only', () => {
    const paths = new Set(['/health', '/docs']);
    expect(isPublicPath('/health', paths)).toBe(true);
    expect(isPublicPath('/docs', paths)).toBe(true);
    expect(isPublicPath('/openapi.json', paths)).toBe(false);
  });
});
