import type { ImageRef } from '../../core/domain/ImageRef';
import type { ImageFolder, ImageUpload, StorageProvider } from '../../core/storage/StorageProvider';

export interface ImageSanitizer {
  sanitize(image: ImageUpload): Promise<ImageUpload>;
}

/**
 * Decorator: adds image sanitising to any StorageProvider (Cloudinary, local disk, …) without
 * changing it or the services that use it. Every upload is cleaned before it is stored.
 */
export class SanitizingStorageProvider implements StorageProvider {
  constructor(
    private readonly inner: StorageProvider,
    private readonly sanitizer: ImageSanitizer,
  ) {}

  async upload(image: ImageUpload, folder: ImageFolder): Promise<ImageRef> {
    return this.inner.upload(await this.sanitizer.sanitize(image), folder);
  }

  delete(publicId: string): Promise<void> {
    return this.inner.delete(publicId);
  }
}
