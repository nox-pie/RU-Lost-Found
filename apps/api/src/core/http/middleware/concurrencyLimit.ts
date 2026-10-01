import type { RequestHandler } from 'express';
import { ServiceBusyError } from '../../errors/AppError';

/**
 * Caps how many requests of one kind are in progress at once in this process. Uploads buffer
 * photos in memory (up to 3 × 5 MB each); without a cap, a burst of parallel uploads could
 * exhaust a small server's memory. Excess requests get 503 with Retry-After instead.
 */
export function limitConcurrency(max: number): RequestHandler {
  let active = 0;
  return (_req, res, next) => {
    if (active >= max) throw new ServiceBusyError(5);
    active += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active -= 1;
    };
    res.once('finish', release);
    res.once('close', release);
    next();
  };
}
