import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { signUp, uniqueEmail } from './support';

/** A 12-megapixel camera-style photo of random noise: well over the 5 MB upload limit. */
async function bigPhoto(): Promise<Buffer> {
  const width = 4000;
  const height = 3000;
  const noise = Buffer.alloc(width * height * 3);
  for (let i = 0; i < noise.length; i += 1) noise[i] = Math.floor(Math.random() * 256);
  return sharp(noise, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 100 })
    .toBuffer();
}

test('a large phone photo is made smaller on the device and accepted', async ({ page }) => {
  const photo = await bigPhoto();
  expect(photo.length).toBeGreaterThan(5 * 1024 * 1024);
  await signUp(page, { email: uniqueEmail('photographer'), first: 'Meera', last: 'Iyer' });

  await page.getByRole('button', { name: 'Report item' }).click();
  const dialog = page.getByRole('dialog', { name: 'Report an item' });
  await dialog.getByText('I found something').click();
  const upload = page.waitForRequest(
    (request) => request.url().endsWith('/api/v1/items') && request.method() === 'POST',
  );
  await dialog
    .locator('input[type=file]')
    .setInputFiles({ name: 'IMG_0042.jpg', mimeType: 'image/jpeg', buffer: photo });
  await expect(dialog.getByRole('img', { name: 'Photo 1' })).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);

  await dialog.getByLabel('Item name').fill('Grey umbrella');
  await dialog.getByLabel('Category').selectOption('OTHER');
  await dialog.getByLabel('Description').fill('A grey folding umbrella left by the stairs.');
  await dialog.getByLabel('Where did you find it?').fill('Main stairs');
  await dialog.getByRole('button', { name: 'Publish report' }).click();

  const sent = (await upload).postDataBuffer()?.length ?? 0;
  expect(sent).toBeLessThan(photo.length / 3);
  await expect(page.getByRole('heading', { name: 'Grey umbrella' })).toBeVisible();
});

test('phones can take the photo with the camera @mobile', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'touch screens only');
  await signUp(page, { email: uniqueEmail('camera'), first: 'Dev', last: 'Malhotra' });

  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: 'Report an item' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Report an item' });

  await expect(dialog.getByRole('button', { name: 'Take photo' })).toBeVisible();
  await expect(dialog.locator('input[capture="environment"]')).toHaveCount(1);
});
