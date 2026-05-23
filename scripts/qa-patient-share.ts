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
    process.stdout.write('SKIP: no patient in DB.\n');
    await browser.close();
    return;
  }
  const patientName = (await firstPatient.innerText()).split('\n')[0]?.trim() ?? '';
  await firstPatient.click();
  // Use domcontentloaded — default 'load' state can stall on slow image
  // / font loads in CI and time out before the URL pattern is checked.
  await page.waitForURL(/\/patients\/c[a-z0-9]{20,}$/, {
    timeout: 30_000,
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(500);

  // Patient page Share button — sits next to "Log activity".
  const share = page.getByRole('button', { name: /^Share$/ });
  await share.waitFor({ state: 'visible', timeout: 10_000 });
  await share.click();

  await page.getByText(/Patient's day copied/i).waitFor({ timeout: 5_000 });

  const text = await page.evaluate(() => navigator.clipboard.readText());
  process.stdout.write(`Clipboard (${text.length} chars):\n${text}\n`);

  if (!text.startsWith('*🏥 Arham Always Care —')) {
    throw new Error('Header missing or malformed');
  }

  // Should contain at most one animal block — count the species-emoji lines.
  const animalLines = text.split('\n').filter((l) => /^[\p{Extended_Pictographic}🐾] \*/u.test(l));
  if (animalLines.length > 1) {
    throw new Error(`Expected ≤1 animal block, got ${animalLines.length}`);
  }
  if (patientName && animalLines.length === 1 && !animalLines[0]?.includes(`*${patientName}*`)) {
    throw new Error(`Patient name "${patientName}" not found bolded in animal block: ${animalLines[0]}`);
  }

  process.stdout.write('\nPASS — per-patient Share copies a single-patient daily report.\n');
  await browser.close();
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
