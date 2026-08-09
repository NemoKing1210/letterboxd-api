import type { Context, Next } from 'hono';
import { RateLimitError } from '../../shared/errors/app-error';
import type { AppContainer } from '../container';

export { authMiddleware } from '../auth/auth-middleware';

export function requestIdMiddleware() {
  return async (c: Context, next: Next) => {
    const existing = c.req.header('x-request-id');
    const requestId = existing && existing.length > 0 ? existing : crypto.randomUUID();
    c.set('requestId', requestId);
    c.header('X-Request-Id', requestId);
    await next();
  };
}

export function securityHeadersMiddleware() {
  return async (c: Context, next: Next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('X-XSS-Protection', '0');
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  };
}

export function requestLoggingMiddleware(container: AppContainer) {
  return async (c: Context, next: Next) => {
    const started = Date.now();
    await next();
    container.logger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Date.now() - started,
        requestId: c.get('requestId'),
      },
      'HTTP request',
    );
  };
}

type RateBucket = { count: number; resetAt: number };

export function rateLimitMiddleware(container: AppContainer) {
  const buckets = new Map<string, RateBucket>();
  const windowMs = container.env.RATE_LIMIT_WINDOW_MS;
  const max = container.env.RATE_LIMIT_MAX;

  return async (c: Context, next: Next) => {
    const key = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      throw new RateLimitError();
    }

    await next();
  };
}
