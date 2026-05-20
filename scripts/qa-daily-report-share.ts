/**
 * QA probe — log in, open /reports/today, click Share, read the
 * clipboard, assert the report header + entry-count shape.
 *
 * Runs against the local dev server.  Grant clipboard-read/write at
 * the context level so `navigator.clipboard.readText()` works
 * headlessly (Chromium's default policy denies it).
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

  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@arham.care');
  await page.getByLabel('Password').fill('admin1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/', { timeout: 30_000 });

  await page.goto('/reports/today');
  await page.getByRole('heading', { name: /Daily activity report/i }).waitFor({ timeout: 10_000 });

  const shareBtn = page.getByRole('button', { name: /^Share$/ });
  await shareBtn.waitFor({ state: 'visible' });

  // If the DB has nothing for today, the button is disabled — that's
  // a valid shape and we exit cleanly.
  if (await shareBtn.isDisabled()) {
    process.stdout.write('No entries today; Share button is disabled as expected.\n');
    await browser.close();
    return;
  }

  await shareBtn.click();
  await page.getByText(/Daily report copied/i).waitFor({ timeout: 5_000 });

  const text = await page.evaluate(() => navigator.clipboard.readText());
  process.stdout.write(`Clipboard contents (${text.length} chars):\n${text}\n`);

  // Header is bold-wrapped in WhatsApp markdown (*…*).
  if (!text.startsWith('*🏥 Arham Always Care —')) {
    throw new Error('Clipboard text does not start with the expected header');
  }
  const secondLine = text.split('\n')[1] ?? '';
  if (!/^\d+ (entry|entries)$/.test(secondLine)) {
    throw new Error(`Second line not entry-count: "${secondLine}"`);
  }

  process.stdout.write('\nPASS — Share button copies a well-formed report.\n');
  await browser.close();
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
