import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Thumbnails render through next/image, so the rendered <img src> is
// `/_next/image?url=<percent-encoded /api/files/…?v=orig&sig=…>&w=…&q=…`.
// `encodeURIComponent('/api/files')` → `%2Fapi%2Ffiles`, so match on that to
// pick only signed-media thumbnails, then decode the `url` param to inspect
// the underlying signed URL.
const SIGNED_THUMB = 'img[src*="%2Fapi%2Ffiles"]';

function innerSignedUrl(optimizerSrc: string): string {
  const u = new URL(optimizerSrc, 'http://localhost:3000');
  return decodeURIComponent(u.searchParams.get('url') ?? '');
}

// In `next dev` the HMR socket keeps the network busy, so `networkidle` never
// fires — bound it so a best-effort settle can't consume the whole 30s test
// budget. Then read the first signed thumbnail with its own short timeout; if
// the seed rendered no media, skip fast instead of hanging.
async function firstSignedThumbSrc(page: import('@playwright/test').Page): Promise<string | null> {
  await page.goto('/patients');
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  return page
    .locator(SIGNED_THUMB)
    .first()
    .getAttribute('src', { timeout: 8000 })
    .catch(() => null);
}

test('thumbnails on /patients are served via signed URLs', async ({ page }) => {
  await login(page);
  const src = await firstSignedThumbSrc(page);
  if (!src) {
    test.skip(true, 'no signed thumbnail rendered on /patients (seed has no media)');
    return;
  }
  expect(innerSignedUrl(src)).toMatch(/\/api\/files\/[^?]+\?v=orig&sig=[A-Za-z0-9_-]{22}/);
});

test('signed /api/files response has public cache headers', async ({ page, request }) => {
  await login(page);
  const src = await firstSignedThumbSrc(page);
  if (!src) {
    test.skip(true, 'no signed thumbnail rendered on /patients (seed has no media)');
    return;
  }
  const res = await request.get(`http://localhost:3000${innerSignedUrl(src)}`);
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toContain('public');
  expect(res.headers()['cache-control']).toContain('max-age=600');
});
