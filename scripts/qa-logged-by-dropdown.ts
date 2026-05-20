import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => process.stdout.write(`[pageerror] ${e.message.slice(0, 150)}\n`));

  // Login as admin
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@arham.care');
  await page.getByLabel('Password').fill('admin1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/', { timeout: 30_000 });

  // Open the first patient on /patients
  await page.goto('/patients');
  const firstPatient = page.locator('a[href^="/patients/"]:not([href="/patients/new"])').first();
  if (!(await firstPatient.isVisible({ timeout: 5_000 }))) {
    process.stdout.write('SKIP: no patient in DB to log against. Admit one first.\n');
    await browser.close();
    return;
  }
  await firstPatient.click();
  await page.waitForURL(/\/patients\/c[a-z0-9]{24}$/, { timeout: 15_000 });
  await page.waitForTimeout(500);

  // Per-patient ActivityQuickAdd → Treatment
  await page
    .getByRole('button', { name: /log activity/i })
    .first()
    .click();
  // Use `exact` to disambiguate the type-chooser button from any
  // existing Treatment rows already in the timeline.
  await page.getByRole('button', { name: 'Treatment', exact: true }).click();

  const select = page.getByLabel('Logged by');
  await select.waitFor({ state: 'visible' });

  const tag = await select.evaluate((el) => el.tagName.toLowerCase());
  if (tag !== 'select') {
    throw new Error(`Logged-by control is <${tag}>, expected <select>`);
  }
  const options = await select.evaluate((el) =>
    Array.from((el as HTMLSelectElement).options).map((o) => o.value),
  );
  process.stdout.write(`dropdown options (${options.length}): ${options.join(', ')}\n`);

  const defaultVal = await select.evaluate((el) => (el as HTMLSelectElement).value);
  if (defaultVal !== 'Asha (Reception)') {
    throw new Error(`Default was "${defaultVal}", expected "Asha (Reception)"`);
  }
  process.stdout.write('  ✓ defaults to current user (Asha)\n');

  // Change to Dr. Mehta + fill mandatory treatment fields
  await select.selectOption('Dr. Mehta');
  await page
    .getByPlaceholder(/medicine/i)
    .first()
    .fill('QA-LoggedBy-Test');
  await page
    .getByPlaceholder(/dose|mg/i)
    .first()
    .fill('5mg/kg');
  await page.getByRole('button', { name: 'Save entry' }).click();

  await page.getByText(/Treatment saved/i).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1500);

  const rowText = await page.locator('button').filter({ hasText: 'QA-LoggedBy-Test' }).first().innerText();
  process.stdout.write(`saved row: ${rowText.replace(/\n/g, ' | ')}\n`);
  if (!rowText.includes('Dr. Mehta')) {
    throw new Error(`Row attribution is missing "Dr. Mehta": ${rowText}`);
  }
  process.stdout.write('  ✓ selection persisted to the timeline row\n');

  process.stdout.write('\nPASS — Logged-by dropdown defaults to admin, persists the selection.\n');
  await browser.close();
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
