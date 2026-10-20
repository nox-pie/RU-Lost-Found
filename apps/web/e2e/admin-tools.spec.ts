import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { appoint, choose, describePage, reportFoundItem, signUp, uniqueEmail } from './support';

/** A day in this machine's time zone (the browser's too), as a date input expects it. */
function localDay(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-');
}

test('an admin removes any post from the Posts tab and filters the activity log', async ({
  browser,
}) => {
  const poster = await (await browser.newContext()).newPage();
  const admin = await (await browser.newContext()).newPage();
  const adminsEmail = uniqueEmail('admin');
  const runId = Date.now().toString(36);
  const title = `Spare charger ${runId}`;

  await test.step('a student posts; an admin is appointed', async () => {
    await signUp(poster, { email: uniqueEmail('poster'), first: 'Tara', last: `Poster${runId}` });
    await reportFoundItem(poster, title);
    await signUp(admin, { email: adminsEmail, first: 'Ana', last: 'Admin' });
    appoint(adminsEmail, 'UNIVERSITY_ADMIN');
    await admin.reload();
  });

  await test.step('the admin finds the post in the Posts tab and removes it with a reason', async () => {
    await admin.goto('/admin/posts');
    await admin
      .getByLabel('Search')
      .fill(runId, { timeout: 30_000 })
      .catch(async (error: Error) => {
        throw new Error(`The Posts tab did not open (${await describePage(admin)})`, {
          cause: error,
        });
      });
    const row = admin.getByRole('listitem').filter({ hasText: title });
    await row.getByRole('button', { name: 'Remove' }).click();
    const dialog = admin.getByRole('dialog', { name: 'Remove this post?' });
    await dialog.getByLabel('Reason shown to the poster (optional)').fill('Duplicate post');
    await dialog.getByRole('button', { name: 'Remove post' }).click();
    await expect(admin.getByText('The post was removed.')).toBeVisible();

    await choose(admin, 'Status', 'Removed');
    await expect(row.getByText('Removed')).toBeVisible();
    await expect(row.getByRole('button', { name: 'Remove' })).toHaveCount(0);
  });

  await test.step('activity can be narrowed to a day and to one person', async () => {
    await admin.goto('/admin/activity');
    const log = admin.getByRole('list');

    // A year back: before any activity, including the sample data's (about eight weeks).
    await admin.getByLabel('From').fill(localDay(-365));
    await admin.getByLabel('To').fill(localDay(-365));
    await expect(admin.getByText('Nothing matches these filters')).toBeVisible();

    await admin.getByLabel('To').fill(localDay());
    await admin.getByLabel('From').fill(localDay());
    // Entries are written by the background worker a moment after the action.
    await expect(async () => {
      await admin.reload();
      await expect(log.getByRole('button', { name: `Tara Poster${runId}` }).first()).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });

    await log
      .getByRole('button', { name: `Tara Poster${runId}` })
      .first()
      .click();
    await expect(admin.getByText(`By Tara Poster${runId}`)).toBeVisible();
    await expect(log.getByText('Posted an item')).toBeVisible();
    await expect(log.getByText('Ana Admin')).toHaveCount(0);
  });
});

test('an admin sees where things go missing and downloads the posts of a period', async ({
  page,
}) => {
  const email = uniqueEmail('insights');
  await signUp(page, { email, first: 'Ivy', last: 'Admin' });
  await reportFoundItem(page, `Library charger ${Date.now().toString(36)}`); // in the Library
  appoint(email, 'UNIVERSITY_ADMIN');
  await page.goto('/admin');

  const where = page.getByRole('region', { name: 'Where' });
  await expect(page.getByRole('heading', { name: 'What gets lost and found' })).toBeVisible();
  await expect(where.getByText('Library')).toBeVisible();

  await page.getByLabel('From').fill(localDay(-1));
  await page.getByLabel('To').fill(localDay());
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  const file = await downloading;

  expect(file.suggestedFilename()).toBe(`posts-${localDay(-1)}-to-${localDay()}.csv`);
  const csv = readFileSync(await file.path(), 'utf8');
  expect(csv.split('\r\n')[0]).toContain('Posted on,Type,Category,Title,Campus place');
  expect(csv).toContain('Library charger');
  expect(csv).not.toContain(email);
});
