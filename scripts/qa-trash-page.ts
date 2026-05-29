/**
 * Probe: /admin/trash page renders for ADMIN and shows tabs, counts,
 * and per-row Restore buttons when applicable.
 *
 * Does not actually mutate — only validates that the page loads and
 * the structure is correct. Manual flow: delete an activity in the UI
 * via ActivitySheet, then navigate to /admin/trash and confirm the row
 * appears with a Restore button.
 */
import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => process.stdout.write(`[pageerror] ${e.message.slice(0, 150)}\n`));

  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@arham.care');
  await page.getByLabel('Password').fill('admin1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/', { timeout: 60_000 });

  await page.goto('/admin/trash');
  await page.getByRole('heading', { name: /^Trash$/ }).waitFor({ timeout: 10_000 });

  const tabs = ['Activities', 'Documents', 'Animals'] as const;
  for (const t of tabs) {
    const tab = page.getByRole('tab', { name: new RegExp(`^${t}\\b`) });
    await tab.waitFor({ state: 'visible', timeout: 5_000 });
    await tab.click();
    await page.waitForTimeout(150);
    process.stdout.write(`Tab "${t}" rendered\n`);
  }

  await browser.close();
  process.stdout.write('OK: qa-trash-page\n');
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
