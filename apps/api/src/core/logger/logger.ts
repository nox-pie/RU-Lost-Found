import { createRequire } from 'node:module';
import { pino, type Logger, type LoggerOptions } from 'pino';
import type { Env } from '../../config/env';

export type { Logger };

/** pino-pretty is a dev dependency: production images (and `npm ci --omit=dev`) don't have it. */
function prettyPrinterInstalled(): boolean {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

/**
 * Structured JSON logger. Human-readable output in development, JSON everywhere else
 * so log platforms can index fields such as `requestId`.
 */
export function createLogger(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): Logger {
  const options: LoggerOptions = {
    level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
    base: { service: 'ru-lost-found-api' },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      censor: '[redacted]',
    },
  };

  if (env.NODE_ENV === 'development' && prettyPrinterInstalled()) {
    options.transport = { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss' } };
  }

  return pino(options);
}
