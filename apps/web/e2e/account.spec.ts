import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PASSWORD, appoint, reportFoundItem, signUp, uniqueEmail } from './support';

/**
 * What people do with their own account and posts, and the security desk's console:
 * change a password, download their data, delete the account, edit a post, and hand an item
 * back at the desk.
 */

const NEW_PASSWORD = 'Brand-new-pass-7';

test('a person changes their password, downloads their data and deletes their account', async ({
  page,
}) => {
  const email = uniqueEmail('meera');
  await signUp(page, { email, first: 'Meera', last: 'Iyer' });
  await page.goto('/profile');

  await test.step('changing the password keeps this device signed in', async () => {
    await page.getByLabel('Current password').fill(PASSWORD);
    await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel('Repeat the new password').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(page.getByText('Password changed.')).toBeVisible();
    await page.reload(); // the new session survives a reload
    await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
  });

  await test.step('"Download my data" saves everything as one JSON file', async () => {
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download my data' }).click();
    const download = await downloading;

    expect(download.suggestedFilename()).toMatch(/^lost-and-found-data-\d{4}-\d{2}-\d{2}\.json$/);
    const data = JSON.parse(readFileSync(await download.path(), 'utf8')) as {
      account: { email: string };
      posts: unknown[];
    };
    expect(data.account.email).toBe(email);
    expect(data.posts).toEqual([]);
  });

  await test.step('deleting the account asks for the password, then signs out for good', async () => {
    await page.getByRole('button', { name: 'Delete my account' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete your account?' });
    await dialog.getByLabel('Your password').fill(PASSWORD); // the old one
    await dialog.getByRole('button', { name: 'Delete my account' }).click();
    await expect(dialog.getByText('Your password is incorrect')).toBeVisible();

    await dialog.getByLabel('Your password').fill(NEW_PASSWORD);
    await dialog.getByRole('button', { name: 'Delete my account' }).click();
    await expect(
      page.getByRole('heading', { name: 'Lost something on campus? Found something?' }),
    ).toBeVisible();

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Incorrect email or password.')).toBeVisible();
  });
});

test('a finder edits their post, and the security desk decides and hands the item back', async ({
  browser,
}) => {
  const finder = await (await browser.newContext()).newPage();
  const owner = await (await browser.newContext()).newPage();
  const desk = await (await browser.newContext()).newPage();
  const deskEmail = uniqueEmail('desk');
  await signUp(finder, { email: uniqueEmail('asha'), first: 'Asha', last: 'Verma' });
  await signUp(owner, { email: uniqueEmail('ravi'), first: 'Ravi', last: 'Singh' });
  await signUp(desk, { email: deskEmail, first: 'Desk', last: 'Staff' });
  appoint(deskEmail, 'SECURITY_DESK');

  const title = `Grey hoodie ${Date.now().toString(36)}`;
  let itemUrl = '';
  await test.step('the finder corrects the post and hands the hoodie in at the desk', async () => {
    await reportFoundItem(finder, 'Grey jumper');
    itemUrl = finder.url();
    await finder.getByRole('button', { name: 'Edit post' }).click();
    const dialog = finder.getByRole('dialog', { name: 'Edit your post' });
    await dialog.getByLabel('Item name').fill(title);
    await dialog.getByText("I've handed it in at the security desk").click();
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(finder.getByText('Your post was updated.')).toBeVisible();
    await expect(finder.getByRole('heading', { name: title })).toBeVisible();
    await expect(finder.getByText('Handed in at the security desk')).toBeVisible();
  });

  await test.step('the desk sees it among the items it holds', async () => {
    await desk.reload(); // picks up the new role
    await desk
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Desk' })
      .click();
    await desk.getByRole('tab', { name: 'Items at the desk' }).click();
    await desk.getByLabel('Search').fill(title);
    await expect(desk.getByRole('link', { name: new RegExp(title) })).toContainText(
      'Waiting for owner',
    );
  });

  let claimUrl = '';
  await test.step('the owner claims it, and the desk (not the finder) approves', async () => {
    await owner.goto(itemUrl);
    await owner.getByRole('button', { name: 'This is mine' }).click();
    await owner.getByRole('dialog').getByRole('button', { name: 'Send' }).click();
    await expect(owner.getByText('Waiting for reply').first()).toBeVisible();
    claimUrl = owner.url();

    await desk.getByRole('tab', { name: 'Claims to decide' }).click();
    await desk.getByRole('link', { name: new RegExp(title) }).click();
    await desk.getByRole('button', { name: 'Approve' }).click();
    await desk.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await expect(desk.getByRole('button', { name: 'Confirm handover' })).toBeVisible();
  });

  await test.step('the owner is told to collect it at the desk, with no contacts shared', async () => {
    await owner.goto(claimUrl);
    await expect(owner.getByText(/Collect it at the\s+security desk/)).toBeVisible();
    await expect(owner.getByText('no contact details are shared')).toBeVisible();
  });

  await test.step('the desk finds the handover waiting and confirms it in person', async () => {
    await desk.goto('/desk');
    await desk.getByRole('tab', { name: 'Handovers waiting' }).click();
    await desk.getByRole('link', { name: new RegExp(title) }).click();
    await expect(desk.getByRole('heading', { name: 'Security desk' })).toBeVisible();
    await desk.getByRole('button', { name: 'Confirm handover' }).click();
    await expect(desk.getByText('Handed over.')).toBeVisible();

    await owner.goto(itemUrl);
    await expect(owner.getByText('This item has been returned to its owner.')).toBeVisible();
  });
});

test('the privacy policy and terms are open to everyone, from the footer @mobile', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Legal' })
    .getByRole('link', { name: 'Privacy' })
    .click();
  await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '4. How long we keep it' })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Legal' })
    .getByRole('link', { name: 'Terms' })
    .click();
  await expect(page.getByRole('heading', { name: 'Terms of use', level: 1 })).toBeVisible();
});

test('a reporter closes their post and opens it again', async ({ page }) => {
  await signUp(page, { email: uniqueEmail('closer'), first: 'Cleo', last: 'Ray' });
  const title = `Desk lamp ${Date.now().toString(36)}`;
  await reportFoundItem(page, title);

  await page.getByRole('button', { name: 'Close post' }).click();
  const dialog = page.getByRole('dialog', { name: 'Close this post?' });
  await dialog.getByText('It’s back with its owner').click();
  await dialog.getByRole('button', { name: 'Close post' }).click();

  await expect(page.getByText('This post is closed:')).toBeVisible();
  await expect(page.getByText('Closed', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Open it again' }).click();
  await expect(page.getByText('Your post is open again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close post' })).toBeVisible();
});
