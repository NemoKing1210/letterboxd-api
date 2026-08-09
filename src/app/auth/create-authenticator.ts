import type { Env } from '../config/env';
import { authenticateWithMethods } from './strategies';
import type { AuthAuthenticator, AuthHeaders, AuthResult } from './types';

export function createAuthenticator(env: Env): AuthAuthenticator {
  const methods = env.AUTH_METHODS;
  const publicPaths = new Set(env.AUTH_PUBLIC_PATHS);
  const tokenConfig = { tokens: env.AUTH_TOKENS };
  const basicConfig = {
    username: env.AUTH_BASIC_USERNAME,
    password: env.AUTH_BASIC_PASSWORD,
  };

  if (!env.AUTH_ENABLED) {
    return {
      enabled: false,
      methods,
      publicPaths,
      authenticate(): AuthResult {
        return { ok: true, method: methods[0] ?? 'api_key' };
      },
    };
  }

  return {
    enabled: true,
    methods,
    publicPaths,
    authenticate(headers: AuthHeaders): AuthResult {
      return authenticateWithMethods(headers, methods, tokenConfig, basicConfig);
    },
  };
}
