import type { Page } from '@playwright/test';

export async function login(page: Page, email = 'admin@arham.care', password = 'admin1234') {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/', { timeout: 15_000 });
}
