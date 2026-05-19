import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('log a food activity via quick-add', async ({ page }) => {
  await login(page);

  // Admit a quick test animal first
  await page.goto('/patients/new');
  await page.getByLabel('Animal name / temporary ID').fill('ActivityTest');
  await page.getByLabel('Species').selectOption('Cat');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Chief complaint').fill('Test activity flow');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Admit animal' }).click();
  await page.waitForURL(/\/patients\/[a-z0-9]+$/, { timeout: 30_000 });

  // Open the per-patient ActivityQuickAdd (button on the detail page).
  await page.getByRole('button', { name: /log activity/i }).click();
  await expect(page.getByRole('heading', { name: 'Log activity', level: 2 })).toBeVisible();

  // Pick FOOD — the modal heading updates to "Food & water".
  await page.getByRole('button', { name: /food & water/i }).click();
  await expect(page.getByRole('heading', { name: 'Food & water', level: 2 })).toBeVisible();

  await page.getByLabel('Food type').fill('Curd-rice + paneer');
  await page.getByLabel('Quantity').fill('80g');
  await page.getByLabel('Water').fill('100ml');
  // Intake used to be a <select>; gap #22-#25 turned it into a Segmented
  // button group, so we now click the option button directly.
  await page.getByRole('button', { name: 'Fully', exact: true }).click();

  await page.getByRole('button', { name: 'Save entry' }).click();

  // After save the dialog closes; we should see the activity in the timeline
  await expect(page.getByText('Curd-rice + paneer')).toBeVisible({ timeout: 10_000 });
});
