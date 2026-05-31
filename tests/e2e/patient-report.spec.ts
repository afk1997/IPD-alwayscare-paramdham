import { expect, test } from '@playwright/test';
import { login } from './helpers';

async function admitPatient(page: import('@playwright/test').Page, name: string) {
  await page.goto('/patients/new');
  await page.getByLabel('Animal name / temporary ID').fill(name);
  await page.getByLabel('Species').selectOption('Cat');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Chief complaint').fill('Report test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Admit animal' }).click();
  await page.waitForURL(/\/patients\/[a-z0-9]+$/, { timeout: 30_000 });
}

test('admin can download a patient report PDF', async ({ page }) => {
  await login(page); // admin@arham.care (ADMIN) — allowed
  await admitPatient(page, 'ReportAdmin');
  await page.getByRole('button', { name: /download report/i }).click();
  await expect(page.getByRole('heading', { name: 'Download patient report' })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Generate', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
});

test('staff does not see the download report button', async ({ page }) => {
  await login(page, 'sahil@arham.care', 'staff1234'); // STAFF — not allowed
  await admitPatient(page, 'ReportStaff');
  await expect(page.getByRole('button', { name: /download report/i })).toHaveCount(0);
});
