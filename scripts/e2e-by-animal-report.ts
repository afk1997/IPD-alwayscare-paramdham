/**
 * E2E for Gap #6: Reports "By animal" tab.
 *   1. Log in.
 *   2. Visit /reports/by-animal — verify tab nav + picker render.
 *   3. Type a search query, pick the first match, land on the report.
 *   4. Verify the totals grid (8 cards) and the complete-history section.
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

    log('2) Navigate to /reports/by-animal…');
    await page.goto('/reports/by-animal');
    await page.getByRole('link', { name: /Activity by date/i }).waitFor();
    await page.getByRole('link', { name: /By animal/i }).waitFor();
    await page.getByPlaceholder(/search by animal name/i).waitFor();

    log('3) Focus picker and pick first match…');
    const picker = page.getByPlaceholder(/search by animal name/i);
    await picker.click();
    // The dropdown lists existing admitted animals by name + species/ward.
    const firstHit = page.locator('ul > li > button').first();
    await firstHit.waitFor({ timeout: 10_000 });
    const name = (await firstHit.innerText()).split('\n')[0]?.trim() ?? '';
    log(`   picked "${name}"`);
    await firstHit.click();

    log('4) Wait for ?animalId= URL + totals grid…');
    await page.waitForURL(/\/reports\/by-animal\?animalId=c[a-z0-9]{20,}$/);
    await page.getByText(/Activity totals/i).waitFor({ timeout: 10_000 });
    // Verify each of the 8 type labels is rendered as a tile.
    for (const label of [
      'Admission',
      'Treatment',
      'Doctor round',
      'Diagnostic',
      'Surgery',
      'Food & water',
      'Bath & grooming',
      'Walk / movement',
    ]) {
      await page.getByText(label, { exact: true }).first().waitFor();
    }

    log('5) Verify complete history section appears…');
    await page.getByText(/Complete history/i).waitFor();

    log('PASS — per-animal report renders picker, totals grid and history.');
  } catch (e) {
    log(`FAIL: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
