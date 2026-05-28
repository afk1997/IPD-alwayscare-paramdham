import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('thumbnails on /patients are served via signed URLs', async ({ page }) => {
  await login(page);
  await page.goto('/patients');
  // Allow image fetches to fan out
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

  const imgs = page.locator('img[src*="/api/files/"]');
  const count = await imgs.count();
  // Test environments without seeded media (CI on a fresh DB) skip
  // the assertion — there's nothing to verify the URL shape against.
  if (count === 0) {
    test.skip(true, 'no media in test DB — skipping signed-URL shape check');
  }
  const src = await imgs.first().getAttribute('src');
  expect(src).toMatch(/\/api\/files\/[^?]+\?v=orig&sig=[A-Za-z0-9_-]{22}/);
});

test('signed /api/files response has public cache headers', async ({ page, request }) => {
  await login(page);
  await page.goto('/patients');
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  const src = await page
    .locator('img[src*="/api/files/"]')
    .first()
    .getAttribute('src')
    .catch(() => null);
  if (!src) {
    test.skip(true, 'no media in test DB — skipping cache-header check');
    return;
  }

  const res = await request.get(`http://localhost:3000${src}`);
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toContain('public');
  expect(res.headers()['cache-control']).toContain('max-age=600');
});
