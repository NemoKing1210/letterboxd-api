import type { AuthHeaders, AuthMethod, AuthResult } from './types';
import { timingSafeEqualString, timingSafeIncludes } from './timing-safe';

export type TokenAuthConfig = {
  tokens: readonly string[];
};

export type BasicAuthConfig = {
  username: string;
  password: string;
};

export function tryApiKeyAuth(headers: AuthHeaders, config: TokenAuthConfig): AuthResult {
  const apiKey = headers.get('x-api-key');
  if (!apiKey) {
    return { ok: false };
  }
  if (timingSafeIncludes(config.tokens, apiKey)) {
    return { ok: true, method: 'api_key' };
  }
  return { ok: false };
}

export function tryBearerAuth(headers: AuthHeaders, config: TokenAuthConfig): AuthResult {
  const authorization = headers.get('authorization');
  if (!authorization) {
    return { ok: false, challenge: 'Bearer' };
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match?.[1]) {
    return { ok: false, challenge: 'Bearer' };
  }

  if (timingSafeIncludes(config.tokens, match[1].trim())) {
    return { ok: true, method: 'bearer' };
  }
  return { ok: false, challenge: 'Bearer' };
}

export function tryBasicAuth(headers: AuthHeaders, config: BasicAuthConfig): AuthResult {
  const challenge = 'Basic realm="letterboxd-api"';
  const authorization = headers.get('authorization');
  if (!authorization) {
    return { ok: false, challenge };
  }

  const match = /^Basic\s+(.+)$/i.exec(authorization.trim());
  if (!match?.[1]) {
    return { ok: false, challenge };
  }

  let decoded: string;
  try {
    decoded = Buffer.from(match[1].trim(), 'base64').toString('utf8');
  } catch {
    return { ok: false, challenge };
  }

  const separator = decoded.indexOf(':');
  if (separator < 0) {
    return { ok: false, challenge };
  }

  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  const userOk = timingSafeEqualString(username, config.username);
  const passOk = timingSafeEqualString(password, config.password);
  if (userOk && passOk) {
    return { ok: true, method: 'basic' };
  }
  return { ok: false, challenge };
}

export function authenticateWithMethods(
  headers: AuthHeaders,
  methods: readonly AuthMethod[],
  tokenConfig: TokenAuthConfig,
  basicConfig: BasicAuthConfig,
): AuthResult {
  const challenges: string[] = [];

  for (const method of methods) {
    let result: AuthResult;
    switch (method) {
      case 'api_key':
        result = tryApiKeyAuth(headers, tokenConfig);
        break;
      case 'bearer':
        result = tryBearerAuth(headers, tokenConfig);
        break;
      case 'basic':
        result = tryBasicAuth(headers, basicConfig);
        break;
      default: {
        const _exhaustive: never = method;
        return _exhaustive;
      }
    }

    if (result.ok) {
      return result;
    }
    if (result.challenge && !challenges.includes(result.challenge)) {
      challenges.push(result.challenge);
    }
  }

  return {
    ok: false,
    challenge: challenges.length > 0 ? challenges.join(', ') : undefined,
  };
}
