import pino, { type Logger } from 'pino';
import type { Env } from '../../app/config/env';

export function createLogger(env: Env): Logger {
  return pino({
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
            },
          }
        : undefined,
  });
}

export type AppLogger = Logger;
