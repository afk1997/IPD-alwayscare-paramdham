/**
 * QA probe — log an activity, click the toast Share button, read the
 * clipboard, assert the per-activity share-text shape.
 *
 * Runs against the local dev server.  Grant clipboard-read/write at
 * the context level so navigator.clipboard.readText() works headlessly.
 */
import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => process.stdout.write(`[pageerror] ${e.message.slice(0, 150)}\n`));

  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@arham.care');
  await page.getByLabel('Password').fill('admin1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/', { timeout: 30_000 });

  await page.goto('/patients');
  const firstPatient = page.locator('a[href^="/patients/"]:not([href="/patients/new"])').first();
  if (!(await firstPatient.isVisible({ timeout: 5_000 }))) {
    process.stdout.write('SKIP: no patient in DB to log against. Admit one first.\n');
    await browser.close();
    return;
  }
  await firstPatient.click();
  await page.waitForURL(/\/patients\/c[a-z0-9]{20,}$/, {
    timeout: 30_000,
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(500);

  // Per-patient ActivityQuickAdd → Treatment.
  await page
    .getByRole('button', { name: /log activity/i })
    .first()
    .click();
  await page.getByRole('button', { name: 'Treatment', exact: true }).click();

  // Fill the minimal med row so summarizeActivity has content.
  await page
    .getByPlaceholder(/medicine/i)
    .first()
    .fill('QA-Share-Probe');
  await page
    .getByPlaceholder(/dose|mg/i)
    .first()
    .fill('1.5 mg');

  await page.getByRole('button', { name: 'Save entry' }).click();

  // Wait for the success toast with a Share action button.  Scope the
  // lookup to the toast region (<output aria-live>) so it doesn't match
  // the patient-page Share button now rendered in AnimalDetailActions.
  const toast = page.locator('output[aria-live="polite"]');
  await toast.getByText(/Treatment saved/i).waitFor({ timeout: 10_000 });
  const shareInToast = toast.getByRole('button', { name: /^Share$/ });
  await shareInToast.waitFor({ state: 'visible', timeout: 10_000 });
  await shareInToast.click();

  await page.getByText(/Activity copied/i).waitFor({ timeout: 5_000 });

  const text = await page.evaluate(() => navigator.clipboard.readText());
  process.stdout.write(`Clipboard contents (${text.length} chars):\n${text}\n`);

  const lines = text.split('\n');

  // Line 1: species emoji + *Name* (species[· ward]) · D MMM YYYY
  if (!/^.+ \*[^*]+\* \([^)]+\) · \d{1,2} [A-Z][a-z]+ \d{4}$/.test(lines[0] ?? '')) {
    throw new Error(`Header line shape mismatch: "${lines[0]}"`);
  }
  // Line 2: *HH:MM  Treatment* optionally followed by `  📎`
  if (!/^\*\d{2}:\d{2} {2}Treatment\*( {2}📎)?$/.test(lines[1] ?? '')) {
    throw new Error(`Time+label line shape mismatch: "${lines[1]}"`);
  }
  if (!text.includes('QA-Share-Probe')) {
    throw new Error('Med name not present in clipboard text');
  }
  if (!/\n— /.test(text)) {
    throw new Error('byName trailer (— …) not present in clipboard text');
  }

  process.stdout.write('\nPASS — per-activity Share copies a well-formed snippet.\n');
  await browser.close();
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
