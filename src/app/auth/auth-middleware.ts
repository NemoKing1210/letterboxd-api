import type { Context, Next } from 'hono';
import { UnauthorizedError } from '../../shared/errors/app-error';
import type { AppContainer } from '../container';

export function isPublicPath(path: string, publicPaths: ReadonlySet<string>): boolean {
  return publicPaths.has(path);
}

export function authMiddleware(container: AppContainer) {
  const { authenticator } = container;

  return async (c: Context, next: Next) => {
    if (!authenticator.enabled) {
      await next();
      return;
    }

    if (isPublicPath(c.req.path, authenticator.publicPaths)) {
      await next();
      return;
    }

    const result = authenticator.authenticate({
      get: (name) => c.req.header(name),
    });

    if (!result.ok) {
      if (result.challenge) {
        c.header('WWW-Authenticate', result.challenge);
      }
      throw new UnauthorizedError();
    }

    c.set('authMethod', result.method);
    await next();
  };
}
