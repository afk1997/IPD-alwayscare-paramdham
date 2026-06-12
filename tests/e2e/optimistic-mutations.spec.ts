import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('saving an activity does not trigger a full page reload', async ({ page }) => {
  await login(page);

  // Self-sufficient data: admit a patient and log one activity, so the edit
  // flow below never depends on what earlier specs left in the database.
  // (Picking "the first patient card" used to skip whenever the most recent
  // admission had no activities.)
  await page.goto('/patients/new');
  await page.getByLabel('Animal name / temporary ID').fill('OptimisticTest');
  await page.getByLabel('Species').selectOption('Dog');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Chief complaint').fill('Optimistic update flow');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Admit animal' }).click();
  await page.waitForURL(/\/patients\/[a-z0-9]+$/, { timeout: 30_000 });

  await page.getByRole('button', { name: /log activity/i }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /food & water/i })
    .click();
  await page.getByLabel('Food type').fill('OptimisticFood');
  await page.getByRole('button', { name: 'Fully', exact: true }).click();
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByText('OptimisticFood')).toBeVisible({ timeout: 10_000 });

  // Mark a unique sentinel on the page; if the timeline triggers a hard
  // reload, the sentinel disappears.
  await page.evaluate(() => {
    (window as unknown as { __phase2Sentinel: number }).__phase2Sentinel = Date.now();
  });

  await page.getByTestId('activity-row').first().click();

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
