import { expect, test, type Page } from '@playwright/test';
import { signUp, uniqueEmail } from './support';

/**
 * The free hosting tier puts the API to sleep after a quiet period; for up to a minute the
 * hosting layer answers 502 with an HTML page. These tests fake that and check the app copes.
 */
const SLEEPING = {
  status: 502,
  contentType: 'text/html',
  body: '<!doctype html><title>502</title>',
};

/** The health check fails `times` times before the (real) API answers again. */
async function healthFailsFirst(page: Page, times: number) {
  let left = times;
  await page.route('**/api/v1/health/live', (route) =>
    left-- > 0 ? route.fulfill(SLEEPING) : route.continue(),
  );
}

test('pages load by themselves once a sleeping server wakes up', async ({ page }) => {
  await signUp(page, { email: uniqueEmail('sleepy'), first: 'Sleepy', last: 'Reader' });
  let feedCalls = 0;
  let failedOnce = false;
  await page.route('**/api/v1/items?*', (route) => {
    feedCalls += 1;
    if (!failedOnce) {
      failedOnce = true;
      return route.fulfill(SLEEPING);
    }
    return route.continue();
  });
  await healthFailsFirst(page, 1);

  await page.reload();

  await expect(
    page.getByRole('heading', { name: 'Lost something? Found something?' }),
  ).toBeVisible();
  await expect.poll(() => feedCalls).toBeGreaterThanOrEqual(2);
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
});

test('a form sent to a sleeping server explains the wait and is not sent twice', async ({
  page,
}) => {
  let codeRequests = 0;
  await page.route('**/api/v1/auth/otp', (route) => {
    codeRequests += 1;
    return codeRequests === 1 ? route.fulfill(SLEEPING) : route.continue();
  });
  await healthFailsFirst(page, 1);
  await page.goto('/signup');

  await page.getByLabel('Email', { exact: true }).fill(uniqueEmail('early'));
  await page.getByRole('button', { name: 'Send code' }).click();

  await expect(page.getByText('The server just woke up after a quiet period')).toBeVisible();
  expect(codeRequests).toBe(1);

  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByLabel('6-digit code')).toBeVisible();
  expect(codeRequests).toBe(2);
});
