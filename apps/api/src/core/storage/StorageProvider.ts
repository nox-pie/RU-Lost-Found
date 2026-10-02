import type { ImageRef } from '../domain/ImageRef';

export type ImageFolder = 'items' | 'avatars';

export type ImageContentType = 'image/jpeg' | 'image/png' | 'image/webp';

/** An image received from a client, already checked to really be a JPEG, PNG or WebP. */
export interface ImageUpload {
  data: Buffer;
  contentType: ImageContentType;
}

export interface StorageProvider {
  /** Stores the image and returns its public URL and the id needed to delete it. */
  upload(image: ImageUpload, folder: ImageFolder): Promise<ImageRef>;
  /** Deletes a stored image. Deleting something that no longer exists is not an error. */
  delete(publicId: string): Promise<void>;
}

/**
 * Identifies an image by its first bytes ("magic numbers") instead of trusting the
 * Content-Type sent by the client, which anyone can fake.
 */
export function detectImageType(data: Buffer): ImageContentType | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    data.length >= 12 &&
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export const EXTENSIONS: Record<ImageContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
