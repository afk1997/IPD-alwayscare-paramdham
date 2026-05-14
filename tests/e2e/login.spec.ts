import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('redirects unauthenticated user to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login(\?|$)/);
  await expect(page.getByRole('heading', { name: /arham always care/i })).toBeVisible();
});

test('rejects wrong password', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@arham.care');
  await page.getByLabel('Password').fill('wrong-pw');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10_000 });
});

test('admin logs in and lands on Today', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
});
