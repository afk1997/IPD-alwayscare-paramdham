/**
 * E2E for Gap #7: /patients search + filter chips.
 *   1. Log in.
 *   2. /patients renders the new search input + status + species chips.
 *   3. Click "Critical" chip → URL gains ?status=CRITICAL.
 *   4. Click "Dog" species chip → URL gains ?species=Dog.
 *   5. Type a search query → URL gains ?q=… after debounce.
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

    log('2) Navigate to /patients…');
    await page.goto('/patients');
    await page.getByPlaceholder(/Search name, breed/).waitFor({ timeout: 10_000 });

    const waitForQuery = (pred: () => boolean, label: string) =>
      page.waitForFunction(pred, undefined, { timeout: 8_000, polling: 100 }).catch(() => {
        throw new Error(`Timed out waiting for ${label}; URL was ${page.url()}`);
      });

    log('3) Click "Critical" status chip…');
    // Scope to filter buttons by waiting for the search input first, then
    // walking up to its container — the only chip buttons are inside the
    // PatientListFilters component.
    const searchInput = page.getByPlaceholder(/Search name, breed/);
    await searchInput.waitFor();
    const filterRow = searchInput.locator('xpath=ancestor::div[contains(@class,"flex-col")][1]');
    await filterRow.getByRole('button', { name: /^Critical$/ }).click();
    await page.waitForTimeout(500);
    log(`   URL after click: ${page.url()}`);
    await waitForQuery(() => window.location.search.includes('status=CRITICAL'), 'status=CRITICAL');

    log('4) Click "Dog" species chip…');
    await page.getByRole('button', { name: /^Dog$/ }).click();
    await waitForQuery(() => window.location.search.includes('species=Dog'), 'species=Dog');

    log('5) Reset to All status…');
    await page.getByRole('button', { name: /^All$/ }).first().click();
    await waitForQuery(() => !window.location.search.includes('status='), 'status cleared');

    log('6) Type a search query…');
    await page.getByPlaceholder(/Search name, breed/).fill('zz_nonexistent_query');
    await waitForQuery(() => window.location.search.includes('q=zz_nonexistent_query'), '?q=…');
    await page.getByText(/No animals match these filters/).waitFor({ timeout: 8_000 });

    log('PASS — patient-list search + chips wired to URL state.');
  } catch (e) {
    log(`FAIL: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
