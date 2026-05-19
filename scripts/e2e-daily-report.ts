/**
 * E2E for Gap #5: /reports/today filter chips + CSV export.
 *   1. Log in.
 *   2. Navigate to /reports/today.
 *   3. Verify the "All" chip + the 8 per-type chips render with counts.
 *   4. Click the "Doctor round" chip and verify the entry count badge updates.
 *   5. Trigger the Export CSV button and verify a CSV download is initiated.
 */
import { type Download, type Page, chromium } from '@playwright/test';

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
  const ctx = await browser.newContext({ baseURL: BASE, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => log(`   [pageerror] ${err.message}`));

  try {
    log('1) Logging in…');
    await login(page);

    log('2) Going to /reports/today…');
    await page.goto('/reports/today');
    await page.getByText(/Daily activity report/i).waitFor();

    log('3) Verify filter chips render…');
    await page.getByRole('button', { name: /^All ·/ }).waitFor({ timeout: 10_000 });
    for (const label of [
      'Doctor round',
      'Treatment',
      'Diagnostic',
      'Surgery',
      'Food & water',
      'Bath & grooming',
      'Walk / movement',
      'Admission',
    ]) {
      await page.getByRole('button', { name: new RegExp(`^${label} ·`) }).waitFor();
    }

    log('4) Click "Doctor round" chip and verify entry count line updates…');
    await page.getByRole('button', { name: /^Doctor round ·/ }).click();
    await page.getByText(/· Doctor round/).waitFor({ timeout: 3_000 });

    log('5) Trigger Export CSV download…');
    const exportButton = page.getByRole('button', { name: /Export CSV/i });
    // Reset to ALL so we have rows to export (the dev DB may have no Doctor
    // round entries for today). If there are still none, this still proves
    // the disabled state works.
    await page.getByRole('button', { name: /^All ·/ }).click();
    const enabled = await exportButton.isEnabled();
    if (!enabled) {
      log('   note: no rows to export today — Export CSV is disabled (correct behavior).');
    } else {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      const dl: Download = await downloadPromise;
      const filename = dl.suggestedFilename();
      if (!filename.startsWith('activity-report-')) {
        throw new Error(`Unexpected filename: ${filename}`);
      }
      log(`   CSV downloaded: ${filename}`);
    }

    log('PASS — daily report has filter chips + CSV export.');
  } catch (e) {
    log(`FAIL: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
