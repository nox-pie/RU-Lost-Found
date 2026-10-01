import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { detectImageType } from '../../core/storage/StorageProvider';
import { fakeJpeg, fakePng } from '../../testing/signedIn';
import { withDeliveryTransformation } from './CloudinaryStorageProvider';
import { LocalDiskStorageProvider } from './LocalDiskStorageProvider';

describe('detectImageType', () => {
  it('recognises images by their bytes, not their name', () => {
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);

    expect(detectImageType(fakeJpeg())).toBe('image/jpeg');
    expect(detectImageType(fakePng())).toBe('image/png');
    expect(detectImageType(webp)).toBe('image/webp');
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageType(Buffer.from('<svg onload="alert(1)"/>'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe('withDeliveryTransformation', () => {
  it('asks Cloudinary for an optimised, size-limited version', () => {
    expect(
      withDeliveryTransformation(
        'https://res.cloudinary.com/demo/image/upload/v1712/ru-lost-found/items/abc.jpg',
      ),
    ).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_1600/v1712/ru-lost-found/items/abc.jpg',
    );
  });
});

describe('LocalDiskStorageProvider', () => {
  let directory: string | undefined;
  afterAll(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('saves, serves under the public path and deletes images', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'rlf-uploads-'));
    const storage = new LocalDiskStorageProvider(directory, '/api/v1/uploads');
    const data = fakePng();

    const ref = await storage.upload({ data, contentType: 'image/png' }, 'items');

    expect(ref.url).toBe(`/api/v1/uploads/${ref.publicId}`);
    expect(ref.publicId).toMatch(/^items\/[0-9a-f-]{36}\.png$/);
    expect(await readFile(path.join(directory, ref.publicId))).toEqual(data);

    await storage.delete(ref.publicId);
    await expect(stat(path.join(directory, ref.publicId))).rejects.toThrow();
    await expect(storage.delete(ref.publicId)).resolves.toBeUndefined();
  });

  it('refuses ids that point outside its directory', async () => {
    const storage = new LocalDiskStorageProvider(tmpdir(), '/uploads');

    await expect(storage.delete('../../etc/passwd')).rejects.toThrow(/Invalid image id/);
  });
});
