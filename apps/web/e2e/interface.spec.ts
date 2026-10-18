import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  FIXTURE_PHOTO,
  PASSWORD,
  appoint,
  bigPhoto,
  choose,
  reportFoundItem,
  signUp,
  uniqueEmail,
} from './support';

/**
 * Interface details that only show up with real typing, timing and loading: a dialog keeping
 * the keyboard focus, forms that don't block on hidden fields, lists that don't throw away an
 * open dialog, and pages that don't flash an error on the way out.
 */

async function student(browser: Browser, name: string, first: string, last: string) {
  const page = await (await browser.newContext()).newPage();
  const email = uniqueEmail(name);
  await signUp(page, { email, first, last });
  return { page, email };
}

test('a decline reason can be typed in full: the dialog keeps the keyboard focus', async ({
  browser,
}) => {
  const finder = await student(browser, 'finder', 'Rina', 'Rao');
  const owner = await student(browser, 'owner', 'Cyrus', 'Das');
  await reportFoundItem(finder.page, 'Silver watch');
  await owner.page.goto(finder.page.url());
  await owner.page.getByRole('button', { name: 'This is mine' }).click();
  await owner.page.getByRole('dialog').getByRole('button', { name: 'Send' }).click();
  await expect(owner.page).toHaveURL(/\/claims\/[0-9a-f]{24}$/);

  await finder.page.goto(owner.page.url());
  await finder.page.getByRole('button', { name: 'Decline' }).click();
  const reason = finder.page.getByRole('dialog').getByLabel('Reason (optional, shown to them)');
  await reason.click();
  // Typed key by key, like a person: every keystroke re-renders the page behind the dialog.
  await reason.pressSequentially('The wallpaper does not match', { delay: 20 });

  await expect(reason).toHaveValue('The wallpaper does not match');
  await expect(reason).toBeFocused();
});

test('a post switched from "found" to "lost" is not held back by a hidden question', async ({
  page,
}) => {
  await signUp(page, { email: uniqueEmail('switcher'), first: 'Fay', last: 'Orm' });
  await page.getByRole('button', { name: 'Report item' }).click();
  const dialog = page.getByRole('dialog', { name: 'Report an item' });
  await dialog.getByText('I found something').click();
  await dialog.getByRole('button', { name: 'Add a question' }).click(); // then changes their mind
  await dialog.getByText('I lost something').click();

  await dialog.locator('input[type=file]').setInputFiles(FIXTURE_PHOTO);
  await expect(dialog.getByRole('img', { name: 'Photo 1' })).toBeVisible();
  await dialog.getByLabel('Item name').fill('Blue water bottle');
  await choose(page, 'Category', 'Bottle', dialog);
  await dialog.getByLabel('Description').fill('Steel bottle with a dent and a sticker.');
  await dialog.getByLabel('Where did you lose it?').fill('Gym');
  await dialog.getByRole('button', { name: 'Publish report' }).click();

  await expect(page.getByRole('heading', { name: 'Blue water bottle' })).toBeVisible();
});

test('an admin can act on a person straight after searching for them', async ({ browser }) => {
  const admin = await student(browser, 'people-admin', 'Ada', 'Admin');
  await student(browser, 'searched', 'Yan', 'Yolo');
  appoint(admin.email, 'UNIVERSITY_ADMIN');
  await admin.page.goto('/admin/users');
  const row = admin.page.getByRole('listitem').filter({ hasText: 'Yan Yolo' });
  await expect(row).toBeVisible();

  await admin.page.getByLabel('Search').fill('Yan');
  await row.getByRole('button', { name: 'Suspend' }).click(); // before the search has answered
  const dialog = admin.page.getByRole('dialog', { name: 'Suspend Yan Yolo?' });
  await expect(dialog).toBeVisible();
  await admin.page.waitForTimeout(1_000); // the search answers meanwhile
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Reason').fill('Checking the dialog stays open');
  await dialog.getByRole('button', { name: 'Suspend' }).click();
  await expect(admin.page.getByText('Yan Yolo was suspended and signed out.')).toBeVisible();
});

test('any phone photo can become a profile picture: it is made smaller first', async ({ page }) => {
  const photo = await bigPhoto();
  await signUp(page, { email: uniqueEmail('portrait'), first: 'Ava', last: 'Tar' });
  await page.goto('/profile');

  await page
    .locator('input[type=file][accept="image/jpeg,image/png,image/webp"]')
    .setInputFiles({ name: 'IMG_0007.jpg', mimeType: 'image/jpeg', buffer: photo });

  await expect(page.getByText('Profile picture updated.')).toBeVisible();
});

test('removing your own post goes straight to "My items", without a "not found" flash', async ({
  page,
}) => {
  await signUp(page, { email: uniqueEmail('remover'), first: 'Rem', last: 'Over' });
  await reportFoundItem(page, 'Leather notebook');
  await page.evaluate(() => {
    const seen = window as unknown as { sawNotFound: boolean };
    seen.sawNotFound = false;
    new MutationObserver(() => {
      if (document.body.innerText.includes('Item not found.')) seen.sawNotFound = true;
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });

  await page.getByRole('button', { name: 'Remove report' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();

  await expect(page).toHaveURL(/\/my-items$/);
  await expect(page.getByText('Your report was removed.')).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { sawNotFound: boolean }).sawNotFound),
  ).toBe(false);
});

async function tokenFor(request: APIRequestContext, email: string) {
  const res = await request.post('/api/v1/auth/login', { data: { email, password: PASSWORD } });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { accessToken: string }).accessToken;
}

test('an item page knows you already claimed it, however many claims you have', async ({
  browser,
}) => {
  test.slow(); // 21 posts and claims
  const first = await student(browser, 'poster-a', 'Ann', 'Poster');
  const second = await student(browser, 'poster-b', 'Ben', 'Poster');
  const claimant = await student(browser, 'busy-claimant', 'Cal', 'Claimer');
  const request = claimant.page.request;
  const posters = [await tokenFor(request, first.email), await tokenFor(request, second.email)];
  const claimantToken = await tokenFor(request, claimant.email);
  const photo = readFileSync(FIXTURE_PHOTO);

  // 21 found items (each poster stays under the daily posting limit), all claimed by Cal;
  // the first claim is the oldest, so it is not among his 20 most recent.
  const items: string[] = [];
  for (let i = 1; i <= 21; i += 1) {
    const res = await request.post('/api/v1/items', {
      headers: { Authorization: `Bearer ${posters[i % 2]}` },
      multipart: {
        type: 'FOUND',
        category: 'ELECTRONICS',
        title: `Gadget ${i}`,
        description: 'Found near the library entrance.',
        location: 'Library',
        occurredOn: new Date().toISOString().slice(0, 10),
        photos: { name: 'keys.png', mimeType: 'image/png', buffer: photo },
      },
    });
    expect(res.status()).toBe(201);
    items.push(((await res.json()) as { id: string }).id);
  }
  for (const id of items) {
    const res = await request.post(`/api/v1/items/${id}/claims`, {
      headers: { Authorization: `Bearer ${claimantToken}` },
      data: {},
    });
    expect(res.status()).toBe(201);
  }

  await claimant.page.goto(`/items/${items[0]}`);
  await expect(claimant.page.getByRole('heading', { name: 'Gadget 1' })).toBeVisible();
  await expect(claimant.page.getByText("You've already made a claim on this item")).toBeVisible();
  await expect(claimant.page.getByRole('button', { name: 'This is mine' })).toHaveCount(0);
});
