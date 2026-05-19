/**
 * E2E for Gaps #3 + #4: end-of-stay flows have upload areas.
 *
 * The flow doesn't actually discharge anyone — that would churn through
 * patients on every test run.  Instead it walks through the QuickAdd
 * "Mark discharge / death" sheet up to the form and asserts the new UI is
 * wired in: the Discharge tab has the "Discharge summary / consent"
 * uploader, the Death tab has the multi-file uploader + the red warning
 * banner.
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

    log('2) QuickAdd → Mark discharge / death → first patient…');
    await page.getByRole('button', { name: /new entry/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('button', { name: /Mark discharge \/ death/i }).click();
    await page.getByPlaceholder(/search by name/i).waitFor();
    const rows = dialog.locator('button').filter({ hasText: /Dog|Cat|Rabbit|Cow/ });
    await rows.first().waitFor({ timeout: 10_000 });
    await rows.first().click();

    log('3) Discharge tab — verify upload area for consent docs…');
    // Default tab is Discharge.  Assert the new MediaUploader label is visible.
    await dialog.getByText(/Discharge summary \/ consent/i).waitFor({ timeout: 5_000 });
    await dialog
      .getByText(/Click or drop files to upload/i)
      .first()
      .waitFor();

    log('4) Switch to Death tab — verify multi-file uploader + warning banner…');
    await dialog.getByRole('button', { name: /^Death$/ }).click();
    await dialog.getByText(/Death certificate · postmortem · body handover/i).waitFor({ timeout: 5_000 });
    await dialog.getByText(/This will mark the animal as deceased and remove it from active IPD/i).waitFor();
    await dialog
      .getByText(/Click or drop files to upload/i)
      .first()
      .waitFor();

    log('PASS — discharge + death forms expose upload UIs and the death warning banner.');
  } catch (e) {
    log(`FAIL: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
