import { expect, test } from '@playwright/test';
import { FIXTURE_PHOTO, choose, signUp, uniqueEmail } from './support';

/**
 * Smart matching: a found post that looks like a lost one is suggested to the owner, on their
 * post's page and as a notification.
 */
test('the owner of a lost post is told about a found post that looks like it', async ({
  browser,
}) => {
  const owner = await (await browser.newContext()).newPage();
  const finder = await (await browser.newContext()).newPage();
  await signUp(owner, { email: uniqueEmail('mowner'), first: 'Ravi', last: 'Singh' });
  await signUp(finder, { email: uniqueEmail('mfinder'), first: 'Asha', last: 'Verma' });
  const tag = Date.now().toString(36);

  const post = async (
    page: typeof owner,
    kind: 'I lost something' | 'I found something',
    title: string,
    description: string,
  ) => {
    await page.getByRole('button', { name: 'Report item' }).click();
    const dialog = page.getByRole('dialog', { name: 'Report an item' });
    await dialog.getByText(kind).click();
    await dialog.locator('input[type=file]').setInputFiles(FIXTURE_PHOTO);
    await expect(dialog.getByRole('img', { name: 'Photo 1' })).toBeVisible();
    await dialog.getByLabel('Item name').fill(title);
    await choose(page, 'Category', 'Keys', dialog);
    await dialog.getByLabel('Description').fill(description);
    const where = kind === 'I lost something' ? 'Where did you lose it?' : 'Where did you find it?';
    await choose(page, where, 'CCD', dialog);
    await dialog.getByLabel('Exact spot').fill('Near the counter');
    await dialog.getByRole('button', { name: 'Publish report' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  };

  await post(owner, 'I lost something', `Hostel keys ${tag}`, `Three keys on a red ring ${tag}.`);
  await expect(owner.getByText('No found post looks like yours yet.')).toBeVisible();

  await post(finder, 'I found something', `Key ring ${tag}`, `A red ring with three keys ${tag}.`);

  await test.step('the owner is notified and sees the find among the possible matches', async () => {
    await expect(async () => {
      await owner.reload();
      await expect(owner.getByRole('button', { name: 'Notifications, 1 unread' })).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });
    const matches = owner.getByRole('region', { name: 'Possible matches' });
    await expect(matches.getByRole('link', { name: new RegExp(`Key ring ${tag}`) })).toContainText(
      'Strong match',
    );
  });
});
