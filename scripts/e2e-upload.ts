/**
 * Real end-to-end: log in via the running dev server, admit an animal with
 * a 10 MB file uploaded via the resumable / chunked path direct to Google
 * Drive, then verify the file streams back through /api/files/[id] with the
 * expected size (proves the Vercel 4.5 MB request-body limit is bypassed and
 * Drive's chunked upload protocol works end-to-end).
 */
import { createHash, randomBytes } from 'node:crypto';
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'admin@arham.care';
const PASSWORD = process.env.E2E_PASSWORD ?? 'admin1234';

// 10 MiB pseudo-PDF: forces a chunked upload (chunk size = 8 MiB) and is
// well over Vercel's 4.5 MB request-body limit. Deterministic so we can
// check the round-trip byte size matches.
function makeLargePdf(): Buffer {
  const total = 10 * 1024 * 1024;
  const buf = Buffer.alloc(total);
  // Valid-looking PDF magic + version so MIME sniffers are happy.
  buf.write('%PDF-1.4\n', 0);
  // Fill the body with a repeating pattern derived from the index so the
  // bytes aren't all zero (more interesting for hashing).
  for (let i = 9; i < total; i++) buf[i] = i & 0xff;
  return buf;
}

async function main() {
  const LARGE_PDF = makeLargePdf();
  const sentSize = LARGE_PDF.length;
  const sentHash = createHash('sha256').update(LARGE_PDF).digest('hex');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      log(`   [browser ${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => log(`   [browser pageerror] ${err.message}`));
  page.on('requestfailed', (req) => {
    const u = req.url();
    if (u.includes('googleapis.com') || u.includes('/api/files/')) {
      log(`   [browser requestfailed] ${req.method()} ${u} :: ${req.failure()?.errorText}`);
    }
  });

  log('1) Logging in…');
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((u: URL) => !u.pathname.startsWith('/login'), { timeout: 60_000 });

  const name = `DriveE2E-${randomBytes(3).toString('hex')}`;

  log(`2) Admitting animal "${name}" with a ${(sentSize / 1024 / 1024).toFixed(1)} MiB PDF…`);
  await page.goto('/patients/new');
  await page.getByLabel('Animal name / temporary ID').fill(name);
  await page.getByLabel('Species').selectOption('Dog');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Chief complaint').fill('Drive upload e2e test (chunked)');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 4: media — the wizard's resumable client posts to /initiate then
  // PUTs chunks straight to Drive, then calls /finalize. We wait for the
  // finalize response to know the upload is done.
  log('   pushing chunks to Drive…');
  const fileInput = page.locator('input[type=file]').first();
  const finalizePromise = page.waitForResponse(
    (r: { url(): string; request(): { method(): string } }) =>
      r.url().includes('/api/files/finalize') && r.request().method() === 'POST',
    { timeout: 180_000 },
  );
  await fileInput.setInputFiles({
    name: 'e2e-test.pdf',
    mimeType: 'application/pdf',
    buffer: LARGE_PDF,
  });
  const finalizeRes = await finalizePromise;
  if (!finalizeRes.ok()) {
    throw new Error(`finalize returned ${finalizeRes.status()}`);
  }
  const finalizeBody = (await finalizeRes.json()) as { id: string; status: string };
  log(`   finalize ok: assetId=${finalizeBody.id} status=${finalizeBody.status}`);

  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Admit animal' }).click();
  await page.waitForURL(/\/patients\/c[a-z0-9]{20,}$/, { timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 });

  const animalId = new URL(page.url()).pathname.split('/').pop();
  log(`3) Landed on /patients/${animalId}`);

  log('4) Fetching the uploaded file through the proxy…');
  const proxyUrl = `${BASE}/api/files/${finalizeBody.id}`;
  const res = await page.request.get(proxyUrl);
  if (!res.ok()) throw new Error(`proxy returned ${res.status()}`);
  const ct = res.headers()['content-type'] ?? '';
  if (!ct.startsWith('application/pdf')) {
    throw new Error(`unexpected content-type: ${ct}`);
  }
  const body = await res.body();
  const gotHash = createHash('sha256').update(body).digest('hex');
  log(`   sent  size=${sentSize}  sha256=${sentHash}`);
  log(`   got   size=${body.length}  sha256=${gotHash}`);
  if (body.length !== sentSize) throw new Error('round-trip size mismatch');
  if (gotHash !== sentHash) throw new Error('round-trip sha256 mismatch');

  log('PASS — chunked resumable upload + render verified end-to-end.');
  await browser.close();
}

function log(m: string) {
  process.stdout.write(`${m}\n`);
}

main().catch((e) => {
  process.stderr.write(`FAIL: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
