import sharp from 'sharp';
import { ValidationError } from '../../core/errors/AppError';
import type { ImageUpload } from '../../core/storage/StorageProvider';

export interface ImageProcessorOptions {
  /** Longest side after resizing, in pixels. */
  maxDimension: number;
  /** WebP quality, 1–100. */
  quality: number;
  /** Images with more pixels than this are refused before decoding (decompression bombs). */
  maxInputPixels: number;
}

const DEFAULTS: ImageProcessorOptions = {
  maxDimension: 2000,
  quality: 82,
  maxInputPixels: 40_000_000,
};

/**
 * Re-encodes every uploaded image before it is stored:
 * - removes all metadata (EXIF, GPS location, camera serial numbers): sharp drops it by default;
 * - applies the EXIF orientation first, so photos still appear the right way up;
 * - shrinks to at most `maxDimension` px and converts to WebP (much smaller than phone JPEGs);
 * - proves the file really decodes as an image, which is stronger than checking its first bytes.
 */
export class SharpImageProcessor {
  private readonly options: ImageProcessorOptions;

  constructor(options: Partial<ImageProcessorOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  async sanitize(image: ImageUpload): Promise<ImageUpload> {
    const { maxDimension, quality, maxInputPixels } = this.options;
    try {
      const data = await sharp(image.data, { limitInputPixels: maxInputPixels, failOn: 'error' })
        .rotate()
        .resize({
          width: maxDimension,
          height: maxDimension,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toBuffer();
      return { data, contentType: 'image/webp' };
    } catch {
      throw new ValidationError(
        'The photo could not be read. Please upload a JPEG, PNG or WebP image under 40 megapixels.',
      );
    }
  }
}
