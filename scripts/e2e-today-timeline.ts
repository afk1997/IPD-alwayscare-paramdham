/**
 * E2E for the Today dashboard timeline:
 *   1. Log in.
 *   2. From "+ New entry", log a Doctor round activity on an existing patient.
 *   3. Navigate to / (home).
 *   4. Verify the home page shows "Today's activities" heading and the new
 *      activity appears in the timeline (latest first) with the patient name.
 */
import { type Page, chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'admin@arham.care';
const PASSWORD = process.env.E2E_PASSWORD ?? 'admin1234';

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/$/);
}

async function logActivity(page: Page): Promise<string> {
  await page.getByRole('button', { name: /new entry/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByRole('button', { name: /^Log activity/ }).click();
  await page.getByPlaceholder(/search by name/i).waitFor();
  const rows = dialog.locator('button').filter({ hasText: /Dog|Cat|Rabbit|Cow/ });
  await rows.first().waitFor({ timeout: 10_000 });
  const firstRowText = (await rows.first().innerText()).split('\n')[0]?.trim() ?? '?';
  await rows.first().click();
  await dialog.getByRole('button', { name: /^Doctor round$/ }).click();
  const stamp = `today-timeline-e2e-${Math.random().toString(36).slice(2, 8)}`;
  await dialog.locator('textarea').last().fill(stamp);
  await dialog.getByRole('button', { name: /save entry/i }).click();
  await page.waitForURL(/\/patients\/c[a-z0-9]{20,}$/, { timeout: 15_000 });
  return firstRowText;
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => log(`   [pageerror] ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') log(`   [browser error] ${msg.text()}`);
  });

  try {
    log('1) Logging in…');
    await login(page);

    log('2) Logging an activity via QuickAdd…');
    const animalName = await logActivity(page);
    log(`   logged Doctor round for "${animalName}"`);

    log('3) Going home…');
    await page.goto('/');

    log('4) Verify "Today\'s activities" heading…');
    await page.getByText(/Today's activities/i).waitFor({ timeout: 10_000 });

    log('5) Verify timeline contains our animal name (latest first)…');
    // The animal name appears as the first font-display element in the list.
    const list = page.locator('ul').filter({ hasText: animalName });
    await list.first().waitFor({ timeout: 10_000 });
    const firstItem = list.first().locator('li').first();
    const text = await firstItem.innerText();
    if (!text.includes(animalName)) {
      throw new Error(`First timeline item does not include "${animalName}"; got: ${text}`);
    }
    if (!/Doctor round/i.test(text)) {
      throw new Error(`First timeline item missing "Doctor round" badge; got: ${text}`);
    }

    log('PASS — Today timeline shows freshly-logged activities, latest first.');
  } catch (e) {
    log(`FAIL: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
