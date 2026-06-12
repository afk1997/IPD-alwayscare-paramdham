import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('admit a new animal end-to-end', async ({ page }) => {
  await login(page);

  await page.goto('/patients');
  await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();

  await page.goto('/patients/new');
  await expect(page.getByRole('heading', { name: 'New admission' })).toBeVisible();

  // Step 1: Basics
  await page.getByLabel('Animal name / temporary ID').fill('TestBruno');
  await page.getByLabel('Species').selectOption('Dog');
  await page.getByLabel('Breed').fill('Indie');
  await page.getByLabel('Approx age').fill('~2 yrs');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2: Rescuer
  await page.getByLabel('Rescuer / Owner name').fill('Test Rescuer');
  await page.getByLabel('Contact number').fill('+91 99999 99999');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3: Medical — chief complaint is required, so an empty Continue
  // must block with an inline error and stay on this step.
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Chief complaint is required')).toBeVisible();
  await page.getByLabel('Chief complaint').fill('Hit by vehicle');
  // Blur so the onBlur revalidation clears the inline error (and its
  // layout shift) before Continue is clicked — otherwise the error row
  // collapses between mousedown and mouseup and the click lands on the
  // form container instead of the button.
  await page.getByLabel('Chief complaint').blur();
  await expect(page.getByText('Chief complaint is required')).toBeHidden();
  await page.getByLabel('Status').selectOption('CRITICAL');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 4: Media (skip — no upload). Wait for the step to render before
  // clicking its Continue so the click can't fire while step 3 is still
  // mid-transition.
  await expect(page.getByRole('heading', { name: 'Admission media' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 5: Doctor notes
  await page.getByLabel('Tentative diagnosis').fill('Suspected femur fracture');
  await page.getByRole('button', { name: 'X-ray', exact: true }).click();
  await page.getByRole('button', { name: 'Blood test' }).click();

  await page.getByRole('button', { name: 'Admit animal' }).click();

  // Land on detail page (createAnimal includes a Drive folder lookup +
  // ownership check, which can push the redirect past 15s on cold CI).
  await page.waitForURL(/\/patients\/[a-z0-9]+$/, { timeout: 30_000 });
  await expect(page.getByText('TestBruno').first()).toBeVisible({ timeout: 10_000 });
  // Complaint now appears twice on the detail page — the hero "chief complaint"
  // and the synthetic "Admitted" timeline entry — so scope to the first match.
  await expect(page.getByText('Hit by vehicle').first()).toBeVisible();

  // Switch to Details tab to verify diagnosis
  await page.getByRole('button', { name: /^Details$/ }).click();
  await expect(page.getByText('Suspected femur fracture')).toBeVisible();
});

test('patient list shows admitted animal', async ({ page }) => {
  await login(page);
  await page.goto('/patients');
  await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
  // The admit test above just admitted TestBruno; Playwright runs specs
  // serially (fullyParallel: false in playwright.config.ts) so this row
  // is reliably present.
  await expect(page.getByText('TestBruno').first()).toBeVisible({ timeout: 10_000 });
});
