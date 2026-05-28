import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Thumbnails render through next/image, so the rendered <img src> is
// `/_next/image?url=<percent-encoded /api/files/…?v=orig&sig=…>&w=…&q=…`,
// NOT a bare `/api/files/…` URL.  Decode the `url` param to inspect the
// underlying signed URL.
function innerSignedUrl(optimizerSrc: string): string {
  const u = new URL(optimizerSrc, 'http://localhost:3000');
  return decodeURIComponent(u.searchParams.get('url') ?? '');
}

test('thumbnails on /patients are served via signed URLs', async ({ page }) => {
  await login(page);
  await page.goto('/patients');
  // Allow image fetches to fan out
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

  const imgs = page.locator('img[src*="/_next/image"]');
  const count = await imgs.count();
  // Test environments without seeded media (CI on a fresh DB) skip the
  // assertion — there's nothing to verify the URL shape against.
  if (count === 0) {
    test.skip(true, 'no media in test DB — skipping signed-URL shape check');
    return;
  }
  const src = await imgs.first().getAttribute('src');
  expect(innerSignedUrl(src ?? '')).toMatch(/\/api\/files\/[^?]+\?v=orig&sig=[A-Za-z0-9_-]{22}/);
});

test('signed /api/files response has public cache headers', async ({ page, request }) => {
  await login(page);
  await page.goto('/patients');
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  const count = await page.locator('img[src*="/_next/image"]').count();
  if (count === 0) {
    test.skip(true, 'no media in test DB — skipping cache-header check');
    return;
  }
  const src = await page.locator('img[src*="/_next/image"]').first().getAttribute('src');
  const signed = innerSignedUrl(src ?? '');

  const res = await request.get(`http://localhost:3000${signed}`);
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toContain('public');
  expect(res.headers()['cache-control']).toContain('max-age=600');
});
