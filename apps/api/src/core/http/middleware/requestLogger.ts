import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { pinoHttp } from 'pino-http';
import type { Logger } from '../../logger/logger';

const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[\w-]{1,64}$/;
const QUIET_PATHS = new Set(['/api/v1/health/live']);

/**
 * Reuses a well-formed incoming X-Request-Id (so a request can be traced across services),
 * otherwise generates one. The id is echoed back in the response header.
 */
function resolveRequestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const id =
    typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', id);
  return id;
}

/** Assigns `req.id`, attaches a child logger as `req.log`, and logs one line per completed request. */
export function requestLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: resolveRequestId,
    customAttributeKeys: { reqId: 'requestId' },
    autoLogging: { ignore: (req) => QUIET_PATHS.has(req.url ?? '') },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    // pino-http attaches a synthetic "failed with status code 5xx" stack to 5xx lines.
    // Real errors are already logged with their own stack by the error handler, so drop it.
    customErrorObject: (_req, _res, _err, value: Record<string, unknown>) => ({
      ...value,
      err: undefined,
    }),
    serializers: {
      req: (req: { id: string; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  });
}
