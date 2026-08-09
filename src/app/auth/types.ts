import type { AuthMethodName } from '../config/env';

export type AuthMethod = AuthMethodName;

export type AuthResult =
  | { ok: true; method: AuthMethod }
  | { ok: false; challenge?: string };

export type AuthHeaders = {
  get(name: string): string | undefined;
};

export interface AuthAuthenticator {
  readonly enabled: boolean;
  readonly methods: readonly AuthMethod[];
  readonly publicPaths: ReadonlySet<string>;
  authenticate(headers: AuthHeaders): AuthResult;
}
