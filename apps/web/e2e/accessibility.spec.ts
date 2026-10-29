import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { appoint, expectItemPage, signUp, uniqueEmail } from './support';

/**
 * Automated accessibility checks (axe-core, WCAG 2.1 A and AA rules) on the main pages, signed
 * out and signed in, on a desktop and a phone. Automated rules catch about a third of real
 * problems; keyboard use and screen-reader labels are also covered by the journeys, which find
 * everything by its accessible name.
 */
// Colours are checked as they end up, not halfway through a transition (e.g. a nav link
// fading from its active to its normal colour); the app turns transitions off for this setting.
test.use({ reducedMotion: 'reduce' });

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

  // The sample data leaves Ravi unread notifications; unread ones have a tinted background.
  await page.getByRole('button', { name: /^Notifications, \d+ unread$/ }).click();
  await expect(page.getByRole('region', { name: 'Notifications', exact: true })).toBeVisible();
  await expectNoViolations(page, 'Notifications, unread');
  await page.getByRole('button', { name: /^Notifications/ }).click();

  // A post held at the security desk says so in green, on the page background.
  await page.getByLabel('Search items').fill('scientific calculator');
  await page.getByRole('link', { name: /Blue scientific calculator/ }).click();
  await expectItemPage(page, 'Blue scientific calculator');
  await expect(page.getByText('Handed in at the security desk').first()).toBeVisible();
  await expectNoViolations(page, 'Item page, held at the desk');
  await page.goto('/');

  await page.getByRole('link', { name: /Black bifold wallet/ }).click();
  await expectItemPage(page, 'Black bifold wallet');
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

test('someone without a profile picture, and a date-range error, pass the checks too @mobile', async ({
  page,
}) => {
  // Most people have no picture: the header shows their initials instead.
  await signUp(page, { email: uniqueEmail('a11y-initials'), first: 'Omar', last: 'Qureshi' });
  await expectNoViolations(page, 'Browse page, no profile picture');

  await page.goto('/?when=custom&from=2026-10-20&to=2026-10-10');
  await expect(page.getByText('"To" must be on or after "From"')).toBeVisible();
  await expectNoViolations(page, 'Browse page, dates the wrong way round');
});

test('the admin pages pass automated accessibility checks', async ({ page }) => {
  const email = uniqueEmail('a11y-admin');
  await signUp(page, { email, first: 'Ada', last: 'Admin' });
  appoint(email, 'UNIVERSITY_ADMIN');
  await page.reload();

  for (const [path, title] of [
    ['/admin', 'Overview'],
    ['/admin/reports', 'Reported posts'],
    ['/admin/posts', 'All posts'],
    ['/admin/users', 'People'],
    ['/admin/activity', 'Activity'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expectNoViolations(page, `Admin: ${title}`);
  }
});
