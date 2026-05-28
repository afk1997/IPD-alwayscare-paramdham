import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('saving an activity does not trigger a full page reload', async ({ page }) => {
  await login(page);
  await page.goto('/patients');

  const hrefs = await page
    .locator('a[href^="/patients/"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  const realPatient = hrefs.find((h) => h && h !== '/patients/new' && /^\/patients\/[a-z0-9]{20,}$/.test(h));
  if (!realPatient) {
    test.skip(true, 'no patient cards seeded');
    return;
  }
  await page.goto(realPatient);
  await page.waitForLoadState('networkidle').catch(() => {});

  // Mark a unique sentinel on the page; if the timeline triggers a hard
  // reload, the sentinel disappears.
  await page.evaluate(() => {
    (window as unknown as { __phase2Sentinel: number }).__phase2Sentinel = Date.now();
  });

  const firstRow = page.getByTestId('activity-row').first();
  const visible = await firstRow.isVisible().catch(() => false);
  if (!visible) {
    test.skip(true, 'no activity rows on this patient');
    return;
  }
  await firstRow.click();

  const editButton = page.getByRole('button', { name: /^edit$/i });
  if (!(await editButton.isVisible().catch(() => false))) {
    test.skip(true, 'edit unavailable for current role');
    return;
  }
  await editButton.click();

  const remarks = page.getByLabel(/remarks/i);
  if (await remarks.isVisible().catch(() => false)) {
    await remarks.fill(`phase2-e2e-${Date.now()}`);
  }
  await page.getByRole('button', { name: /save/i }).click();
  await page.waitForTimeout(2000);

  const sentinel = await page.evaluate(
    () => (window as unknown as { __phase2Sentinel?: number }).__phase2Sentinel ?? null,
  );
  expect(sentinel).not.toBeNull();
});
