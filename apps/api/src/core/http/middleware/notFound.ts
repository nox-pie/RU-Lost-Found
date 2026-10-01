import type { RequestHandler } from 'express';
import { NotFoundError } from '../../errors/AppError';

/** Catch-all for unknown routes, so they return the standard JSON error instead of Express's HTML page. */
export const notFound: RequestHandler = (req) => {
  throw new NotFoundError(`Route ${req.method} ${req.path}`);
};
