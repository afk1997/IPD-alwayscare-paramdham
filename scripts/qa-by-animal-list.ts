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

  await page.goto('/reports/by-animal');
  await page.getByRole('heading', { name: /Reports/i }).waitFor({ timeout: 10_000 });

  // List should render rows without typing.
  const rows = page.locator('a[href^="/reports/by-animal?animalId="]');
  await rows.first().waitFor({ state: 'visible', timeout: 5_000 });
  const initialCount = await rows.count();
  process.stdout.write(`Default list rows: ${initialCount}\n`);
  if (initialCount === 0) {
    throw new Error('Default list is empty — expected admitted patients to render');
  }

  // Typed search filters the list.
  const firstName = (await rows.first().innerText()).split('\n')[0]?.trim() ?? '';
  if (firstName) {
    await page.getByPlaceholder('Search by animal name…').fill(firstName.slice(0, 3));
    await page.waitForTimeout(400);
    const filtered = await rows.count();
    process.stdout.write(`After search "${firstName.slice(0, 3)}": ${filtered} rows\n`);
    if (filtered === 0) {
      throw new Error('Search query yielded zero rows');
    }
    await page.getByPlaceholder('Search by animal name…').fill('');
    await page.waitForTimeout(400);
  }

  // Toggle "Show past patients" — count should be >= without-past.
  await page.getByLabel('Show past patients').check();
  await page.waitForTimeout(400);
  const withPast = await rows.count();
  process.stdout.write(`With past patients: ${withPast} rows\n`);
  if (withPast < initialCount) {
    throw new Error(`Show-past should not reduce rows (initial=${initialCount}, withPast=${withPast})`);
  }

  process.stdout.write('\nPASS — by-animal list renders, filters, and toggles past patients.\n');
  await browser.close();
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
