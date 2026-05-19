/**
 * E2E for Gap #8: /documents search + category chips.
 *   1. Log in.
 *   2. Visit /documents — verify search input + 6 chips render.
 *   3. Click a category chip → URL gains ?category=…
 *   4. Type a search query → URL gains ?q=… after debounce.
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

    log('2) Navigate to /documents…');
    await page.goto('/documents');
    await page.getByPlaceholder(/Search file, animal, type/).waitFor({ timeout: 10_000 });

    log('3) Verify all 6 chips render…');
    for (const label of ['All', 'Medical', 'Diagnostics', 'Consent', 'Ownership', 'Death related']) {
      await page.getByRole('button', { name: new RegExp(`^${label}$`) }).waitFor();
    }

    log('4) Click "Diagnostics" chip → ?category=DIAGNOSTICS…');
    await page.getByRole('button', { name: /^Diagnostics$/ }).click();
    await page.waitForFunction(() => window.location.search.includes('category=DIAGNOSTICS'), undefined, {
      timeout: 5_000,
    });

    log('5) Type a search query → ?q=…');
    await page.getByPlaceholder(/Search file, animal, type/).fill('zz_nonexistent_doc_query');
    await page.waitForFunction(
      () => window.location.search.includes('q=zz_nonexistent_doc_query'),
      undefined,
      {
        timeout: 5_000,
      },
    );
    await page.getByText(/No documents match these filters/).waitFor({ timeout: 5_000 });

    log('PASS — documents browse has search + category chips.');
  } catch (e) {
    log(`FAIL: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
