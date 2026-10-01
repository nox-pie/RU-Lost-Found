/**
 * Stable, machine-readable error codes returned by the API.
 * Clients branch on `code`; `message` is for humans and may change.
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  HANDOVER_CODE_INCORRECT: 'HANDOVER_CODE_INCORRECT',
  HANDOVER_LOCKED: 'HANDOVER_LOCKED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  SERVICE_BUSY: 'SERVICE_BUSY',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** One problem with one field of the request, e.g. `{ path: 'body.email', message: 'Invalid email' }`. */
export interface ErrorDetail {
  path: string;
  message: string;
}

/** Shape of every error response body. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    requestId?: string;
  };
}
