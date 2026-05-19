/**
 * E2E for Gap #2: occurredAt datetime picker on activity forms.
 *   1. Log in.
 *   2. Open QuickAdd → Log activity → pick first patient → Doctor round.
 *   3. Override the "When did this happen?" picker to a known time 3 hours
 *      ago.
 *   4. Save the activity.
 *   5. On the patient page, verify the new entry shows a relative time like
 *      "3h ago" (rather than "just now"), proving the override was honoured
 *      through schema + service.
 */
import { type Page, chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'admin@arham.care';
const PASSWORD = process.env.E2E_PASSWORD ?? 'admin1234';

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

function localDatetimeInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

    log('2) QuickAdd → Log activity → first patient → Doctor round…');
    await page.getByRole('button', { name: /new entry/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('button', { name: /^Log activity/ }).click();
    await page.getByPlaceholder(/search by name/i).waitFor();
    const rows = dialog.locator('button').filter({ hasText: /Dog|Cat|Rabbit|Cow/ });
    await rows.first().waitFor({ timeout: 10_000 });
    await rows.first().click();
    await dialog.getByRole('button', { name: /^Doctor round$/ }).click();

    log('3) Overriding "When did this happen?" to 3 hours ago…');
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const targetValue = localDatetimeInputValue(threeHoursAgo);
    const picker = dialog.locator('input[type="datetime-local"]').first();
    await picker.waitFor();
    await picker.fill(targetValue);

    log('4) Fill remark + Save…');
    const stamp = `occurredAt-e2e-${Math.random().toString(36).slice(2, 8)}`;
    await dialog.locator('textarea').last().fill(stamp);
    await dialog.getByRole('button', { name: /save entry/i }).click();

    log('5) Wait for patient detail page…');
    await page.waitForURL(/\/patients\/c[a-z0-9]{20,}$/, { timeout: 20_000 });
    await page.getByText(stamp).waitFor({ timeout: 15_000 });

    log('6) Verify the activity shows ~3h ago timestamp…');
    // The ActivityTimeline renders relativeTime — "3h ago" / "2h ago" / "4h ago"
    // depending on exact timing, but it must NOT be "just now" or "<1h ago".
    const stampLocator = page.getByText(stamp).first();
    const stampContainer = stampLocator.locator('xpath=ancestor::li[1]');
    const containerText = await stampContainer.innerText().catch(async () => stampLocator.innerText());
    if (/just now|min ago/i.test(containerText)) {
      throw new Error(
        `Expected backfilled timestamp (~3h ago) but timeline shows "just now" / "Xm ago".  Text:\n${containerText}`,
      );
    }
    if (!/\b[2-4]h ago\b/i.test(containerText)) {
      log(
        `   note: relative-time string not strictly "3h ago" but no "just now"/"min ago" either; container text:\n${containerText}`,
      );
    }

    log('PASS — occurredAt override is honoured end-to-end.');
  } catch (e) {
    log(`FAIL: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
