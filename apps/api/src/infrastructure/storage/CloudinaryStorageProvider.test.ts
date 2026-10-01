import { Writable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalServiceError } from '../../core/errors/AppError';
import { CloudinaryStorageProvider } from './CloudinaryStorageProvider';

type UploadCallback = (error: unknown, result?: { secure_url: string; public_id: string }) => void;

const cloudinaryMock = vi.hoisted(() => ({
  uploadStream: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('cloudinary', () => ({
  v2: {
    uploader: {
      upload_stream: cloudinaryMock.uploadStream,
      destroy: cloudinaryMock.destroy,
    },
  },
}));

const config = { cloudName: 'demo', apiKey: 'key', apiSecret: 'secret' };
const image = { data: Buffer.from('webp-bytes'), contentType: 'image/webp' as const };

/** A fake upload stream that collects the bytes, then answers like Cloudinary would. */
function respondWith(error: unknown, result?: { secure_url: string; public_id: string }) {
  const received: Buffer[] = [];
  cloudinaryMock.uploadStream.mockImplementation(
    (_options: unknown, callback: UploadCallback) =>
      new Writable({
        write(chunk: Buffer, _encoding, done) {
          received.push(chunk);
          done();
        },
        final(done) {
          callback(error, result);
          done();
        },
      }),
  );
  return received;
}

describe('CloudinaryStorageProvider', () => {
  beforeEach(() => {
    cloudinaryMock.uploadStream.mockReset();
    cloudinaryMock.destroy.mockReset();
  });

  it('streams the image into the folder and returns an optimised delivery URL', async () => {
    const received = respondWith(null, {
      secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/ru-lost-found/items/abc.webp',
      public_id: 'ru-lost-found/items/abc',
    });

    const ref = await new CloudinaryStorageProvider(config).upload(image, 'items');

    expect(Buffer.concat(received).toString()).toBe('webp-bytes');
    expect(cloudinaryMock.uploadStream.mock.calls[0]?.[0]).toMatchObject({
      cloud_name: 'demo',
      api_key: 'key',
      api_secret: 'secret',
      folder: 'ru-lost-found/items',
      resource_type: 'image',
      overwrite: false,
    });
    expect(ref).toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_1600/v1/ru-lost-found/items/abc.webp',
      publicId: 'ru-lost-found/items/abc',
    });
  });

  it('reports upload failures as an external service error', async () => {
    respondWith(new Error('Invalid credentials'));

    await expect(
      new CloudinaryStorageProvider(config).upload(image, 'avatars'),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('deletes by public id and invalidates cached copies', async () => {
    cloudinaryMock.destroy.mockResolvedValue({ result: 'ok' });

    await new CloudinaryStorageProvider(config).delete('ru-lost-found/items/abc');

    expect(cloudinaryMock.destroy).toHaveBeenCalledWith(
      'ru-lost-found/items/abc',
      expect.objectContaining({ invalidate: true, cloud_name: 'demo' }),
    );
  });

  it('reports delete failures as an external service error', async () => {
    cloudinaryMock.destroy.mockRejectedValue(new Error('timeout'));

    await expect(new CloudinaryStorageProvider(config).delete('x')).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });
});
