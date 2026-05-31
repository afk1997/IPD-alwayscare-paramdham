import { expect, test } from '@playwright/test';

test('manifest is served and installable', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  const m = await res.json();
  expect(m.display).toBe('standalone');
  expect(m.name).toMatch(/Arham/);
  expect((m.icons ?? []).length).toBeGreaterThanOrEqual(2);
});

test('login page links the manifest and sets theme-color', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0E7C7B');
});
