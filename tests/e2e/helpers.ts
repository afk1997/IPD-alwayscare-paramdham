import type { Page } from '@playwright/test';

export async function login(page: Page, email = 'admin@arham.care', password = 'admin1234') {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  // 60s — first Next compile on a cold CI runner can be 20-30s on top
  // of the auth round-trip.
  await page.waitForURL('/', { timeout: 60_000 });
}
