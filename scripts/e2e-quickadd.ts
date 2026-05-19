/**
 * E2E for the global "+ New entry" QuickAdd flow:
 *   1. Log in.
 *   2. Click the sidebar "+ New entry" → modal opens with 4 tiles.
 *   3. Pick "Log activity" → patient picker appears with a search input.
 *   4. Wait for results, pick the first match → activity-type chooser.
 *   5. Pick "Treatment" → form renders inside the modal.
 *   6. Fill remarks → save.
 *   7. Land on patient detail page.
 *
 * Assumes seed data has at least one admitted animal (or the prior
 * scripts/e2e-upload.ts has run to create one).
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
  page.on('pageerror', (err) => log(`   [browser pageerror] ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') log(`   [browser error] ${msg.text()}`);
  });

  try {
    log('1) Logging in…');
    await login(page);

    log('2) Open QuickAdd from sidebar…');
    await page.getByRole('button', { name: /new entry/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();

    log('3) Verify all 4 menu items present…');
    for (const label of ['New admission', 'Log activity', 'Upload document', 'Mark discharge / death']) {
      await dialog.getByRole('button', { name: label }).waitFor({ state: 'visible' });
    }

    log('4) Pick "Log activity"…');
    await dialog.getByRole('button', { name: /^Log activity/ }).click();

    log('5) Wait for patient picker results…');
    await page.getByPlaceholder(/search by name/i).waitFor();
    // Wait until at least one row appears.  Rows are buttons inside the dialog
    // that include "Dog" or "Cat" species (seed data).
    const rows = dialog.locator('button').filter({ hasText: /Dog|Cat|Rabbit|Cow/ });
    await rows.first().waitFor({ timeout: 10_000 });

    log('6) Pick first patient…');
    const firstRowText = (await rows.first().innerText()).split('\n')[0]?.trim() ?? '?';
    log(`   picked "${firstRowText}"`);
    await rows.first().click();

    log('7) Pick Doctor round (no required fields)…');
    await dialog.getByRole('button', { name: /^Doctor round$/ }).click();

    log('8) Fill remarks + save…');
    const textareas = dialog.locator('textarea');
    await textareas.first().waitFor();
    // ROUND form has many optional inputs; the remarks textarea is the last.
    const lastTextarea = textareas.last();
    await lastTextarea.fill('QuickAdd e2e: pushed via global modal.');
    await dialog.getByRole('button', { name: /save entry/i }).click();

    log('9) Wait for patient detail page navigation…');
    await page.waitForURL(/\/patients\/c[a-z0-9]{20,}$/, { timeout: 15_000 });

    log('10) Verify the new activity is visible on the page…');
    // Activity timeline should now contain our remark text.  Wait generously
    // because the timeline server-component may take a moment to render
    // after navigation triggers a `router.refresh()`.
    await page.getByText(/QuickAdd e2e: pushed via global modal/).waitFor({ timeout: 20_000 });

    log('PASS — QuickAdd flow (menu → picker → type → form → save) works end-to-end.');
  } catch (e) {
    log(`FAIL: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
