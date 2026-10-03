import { expect, test, type Page } from '@playwright/test';

/**
 * What a visitor without an account can do: read the landing page, sign in as a sample student
 * with one click, and play both sides of a claim on the sample posts.
 */
const LANDING = 'Lost something on campus? Found something?';
const BANNER = /You’re exploring as/;

async function tryAs(page: Page, name: 'Asha' | 'Ravi') {
  await page.getByRole('button', { name: `Try as ${name}` }).click();
  await expect(page.getByRole('note').getByText(BANNER)).toBeVisible();
}

test('a visitor plays both sides of a claim with the sample students', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: LANDING })).toBeVisible();

  await test.step('as Ravi, the owner, they claim the wallet', async () => {
    await tryAs(page, 'Ravi');
    await page.getByRole('link', { name: /Black bifold wallet/ }).click();
    await page.getByRole('button', { name: 'This is mine' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('What is the name on the library card inside?').fill('Ravi Singh');
    await dialog.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('What you sent')).toBeVisible();
  });

  await test.step('as Asha, the finder, they approve the claim', async () => {
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: LANDING })).toBeVisible();

    await tryAs(page, 'Asha');
    await page.getByRole('link', { name: /Black bifold wallet/ }).click();
    await expect(page.getByRole('button', { name: 'Remove report' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Review' }).click();
    await expect(page.getByText('Ravi Singh').first()).toBeVisible();
    await page.getByRole('button', { name: 'Approve' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Confirm the handover')).toBeVisible();
  });
});

test('demo accounts stay within the sample data @mobile', async ({ page }) => {
  await page.goto('/');
  await tryAs(page, 'Asha');

  // A reload restores the demo session like any other.
  await page.goto('/profile');
  await expect(page.getByText('Demo accounts can’t change their profile.')).toBeVisible();
  await expect(page.getByLabel('First name')).toHaveCount(0);

  await page.getByRole('note').getByRole('button', { name: 'Create your own account' }).click();
  await expect(page).toHaveURL(/\/signup$/);
});
