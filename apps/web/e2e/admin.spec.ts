import { expect, test } from '@playwright/test';
import { appoint, reportFoundItem, signUp, uniqueEmail } from './support';

/**
 * Moderation end to end: a student reports a fake post → an admin reviews it and removes it →
 * the poster is told why. Then the admin suspends the poster, who is signed out.
 */
test('an admin removes a reported post and suspends its poster', async ({ browser }) => {
  const poster = await (await browser.newContext()).newPage();
  const student = await (await browser.newContext()).newPage();
  const admin = await (await browser.newContext()).newPage();
  const postersEmail = uniqueEmail('spammer');
  const adminsEmail = uniqueEmail('priya');
  const runId = Date.now().toString(36);
  const title = `Phones for sale ${runId}`;
  // Unique per run, so repeated runs on the same database don't see each other's entries.
  const reason = `Posting adverts ${runId}`;

  await test.step('three people sign up; one is appointed admin', async () => {
    await signUp(poster, { email: postersEmail, first: 'Sam', last: 'Spammer' });
    await signUp(student, { email: uniqueEmail('kabir'), first: 'Kabir', last: 'Rao' });
    await signUp(admin, { email: adminsEmail, first: 'Priya', last: 'Nair' });
    appoint(adminsEmail, 'UNIVERSITY_ADMIN');
    await admin.reload();
    await expect(admin.getByRole('link', { name: 'Admin' })).toBeVisible();
    await expect(student.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });

  let itemUrl = '';
  await test.step('a student reports a fake post', async () => {
    await reportFoundItem(poster, title);
    itemUrl = new URL(poster.url()).pathname;

    await student.goto(itemUrl);
    await student.getByRole('button', { name: 'Report this post' }).click();
    const dialog = student.getByRole('dialog', { name: 'Report this post' });
    await dialog.getByLabel('Scam or fake post').check();
    await dialog.getByLabel('Anything else? (optional)').fill('This is an advert');
    await dialog.getByRole('button', { name: 'Send report' }).click();
    await expect(student.getByText('An admin will review this post.')).toBeVisible();
  });

  await test.step('the admin reviews it and removes the post with a reason', async () => {
    await admin.getByRole('link', { name: 'Admin' }).click();
    await expect(admin.getByText('Reports to review')).toBeVisible();
    await admin.getByRole('link', { name: /^Reports/ }).click();

    const card = admin.getByRole('listitem').filter({ hasText: title });
    await expect(card.getByText('“This is an advert”')).toBeVisible();
    await card.getByRole('button', { name: 'Remove post' }).click();
    const dialog = admin.getByRole('dialog', { name: 'Remove this post?' });
    await dialog.getByLabel('Reason shown to the poster (optional)').fill('Selling is not allowed');
    await dialog.getByRole('button', { name: 'Remove post' }).click();
    await expect(admin.getByText('Post removed.')).toBeVisible();
    await expect(admin.getByText('Nothing here')).toBeVisible();
  });

  await test.step('the poster is told why, and the post is gone', async () => {
    await expect(async () => {
      await poster.reload();
      await expect(poster.getByRole('button', { name: /Notifications, 1 unread/ })).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });
    await poster.getByRole('button', { name: /Notifications, 1 unread/ }).click();
    await expect(poster.getByText(/Reason: Selling is not allowed/)).toBeVisible();

    await student.goto(itemUrl);
    await expect(student.getByText('Item not found.')).toBeVisible();
  });

  await test.step('the admin suspends the poster, who is signed out', async () => {
    await admin.getByRole('link', { name: 'People' }).click();
    await admin.getByLabel('Search').fill('Spammer');
    const row = admin.getByRole('listitem').filter({ hasText: postersEmail });
    await row.getByRole('button', { name: 'Suspend' }).click();
    const dialog = admin.getByRole('dialog', { name: 'Suspend Sam Spammer?' });
    await dialog.getByLabel('Reason').fill(reason);
    await dialog.getByRole('button', { name: 'Suspend' }).click();
    await expect(row.getByText('Suspended')).toBeVisible();

    // The poster's access token runs out within 15 minutes; a reload refreshes the session,
    // which the API now refuses.
    await poster.reload();
    await expect(poster.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  await test.step('the activity log shows the admin’s decisions', async () => {
    await admin.getByRole('link', { name: 'Activity', exact: true }).click();
    // Audit entries are written by the background worker, a moment after the action.
    const log = admin.getByRole('list').filter({ hasText: 'Created an account' });
    await expect(async () => {
      await admin.reload();
      await expect(log.getByText(`Reason: ${reason}`)).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(log.getByText('Decided on a report').first()).toBeVisible();
  });
});
