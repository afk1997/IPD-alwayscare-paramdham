/**
 * E2E for Gap #11: Today dashboard "Quick actions" section.
 *   1. Log in.
 *   2. On the home page, verify a "Quick actions" heading with 4 tiles.
 *   3. Click "Doctor round" → QuickAdd opens at the patient picker step
 *      (menu skipped) with the picker pre-armed for activity logging.
 *   4. Pick the first patient → form opens directly at Doctor round
 *      (type-chooser step skipped).
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

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => log(`   [pageerror] ${err.message}`));

  try {
    log('1) Logging in…');
    await login(page);

    log('2) Verify Quick actions section…');
    await page.getByText(/Quick actions/i).waitFor({ timeout: 10_000 });
    for (const label of ['New admission', 'Log treatment', 'Doctor round', 'Food & water']) {
      await page.getByRole('button', { name: new RegExp(`^${label}$`) }).waitFor();
    }

    log('3) Click "Doctor round" — QuickAdd should skip menu and show picker…');
    await page
      .getByRole('button', { name: /^Doctor round$/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ timeout: 5_000 });
    await page.getByPlaceholder(/Search by name/).waitFor({ timeout: 5_000 });

    log('4) Pick first patient — activity form should open directly at Doctor round…');
    const rows = dialog.locator('button').filter({ hasText: /Dog|Cat|Rabbit|Cow/ });
    await rows.first().waitFor({ timeout: 10_000 });
    await rows.first().click();

    // Skipping the activity-type chooser means we land on the form with
    // the "Save entry" button visible immediately — and the modal title
    // includes "Log activity — {patient}".
    await dialog.getByRole('button', { name: /save entry/i }).waitFor({ timeout: 8_000 });
    log('PASS — Quick actions wired with prefill; type chooser skipped.');
  } catch (e) {
    log(`FAIL: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
