import { expect, test, type Browser, type Locator } from '@playwright/test';
import {
  appoint,
  bigPhoto,
  choose,
  expectItemPage,
  FIXTURE_PHOTO,
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

  await expectItemPage(page, 'Green notebook');
  await expect(page.getByText('A-Block · Classroom 408')).toBeVisible();
});

test('the browse page narrows posts by campus place and by when they were lost or found', async ({
  page,
}) => {
  await signUp(page, { email: uniqueEmail('browser'), first: 'Bina', last: 'Roy' });
  // A word only this run's post has, so posts from other tests never get in the way.
  const word = `umbrella${Date.now().toString(36)}`;
  await reportFoundItem(page, `Blue ${word}`);
  await page.goto('/');
  await page.getByLabel('Search items').fill(word);
  const post = page.getByRole('link', { name: new RegExp(word) });
  const nothing = page.getByText('No items found');
  await expect(post).toBeVisible();

  await choose(page, 'Place', 'Gym');
  await expect(nothing).toBeVisible();
  await choose(page, 'Place', 'Library');
  await expect(post).toBeVisible();
  await expect(page).toHaveURL(/place=Library/);

  // The post was found today (the report form's default).
  await choose(page, 'When', 'Today');
  await expect(post).toBeVisible();
  await choose(page, 'When', 'Choose dates…');
  await page.getByLabel('From', { exact: true }).fill('2026-01-01');
  await page.getByLabel('To', { exact: true }).fill('2026-01-31');
  await expect(nothing).toBeVisible();

  // A range that ends before it starts is pointed out, not silently empty.
  await page.getByLabel('From', { exact: true }).fill('2026-02-01');
  await expect(page.getByText('"To" must be on or after "From"')).toBeVisible();
});

test('phones and tablets show every control in full: notifications, filters, tabs and the staff header', async ({
  page,
}) => {
  const email = uniqueEmail('fitter');
  await signUp(page, { email, first: 'Kiran', last: 'Rao' });
  appoint(email, 'UNIVERSITY_ADMIN');
  await page.setViewportSize({ width: 360, height: 740 });
  await page.reload();
  const onScreen = async (locator: Locator, what: string) => {
    const box = await locator.boundingBox();
    expect(box, what).not.toBeNull();
    expect(box!.x, `${what} starts on screen`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `${what} ends on screen`).toBeLessThanOrEqual(360);
  };

  // The notifications panel opens whole, not cut off at the left of a small phone.
  await page.getByRole('button', { name: /^Notifications/ }).click();
  await onScreen(
    page.getByRole('region', { name: 'Notifications', exact: true }),
    'The notifications panel',
  );

  // The Browse "When" filter shows its whole label.
  await page.goto('/?when=custom');
  const when = page.getByRole('button', { name: /When/ });
  await expect(when).toContainText('Choose dates…');
  const cut = await when.evaluate((button) =>
    Array.from(button.querySelectorAll('*')).some((el) => el.scrollWidth > el.clientWidth + 1),
  );
  expect(cut, 'the When label is cut off').toBe(false);

  // Every desk tab and admin section is on screen: the bars wrap instead of scrolling out of view.
  // (The pages load on demand: wait for each bar before reading what is in it.)
  await page.goto('/desk');
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(3);
  for (const tab of await tabs.all()) {
    await onScreen(tab, `The desk tab "${await tab.innerText()}"`);
  }
  await page.goto('/admin');
  const sections = page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link');
  await expect(sections).toHaveCount(5);
  for (const section of await sections.all()) {
    await onScreen(section, `The admin section "${await section.innerText()}"`);
  }

  // An upright tablet: the staff header (with Desk and Admin) keeps every label on one line.
  await page.setViewportSize({ width: 768, height: 1024 });
  const tall = await page.locator('header').evaluate((header) =>
    Array.from(header.querySelectorAll('a, button'))
      .filter((el) => el.getBoundingClientRect().height > 44)
      .map((el) => el.textContent?.trim()),
  );
  expect(tall, 'header items wrapped onto two lines').toEqual([]);
  await expect(page.getByRole('button', { name: 'Report item' })).toBeVisible();
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

  await expectItemPage(page, 'Blue water bottle');
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

  await page.getByRole('button', { name: 'Remove post' }).click();
  await page
    .getByRole('dialog', { name: 'Remove this post?' })
    .getByRole('button', { name: 'Remove' })
    .click();

  await expect(page).toHaveURL(/\/my-items$/);
  await expect(page.getByText('Your post was removed.')).toBeVisible();
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

test('long words and addresses never make a phone page scroll sideways @mobile', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'A phone screen');
  await page.setViewportSize({ width: 320, height: 640 });
  const email = uniqueEmail('a.student.with.a.rather.long.name');
  await signUp(page, { email, first: 'Wide', last: 'Words' });
  const fits = () => page.evaluate(() => document.scrollingElement!.scrollWidth <= 320);

  // A pasted link or code has no spaces to wrap at.
  await reportFoundItem(page, 'W'.repeat(80));
  expect(await fits()).toBe(true);

  await page.goto('/profile');
  await expect(page.getByText(email)).toBeVisible();
  expect(await fits()).toBe(true);
});

test('the landing page fits a small phone, nothing cut off at the side @mobile', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'A phone screen');
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  const heading = page.getByRole('heading', { name: 'Lost something on campus? Found something?' });
  await expect(heading).toBeVisible();

  // The hero clips what sticks out, so the page itself never scrolls: measure the elements.
  for (const element of [
    heading,
    page.getByRole('link', { name: /Try the demo/ }).first(),
    page.getByRole('link', { name: 'See how it works' }),
  ]) {
    const box = await element.boundingBox();
    expect(box && box.x + box.width).toBeLessThanOrEqual(360);
  }
});
