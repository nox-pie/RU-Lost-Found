import type { ImageRef } from '../core/domain/ImageRef';
import { ExternalServiceError } from '../core/errors/AppError';
import type { ImageFolder, ImageUpload, StorageProvider } from '../core/storage/StorageProvider';

/** Test double: keeps uploads in a map and can be told to fail, to exercise error paths. */
export class InMemoryStorageProvider implements StorageProvider {
  readonly stored = new Map<string, ImageUpload>();
  readonly deleted: string[] = [];
  /** Fail the upload with this (1-based) number, counting from the last reset. */
  failOnUpload: number | null = null;
  private uploads = 0;

  async upload(image: ImageUpload, folder: ImageFolder): Promise<ImageRef> {
    this.uploads += 1;
    if (this.failOnUpload === this.uploads) {
      throw new ExternalServiceError('Image storage', new Error('simulated failure'));
    }
    const publicId = `${folder}/test-${this.uploads}`;
    this.stored.set(publicId, image);
    return { url: `https://images.test/${publicId}`, publicId };
  }

  async delete(publicId: string): Promise<void> {
    this.stored.delete(publicId);
    this.deleted.push(publicId);
  }

  reset(): void {
    this.stored.clear();
    this.deleted.length = 0;
    this.failOnUpload = null;
    this.uploads = 0;
  }
}
