import { expect, test, type Browser } from '@playwright/test';
import {
  FIXTURE_PHOTO,
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

test('a post names a campus place, or "Other" and types the place', async ({ page }) => {
  await signUp(page, { email: uniqueEmail('placer'), first: 'Pia', last: 'Lal' });
  await page.getByRole('button', { name: 'Report item' }).click();
  const dialog = page.getByRole('dialog', { name: 'Report an item' });
  await dialog.getByText('I lost something').click();

  // Nothing picked yet: "Other", and the text box asks for the place itself.
  await expect(dialog.getByRole('button', { name: 'Where did you lose it?' })).toContainText(
    'Other',
  );
  await expect(dialog.getByLabel('Which place?')).toBeVisible();
  await expect(dialog.getByText(/like a room in a block\? Pick that place/)).toBeVisible();

  await dialog.getByRole('button', { name: 'Where did you lose it?' }).click();
  for (const place of ['A-Block', 'B-Block', 'Pushpa Devi Dining Hall', "Learner's Arena"]) {
    await expect(page.getByRole('option', { name: place, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('option', { name: 'Security desk' })).toHaveCount(0);
  await page.getByRole('option', { name: 'A-Block', exact: true }).click();

  // A listed place: the text box is for the exact spot inside it.
  await expect(dialog.getByLabel('Which place?')).toHaveCount(0);
  await expect(dialog.getByText(/Pick that place/)).toHaveCount(0);
  await dialog.locator('input[type=file]').setInputFiles(FIXTURE_PHOTO);
  await expect(dialog.getByRole('img', { name: 'Photo 1' })).toBeVisible();
  await dialog.getByLabel('Item name').fill('Green notebook');
  await choose(page, 'Category', 'Books', dialog);
  await dialog.getByLabel('Description').fill('A green notebook with maths notes inside.');
  await dialog.getByLabel('Exact spot').fill('Classroom 408');
  await dialog.getByRole('button', { name: 'Publish report' }).click();

  await expect(page.getByRole('heading', { name: 'Green notebook' })).toBeVisible();
  await expect(page.getByText('A-Block · Classroom 408')).toBeVisible();
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
  await choose(page, 'Where did you lose it?', 'Gym', dialog);
  await dialog.getByLabel('Exact spot').fill('Near the lockers');
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

test('an item page asks for your claim on that item, so an older claim is never missed', async ({
  browser,
}) => {
  // The page used to look for the claim among your 20 most recent ones, which misses older
  // claims. It now asks the API about this item only (GET /claims/mine?itemId=…).
  const finder = await student(browser, 'gadget-finder', 'Ann', 'Poster');
  const claimant = await student(browser, 'gadget-claimant', 'Cal', 'Claimer');
  await reportFoundItem(finder.page, 'Gadget');
  const itemUrl = finder.page.url();
  const itemId = itemUrl.split('/').pop() ?? '';

  await claimant.page.goto(itemUrl);
  await claimant.page.getByRole('button', { name: 'This is mine' }).click();
  await claimant.page.getByRole('dialog').getByRole('button', { name: 'Send' }).click();
  await expect(claimant.page).toHaveURL(/\/claims\/[0-9a-f]{24}$/);

  const lookup = claimant.page.waitForRequest(
    (request) =>
      request.url().includes('/api/v1/claims/mine') && request.url().includes(`itemId=${itemId}`),
  );
  await claimant.page.goto(itemUrl);
  await lookup;
  await expect(claimant.page.getByText("You've already made a claim on this item")).toBeVisible();
  await expect(claimant.page.getByRole('button', { name: 'This is mine' })).toHaveCount(0);
});

test('the phone menu closes once one of its links is followed @mobile', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'The menu button is for phones');
  const email = uniqueEmail('desk-menu');
  await signUp(page, { email, first: 'Mona', last: 'Menu' });
  appoint(email, 'SECURITY_DESK');
  await page.reload();

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const menu = page.getByRole('navigation', { name: 'Mobile' });
  await menu.getByRole('link', { name: 'Desk' }).click();

  await expect(page).toHaveURL(/\/desk$/);
  await expect(menu).toHaveCount(0);
});

test('the landing story fades in and moves on to its next step by itself', async ({ page }) => {
  await page.goto('/');
  const story = page.locator('#how-it-works');
  await story.scrollIntoViewIfNeeded();

  const heading = story.getByRole('heading', { name: 'From “I lost it” to “I got it back”' });
  await expect(heading.locator('xpath=../..')).toHaveCSS('opacity', '1');
  const current = story.locator('ol button[aria-current="step"]');
  await expect(current).toContainText('Ravi searches for his wallet');
  await expect(current).toContainText('Asha found it, and posts it');
});

test('the logo on the landing page takes you back to the top @mobile', async ({ page }) => {
  await page.goto('/#safeguards');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

  await page.getByRole('banner').getByRole('link', { name: 'RU Lost & Found' }).click();

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page).toHaveURL(/\/$/);
});
