import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EMAIL_DIR = path.join(HERE, '.emails');
export const FIXTURE_PHOTO = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/keys.png',
);
export const PASSWORD = 'Lost-and-found-42';

interface StoredEmail {
  to: string;
  subject: string;
  text: string;
}

function emailsTo(address: string): StoredEmail[] {
  let files: string[] = [];
  try {
    files = readdirSync(EMAIL_DIR)
      .filter((file) => file.endsWith('.json'))
      .sort();
  } catch {
    return [];
  }
  return files
    .map((file) => JSON.parse(readFileSync(path.join(EMAIL_DIR, file), 'utf8')) as StoredEmail)
    .filter((email) => email.to === address);
}

/** Waits for a new email with a 6-digit code to arrive for `address`, and returns the code. */
export async function codeEmailedTo(address: string, previousCount = 0): Promise<string> {
  let code = '';
  await expect
    .poll(
      () => {
        const emails = emailsTo(address);
        code = /\b(\d{6})\b/.exec(emails.at(-1)?.text ?? '')?.[1] ?? '';
        return emails.length > previousCount && code !== '';
      },
      { message: `waiting for a code emailed to ${address}` },
    )
    .toBe(true);
  return code;
}

/**
 * A unique address per test run and device project, so runs never collide on the same account
 * (the API would rightly refuse a second sign-up or rate-limit a repeated code request).
 */
export function uniqueEmail(name: string, domain = 'rishihood.edu.in'): string {
  return `${name}.${test.info().project.name}.${Date.now().toString(36)}@${domain}`;
}

/** Creates an account through the real three-step sign-up form. */
export async function signUp(page: Page, person: { email: string; first: string; last: string }) {
  await page.goto('/signup');
  const emailsBefore = emailsTo(person.email).length;
  await page.getByLabel('Email', { exact: true }).fill(person.email);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('6-digit code').fill(await codeEmailedTo(person.email, emailsBefore));
  await page.getByRole('button', { name: 'Verify' }).click();

  await expect(page.getByText('Email verified · Rishihood University')).toBeVisible();
  await page.getByLabel('First name').fill(person.first);
  await page.getByLabel('Last name').fill(person.last);
  await page.getByLabel('Year').selectOption('2');
  await page.getByLabel('Enrollment no.').fill('NST23001');
  await page.getByLabel('School').selectOption('Newton School of Technology');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(
    page.getByRole('heading', { name: 'Lost something? Found something?' }),
  ).toBeVisible();
}

/**
 * Gives an account a role with the API's own command-line script (how a real deployment
 * appoints its first admin). The page must reload to pick up the new role.
 */
export function appoint(email: string, role: 'SECURITY_DESK' | 'UNIVERSITY_ADMIN') {
  const runtime = JSON.parse(readFileSync(path.join(HERE, '.runtime.json'), 'utf8')) as Record<
    string,
    string
  >;
  execFileSync('npx', ['tsx', 'src/scripts/set-role.ts', email, role], {
    cwd: path.resolve(HERE, '../../api'),
    env: { ...process.env, ...runtime, NODE_ENV: 'development', LOG_LEVEL: 'warn' },
    stdio: 'pipe',
  });
}

/** Posts a found item through the report dialog and waits for its page. */
export async function reportFoundItem(page: Page, title: string) {
  await page.getByRole('button', { name: 'Report item' }).click();
  const dialog = page.getByRole('dialog', { name: 'Report an item' });
  await dialog.getByText('I found something').click();
  await dialog.locator('input[type=file]').setInputFiles(FIXTURE_PHOTO);
  await expect(dialog.getByRole('img', { name: 'Photo 1' })).toBeVisible();
  await dialog.getByLabel('Item name').fill(title);
  await dialog.getByLabel('Category').selectOption('ELECTRONICS');
  await dialog.getByLabel('Description').fill('Brand new, message me for the price.');
  await dialog.getByLabel('Where did you find it?').fill('Library');
  await dialog.getByRole('button', { name: 'Publish report' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}
