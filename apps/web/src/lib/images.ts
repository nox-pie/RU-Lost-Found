/**
 * Prepares a photo for upload in the browser: phone cameras take 4–12 MB pictures, far more
 * than a post needs. Shrinking here makes uploads fast on mobile data, lets large photos through
 * the 5 MB limit, and drops the location data before it leaves the phone (the API strips
 * metadata and resizes again anyway; this is not a security boundary).
 */

/** The API stores photos at up to 2000 px on the longest side, so more is wasted. */
const MAX_DIMENSION = 2000;
/** Below this, a photo in an accepted format is sent untouched (no quality lost). */
const SMALL_ENOUGH_BYTES = 1024 * 1024;
const JPEG_QUALITY = 0.85;

export const UPLOADABLE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * A JPEG at most 2000 px on its longest side, or the original file if it is already small and
 * in an accepted format. Anything the browser can decode (e.g. HEIC in Safari) becomes a JPEG.
 * Returns null if the file can't be read as an image.
 */
export async function prepareImage(file: File): Promise<File | null> {
  let bitmap: ImageBitmap;
  try {
    // 'from-image' applies the camera's rotation, so portrait photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // The browser can't decode it; an accepted format can still go to the API as it is.
    return UPLOADABLE_TYPES.includes(file.type) ? file : null;
  }

  try {
    const { width, height } = bitmap;
    const fits = Math.max(width, height) <= MAX_DIMENSION;
    if (fits && file.size <= SMALL_ENOUGH_BYTES && UPLOADABLE_TYPES.includes(file.type)) {
      return file;
    }
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) return UPLOADABLE_TYPES.includes(file.type) ? file : null;
    context.fillStyle = '#ffffff'; // JPEG has no transparency
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob) return UPLOADABLE_TYPES.includes(file.type) ? file : null;
    // Keep the original if re-encoding didn't help (e.g. an already well-compressed photo).
    if (fits && UPLOADABLE_TYPES.includes(file.type) && blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
