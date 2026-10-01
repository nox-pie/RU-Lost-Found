import { ERROR_CODES, type ErrorCode, type ErrorDetail } from '@ru-lost-found/shared';

/**
 * Base class for every error the API reports to clients on purpose.
 * Anything that is not an AppError is treated as an unexpected 500.
 */
export abstract class AppError extends Error {
  abstract readonly httpStatus: number;
  abstract readonly code: ErrorCode;

  constructor(
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  readonly httpStatus = 400;
  readonly code: ErrorCode = ERROR_CODES.VALIDATION_ERROR;

  constructor(message = 'The request is invalid.', details?: ErrorDetail[]) {
    super(message, details);
  }
}

export class UnauthorizedError extends AppError {
  readonly httpStatus = 401;
  readonly code = ERROR_CODES.UNAUTHORIZED;

  constructor(message = 'Authentication is required.') {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  readonly httpStatus = 403;
  readonly code = ERROR_CODES.FORBIDDEN;

  constructor(message = 'You do not have permission to do this.') {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly httpStatus = 404;
  readonly code = ERROR_CODES.NOT_FOUND;

  constructor(resource = 'Resource') {
    super(`${resource} not found.`);
  }
}

export class ConflictError extends AppError {
  readonly httpStatus = 409;
  readonly code: ErrorCode = ERROR_CODES.CONFLICT;
}

export class InvalidStateTransitionError extends ConflictError {
  override readonly code = ERROR_CODES.INVALID_STATE_TRANSITION;
}

/** Someone else saved the same record after it was loaded (optimistic concurrency). */
export class ConcurrencyError extends ConflictError {
  constructor() {
    super('This record was changed by someone else. Please reload and try again.');
  }
}

export class PayloadTooLargeError extends AppError {
  readonly httpStatus = 413;
  readonly code = ERROR_CODES.PAYLOAD_TOO_LARGE;

  constructor(message = 'The request is too large.') {
    super(message);
  }
}

export class RateLimitError extends AppError {
  readonly httpStatus = 429;
  readonly code = ERROR_CODES.RATE_LIMITED;

  constructor(
    public readonly retryAfterSeconds: number,
    message = 'Too many requests. Please try again later.',
  ) {
    super(message);
  }
}

/** The server is temporarily at capacity for this kind of request; the client should retry. */
export class ServiceBusyError extends AppError {
  readonly httpStatus = 503;
  readonly code = ERROR_CODES.SERVICE_BUSY;

  constructor(
    public readonly retryAfterSeconds: number,
    message = 'The server is busy. Please try again in a few seconds.',
  ) {
    super(message);
  }
}

export class ExternalServiceError extends AppError {
  readonly httpStatus = 502;
  readonly code = ERROR_CODES.EXTERNAL_SERVICE_ERROR;

  constructor(service: string, cause?: unknown) {
    super(`${service} is temporarily unavailable.`);
    this.cause = cause;
  }
}
