import type { Request, RequestHandler } from 'express';
import multer from 'multer';
import { PayloadTooLargeError, ValidationError } from '../../errors/AppError';
import { detectImageType, type ImageUpload } from '../../storage/StorageProvider';

declare module 'express-serve-static-core' {
  interface Request {
    /** Images from a multipart request, set by `imageUpload`. Verified to be JPEG, PNG or WebP. */
    images?: ImageUpload[];
  }
}

export interface ImageUploadOptions {
  /** Form field that carries the file(s). */
  field: string;
  maxFiles: number;
  maxBytesPerFile: number;
}

const MEGABYTE = 1024 * 1024;

/**
 * Parses a multipart/form-data request, keeping images in memory (never on the server's disk)
 * within strict limits, and checks each file's real type from its bytes.
 * Text fields of the form end up in `req.body` for the `validate` middleware that follows.
 */
export function imageUpload(options: ImageUploadOptions): RequestHandler {
  const parse = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: options.maxBytesPerFile,
      files: options.maxFiles,
      fields: 20,
      fieldSize: 8 * 1024,
      parts: options.maxFiles + 20,
    },
  }).array(options.field, options.maxFiles);

  const sizeLabel = `${Math.round(options.maxBytesPerFile / MEGABYTE)} MB`;

  return (req, res, next) => {
    parse(req, res, (error: unknown) => {
      if (error) {
        next(translate(error, options, sizeLabel));
        return;
      }
      try {
        req.images = toImages(req);
        next();
      } catch (validationError) {
        next(validationError);
      }
    });
  };
}

function toImages(req: Request): ImageUpload[] {
  const files = Array.isArray(req.files) ? req.files : [];
  return files.map((file) => {
    const contentType = detectImageType(file.buffer);
    if (!contentType) {
      throw new ValidationError(`"${file.originalname}" is not a JPEG, PNG or WebP image.`);
    }
    return { data: file.buffer, contentType };
  });
}

function translate(error: unknown, options: ImageUploadOptions, sizeLabel: string): unknown {
  if (!(error instanceof multer.MulterError)) return error;
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return new PayloadTooLargeError(`Each photo must be ${sizeLabel} or smaller.`);
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
      return new ValidationError(
        `Upload at most ${options.maxFiles} photo(s) in the "${options.field}" field.`,
      );
    default:
      return new ValidationError('The upload could not be processed.');
  }
}
