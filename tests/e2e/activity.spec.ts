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
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /food & water/i })
    .click();
  await expect(page.getByRole('heading', { name: 'Food & water', level: 2 })).toBeVisible();

  await page.getByLabel('Food type').fill('Curd-rice + paneer');
  await page.getByLabel('Quantity').fill('80g');
  // exact: true — the QuickAdd modal's aria-label "Food & water" also
  // matches a substring "Water" search and trips Playwright strict mode.
  await page.getByLabel('Water', { exact: true }).fill('100ml');
  // Intake used to be a <select>; gap #22-#25 turned it into a Segmented
  // button group, so we now click the option button directly.
  await page.getByRole('button', { name: 'Fully', exact: true }).click();

  await page.getByRole('button', { name: 'Save entry' }).click();

  // After save the dialog closes; we should see the activity in the timeline
  await expect(page.getByText('Curd-rice + paneer')).toBeVisible({ timeout: 10_000 });
});

test('date filter narrows the feed and keeps the admission pinned', async ({ page }) => {
  await login(page);

  // Admit a fresh patient (admission timestamp ~ now / today).
  await page.goto('/patients/new');
  await page.getByLabel('Animal name / temporary ID').fill('FilterTest');
  await page.getByLabel('Species').selectOption('Cat');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Chief complaint').fill('Date filter flow');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Admit animal' }).click();
  await page.waitForURL(/\/patients\/[a-z0-9]+$/, { timeout: 30_000 });

  const pad = (n: number) => String(n).padStart(2, '0');
  const dtLocal = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Entry #1 — back-dated 5 days ago.
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  fiveDaysAgo.setHours(10, 0, 0, 0);
  await page.getByRole('button', { name: /log activity/i }).click();
  // Scope to the quick-add dialog — the activity feed behind it can contain
  // "Food & water" rows from earlier entries, which trip strict mode.
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /food & water/i })
    .click();
  await page.getByLabel('Food type').fill('BackdatedFood');
  await page.getByRole('button', { name: 'Fully', exact: true }).click();
  await page.locator('input[type="datetime-local"]').fill(dtLocal(fiveDaysAgo));
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByText('BackdatedFood')).toBeVisible({ timeout: 10_000 });

  // Entry #2 — today (default occurredAt).
  await page.getByRole('button', { name: /log activity/i }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /food & water/i })
    .click();
  await page.getByLabel('Food type').fill('TodayFood');
  await page.getByRole('button', { name: 'Fully', exact: true }).click();
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByText('TodayFood')).toBeVisible({ timeout: 10_000 });

  // Custom range covering 5..4 days ago — includes the back-dated entry,
  // excludes today (so it also excludes the admission, which is ~today).
  const from = new Date();
  from.setDate(from.getDate() - 5);
  const to = new Date();
  to.setDate(to.getDate() - 4);
  await page.getByRole('button', { name: 'Custom range' }).click();
  await page.locator('input[type="date"]').first().fill(dateInput(from));
  await page.locator('input[type="date"]').nth(1).fill(dateInput(to));
  await page.getByRole('button', { name: 'Apply' }).click();

  // Back-dated entry visible; today's entry filtered out.
  await expect(page.getByText('BackdatedFood')).toBeVisible();
  await expect(page.getByText('TodayFood')).toHaveCount(0);
  // Admission is outside the range but pinned, so it stays visible.
  await expect(page.getByTestId('lifecycle-row').filter({ hasText: 'Admitted' })).toBeVisible();

  // Clear → today's entry returns.
  await page.getByRole('button', { name: 'Show all' }).click();
  await expect(page.getByText('TodayFood')).toBeVisible();
});
