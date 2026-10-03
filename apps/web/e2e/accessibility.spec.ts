import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Automated accessibility checks (axe-core, WCAG 2.1 A and AA rules) on the main pages, signed
 * out and signed in, on a desktop and a phone. Automated rules catch about a third of real
 * problems; keyboard use and screen-reader labels are also covered by the journeys, which find
 * everything by its accessible name.
 */
async function expectNoViolations(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect.soft(summary, `${name} has accessibility problems`).toEqual([]);
}

test('the main pages pass automated accessibility checks @mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Try as Ravi' })).toBeEnabled();
  await expectNoViolations(page, 'Landing page');

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Sign in/ })).toBeVisible();
  await expectNoViolations(page, 'Sign-in page');

  await page.goto('/');
  await page.getByRole('button', { name: 'Try as Ravi' }).click();
  await expect(page.getByRole('link', { name: /Black bifold wallet/ })).toBeVisible();
  await expectNoViolations(page, 'Browse page');

  await page.getByRole('link', { name: /Black bifold wallet/ }).click();
  await expect(page.getByRole('heading', { name: 'Black bifold wallet' })).toBeVisible();
  await expectNoViolations(page, 'Item page');
  // Scrolled, the header turns translucent over the content: its text must stay readable.
  await page.mouse.wheel(0, 600);
  await expect(page.locator('header.header-glass')).toBeVisible();
  await expectNoViolations(page, 'Item page, scrolled');

  await page.goto('/claims');
  await expect(page.getByRole('heading', { name: /Claims/ }).first()).toBeVisible();
  await expectNoViolations(page, 'Claims page');

  await page.getByRole('link', { name: /Black Casio calculator/ }).click();
  await expect(page.getByRole('list', { name: 'Progress' })).toBeVisible();
  await expectNoViolations(page, 'Claim page');

  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
  await expectNoViolations(page, 'Profile page');
});
