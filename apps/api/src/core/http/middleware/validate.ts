import type { RequestHandler } from 'express';
import type { ErrorDetail } from '@ru-lost-found/shared';
import type { ZodTypeAny } from 'zod';
import { ValidationError } from '../../errors/AppError';

export interface RequestSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

const PARTS = ['params', 'query', 'body'] as const;

/**
 * Validates and normalises the request against Zod schemas before it reaches the controller.
 * On success the parsed values (with defaults and type coercion applied) replace the raw ones,
 * so controllers only ever see valid data. On failure every problem is reported at once.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    const details: ErrorDetail[] = [];

    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        for (const issue of result.error.issues) {
          details.push({ path: [part, ...issue.path].join('.'), message: issue.message });
        }
        continue;
      }

      if (part === 'query') {
        // Express 5 exposes `req.query` as a getter, so shadow it with an own property.
        Object.defineProperty(req, 'query', {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else {
        req[part] = result.data;
      }
    }

    if (details.length > 0) {
      throw new ValidationError('The request is invalid.', details);
    }
    next();
  };
}
