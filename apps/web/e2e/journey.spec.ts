import { expect, test } from '@playwright/test';
import { FIXTURE_PHOTO, PASSWORD, signUp, uniqueEmail } from './support';

/**
 * The core product journey, end to end in a real browser:
 * a finder reports an item → the owner finds and claims it → the finder approves →
 * they meet and confirm with the handover code → the item is marked returned.
 */
test('a found item gets back to its owner through a verified handover', async ({ browser }) => {
  const finder = await (await browser.newContext()).newPage();
  const owner = await (await browser.newContext()).newPage();
  const findersEmail = uniqueEmail('asha');
  const ownersEmail = uniqueEmail('ravi');

  await test.step('both students sign up with their university email', async () => {
    await signUp(finder, { email: findersEmail, first: 'Asha', last: 'Verma' });
    await signUp(owner, { email: ownersEmail, first: 'Ravi', last: 'Singh' });
  });

  let itemUrl = '';
  await test.step('the finder reports a found item with a photo and a question', async () => {
    await finder.getByRole('button', { name: 'Report item' }).click();
    const dialog = finder.getByRole('dialog', { name: 'Report an item' });
    await dialog.getByText('I found something').click();
    await dialog.locator('input[type=file]').setInputFiles(FIXTURE_PHOTO);
    await expect(dialog.getByRole('img', { name: 'Photo 1' })).toBeVisible();
    await dialog.getByLabel('Item name').fill('Bunch of keys');
    await dialog.getByLabel('Category').selectOption('KEYS');
    await dialog.getByLabel('Description').fill('Three keys on a red ring with a small torch.');
    await dialog.getByLabel('Where did you find it?').fill('Canteen');
    await dialog.getByRole('button', { name: 'Add a question' }).click();
    await dialog.getByLabel('Question 1', { exact: true }).fill('What is attached to the ring?');
    await dialog.getByRole('button', { name: 'Publish report' }).click();

    await expect(finder.getByRole('heading', { name: 'Bunch of keys' })).toBeVisible();
    itemUrl = finder.url();
    await expect(finder.getByText('No claims yet.')).toBeVisible();
  });

  await test.step('the owner searches, finds it and claims it by answering the question', async () => {
    await owner.getByLabel('Search items').fill('keys');
    await owner.getByRole('link', { name: /Bunch of keys/ }).click();
    await owner.getByRole('button', { name: 'This is mine' }).click();
    const dialog = owner.getByRole('dialog');
    await dialog.getByLabel('What is attached to the ring?').fill('A small torch');
    await dialog.getByRole('button', { name: 'Send' }).click();

    await expect(owner.getByText('What you sent')).toBeVisible();
    await expect(owner.getByText('Waiting for reply').first()).toBeVisible();
  });

  await test.step('the finder is notified and approves after checking the answer', async () => {
    // The background worker delivers the notification within a couple of seconds.
    await expect(async () => {
      await finder.reload();
      await expect(finder.getByRole('button', { name: 'Notifications, 1 unread' })).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });
    await finder.getByRole('button', { name: 'Notifications, 1 unread' }).click();
    await finder.getByRole('button', { name: /New claim on “Bunch of keys”/ }).click();

    await expect(finder.getByText('A small torch')).toBeVisible();
    await finder.getByRole('button', { name: 'Approve' }).click();
    await finder.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await expect(finder.getByText('Confirm the handover')).toBeVisible();
    await expect(finder.getByRole('link', { name: ownersEmail })).toBeVisible();
  });

  let code = '';
  await test.step('the owner sees the handover code', async () => {
    await owner.reload();
    await expect(owner.getByText('Your handover code')).toBeVisible();
    code = (await owner.getByLabel(/^Code \d( \d){5}$/).textContent())?.trim() ?? '';
    expect(code).toMatch(/^\d{6}$/);
  });

  await test.step('they meet; the finder enters the code and the item is returned', async () => {
    await finder.getByLabel("Owner's code").fill(code);
    await finder.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(finder.getByText('Handed over.')).toBeVisible();

    await owner.goto(itemUrl);
    await expect(owner.getByText('Returned', { exact: true })).toBeVisible();
    await expect(owner.getByText('This item has been returned to its owner.')).toBeVisible();
  });
});

test('signing in again restores the session, and signing out ends it @mobile', async ({ page }) => {
  const email = uniqueEmail('kabir');
  await signUp(page, { email, first: 'Kabir', last: 'Rao' });

  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Lost something? Found something?' }),
  ).toBeVisible();

  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  if (await menu.isVisible()) {
    await menu.click();
    await page
      .getByRole('navigation', { name: 'Mobile' })
      .getByRole('button', { name: 'Sign out' })
      .click();
  } else {
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
  }
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Lost something? Found something?' }),
  ).toBeVisible();
});
