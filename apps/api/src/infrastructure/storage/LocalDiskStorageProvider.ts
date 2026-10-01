import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImageRef } from '../../core/domain/ImageRef';
import {
  EXTENSIONS,
  type ImageFolder,
  type ImageUpload,
  type StorageProvider,
} from '../../core/storage/StorageProvider';

/**
 * Development stand-in for Cloudinary: saves files under `directory` and returns URLs that the
 * API serves itself at `publicPath`. Not for production: hosting platforms wipe the disk on deploy.
 */
export class LocalDiskStorageProvider implements StorageProvider {
  constructor(
    private readonly directory: string,
    private readonly publicPath: string,
  ) {}

  async upload(image: ImageUpload, folder: ImageFolder): Promise<ImageRef> {
    const publicId = `${folder}/${randomUUID()}.${EXTENSIONS[image.contentType]}`;
    const target = this.resolve(publicId);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, image.data);
    return { url: `${this.publicPath}/${publicId}`, publicId };
  }

  async delete(publicId: string): Promise<void> {
    await rm(this.resolve(publicId), { force: true });
  }

  /** Resolves inside `directory` only, so a crafted id can't point elsewhere on disk. */
  private resolve(publicId: string): string {
    const root = path.resolve(this.directory);
    const target = path.resolve(root, publicId);
    if (!target.startsWith(root + path.sep)) {
      throw new Error(`Invalid image id: ${publicId}`);
    }
    return target;
  }
}
