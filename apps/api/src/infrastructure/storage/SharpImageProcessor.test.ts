import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../core/errors/AppError';
import { InMemoryStorageProvider } from '../../testing/InMemoryStorageProvider';
import { SanitizingStorageProvider } from './SanitizingStorageProvider';
import { SharpImageProcessor } from './SharpImageProcessor';

/** A 40×20 JPEG as a phone would save it: GPS/camera metadata and "rotate 90°" orientation. */
async function phonePhoto() {
  return sharp({ create: { width: 40, height: 20, channels: 3, background: '#336699' } })
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: { IFD0: { Make: 'PhoneMaker', Model: 'X1' }, IFD3: { GPSLatitudeRef: 'N' } },
    })
    .toBuffer();
}

describe('SharpImageProcessor', () => {
  const processor = new SharpImageProcessor();

  it('removes all metadata but keeps the photo the right way up', async () => {
    const original = await phonePhoto();
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const cleaned = await processor.sanitize({ data: original, contentType: 'image/jpeg' });
    const meta = await sharp(cleaned.data).metadata();

    expect(cleaned.contentType).toBe('image/webp');
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    // Orientation 6 means "rotate 90°": the stored image is now portrait.
    expect([meta.width, meta.height]).toEqual([20, 40]);
  });

  it('shrinks large photos, keeping their proportions', async () => {
    const large = await sharp({
      create: { width: 3000, height: 1500, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();

    const cleaned = await processor.sanitize({ data: large, contentType: 'image/png' });
    const meta = await sharp(cleaned.data).metadata();

    expect([meta.width, meta.height]).toEqual([2000, 1000]);
  });

  it('refuses files that only look like images', async () => {
    const jpegHeaderThenGarbage = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from('not really an image'),
    ]);

    await expect(
      processor.sanitize({ data: jpegHeaderThenGarbage, contentType: 'image/jpeg' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses images with too many pixels before decoding them (decompression bombs)', async () => {
    const strict = new SharpImageProcessor({ maxInputPixels: 100 });

    await expect(
      strict.sanitize({ data: await phonePhoto(), contentType: 'image/jpeg' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('SanitizingStorageProvider', () => {
  it('stores only the cleaned image and passes deletes through', async () => {
    const inner = new InMemoryStorageProvider();
    const storage = new SanitizingStorageProvider(inner, new SharpImageProcessor());

    const ref = await storage.upload(
      { data: await phonePhoto(), contentType: 'image/jpeg' },
      'items',
    );
    const stored = inner.stored.get(ref.publicId);

    expect(stored?.contentType).toBe('image/webp');
    expect((await sharp(stored!.data).metadata()).exif).toBeUndefined();

    await storage.delete(ref.publicId);
    expect(inner.deleted).toEqual([ref.publicId]);
  });
});
