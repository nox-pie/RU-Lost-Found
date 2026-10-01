import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import type { ImageRef } from '../../core/domain/ImageRef';
import { ExternalServiceError } from '../../core/errors/AppError';
import type { ImageFolder, ImageUpload, StorageProvider } from '../../core/storage/StorageProvider';

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** Top-level folder in the Cloudinary media library. */
  rootFolder?: string;
}

/**
 * Delivery transformation added to every URL: the best format the browser supports (WebP/AVIF),
 * automatic compression, and never wider than 1600px. Phone photos of 4–5 MB are served at a
 * fraction of the size without storing extra copies.
 */
const DELIVERY_TRANSFORMATION = 'f_auto,q_auto,c_limit,w_1600';

export function withDeliveryTransformation(secureUrl: string): string {
  return secureUrl.replace('/image/upload/', `/image/upload/${DELIVERY_TRANSFORMATION}/`);
}

/** Adapter for Cloudinary. Credentials are passed per call, so no global SDK state is shared. */
export class CloudinaryStorageProvider implements StorageProvider {
  private readonly auth: { cloud_name: string; api_key: string; api_secret: string };
  private readonly rootFolder: string;

  constructor(config: CloudinaryConfig) {
    this.auth = {
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
    };
    this.rootFolder = config.rootFolder ?? 'ru-lost-found';
  }

  async upload(image: ImageUpload, folder: ImageFolder): Promise<ImageRef> {
    let result: UploadApiResponse;
    try {
      result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            ...this.auth,
            folder: `${this.rootFolder}/${folder}`,
            resource_type: 'image',
            unique_filename: true,
            overwrite: false,
          },
          (error, response) => {
            if (error || !response) reject(error ?? new Error('Empty Cloudinary response'));
            else resolve(response);
          },
        );
        stream.end(image.data);
      });
    } catch (error) {
      throw new ExternalServiceError('Image storage', error);
    }
    return { url: withDeliveryTransformation(result.secure_url), publicId: result.public_id };
  }

  async delete(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { ...this.auth, invalidate: true });
    } catch (error) {
      throw new ExternalServiceError('Image storage', error);
    }
  }
}
