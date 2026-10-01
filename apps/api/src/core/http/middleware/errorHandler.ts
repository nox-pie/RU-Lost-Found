import type { ErrorRequestHandler, Response } from 'express';
import {
  ERROR_CODES,
  type ApiErrorBody,
  type ErrorCode,
  type ErrorDetail,
} from '@ru-lost-found/shared';
import { AppError, RateLimitError, ServiceBusyError } from '../../errors/AppError';
import { noErrorReporting, type ErrorReporter } from '../../observability/ErrorReporter';

function send(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  requestId: string | undefined,
  details?: ErrorDetail[],
): void {
  const body: ApiErrorBody = { error: { code, message, requestId } };
  if (details?.length) body.error.details = details;
  res.status(status).json(body);
}

/** Errors raised by Express's body parser carry a `type` field. */
function bodyParserErrorType(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string') {
    return err.type;
  }
  return undefined;
}

/**
 * The single place where errors become HTTP responses.
 * Known errors map to their status and code; anything else is logged, reported to error tracking
 * and hidden behind a generic 500, so internal messages and stack traces never reach the client.
 */
export function createErrorHandler(
  reporter: ErrorReporter = noErrorReporting,
): ErrorRequestHandler {
  return (err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const requestId = typeof req.id === 'string' ? req.id : undefined;
    const report = () =>
      reporter.capture(err, {
        area: 'http',
        requestId,
        userId: req.auth?.userId,
        route: `${req.method} ${req.baseUrl}${req.route ? String((req.route as { path: unknown }).path) : ''}`,
      });

    if (err instanceof AppError) {
      if (err instanceof RateLimitError || err instanceof ServiceBusyError) {
        res.setHeader('Retry-After', String(err.retryAfterSeconds));
      }
      if (err.httpStatus >= 500) {
        req.log.error({ err }, err.message);
        // A busy server is expected under load; everything else at 5xx is worth a look.
        if (!(err instanceof ServiceBusyError)) report();
      }
      send(res, err.httpStatus, err.code, err.message, requestId, err.details);
      return;
    }

    switch (bodyParserErrorType(err)) {
      case 'entity.parse.failed':
        send(
          res,
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'The request body is not valid JSON.',
          requestId,
        );
        return;
      case 'entity.too.large':
        send(res, 413, ERROR_CODES.PAYLOAD_TOO_LARGE, 'The request is too large.', requestId);
        return;
    }

    req.log.error({ err }, 'Unhandled error');
    report();
    send(
      res,
      500,
      ERROR_CODES.INTERNAL_ERROR,
      'Something went wrong. Please try again.',
      requestId,
    );
  };
}

/** Without error tracking (tests, small apps). */
export const errorHandler = createErrorHandler();
