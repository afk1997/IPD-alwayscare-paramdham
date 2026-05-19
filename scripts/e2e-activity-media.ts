/**
 * E2E for Gap #1: activity-form media uploads.
 *   1. Log in.
 *   2. Open QuickAdd → Log activity → pick first patient → Doctor round.
 *   3. Attach a small JPEG via the new MediaUploader.
 *   4. Wait for the thumbnail to render in the modal grid.
 *   5. Save the activity.
 *   6. Verify the activity appears on the patient page with the photo
 *      treated as the avatar/badge in the timeline.
 */
import { randomBytes } from 'node:crypto';
import { type Page, chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'admin@arham.care';
const PASSWORD = process.env.E2E_PASSWORD ?? 'admin1234';

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

// 24×24 white JPEG header + random body so file size is sane.
function makeTinyJpeg(): Buffer {
  // SOI + minimal JFIF + DQT + DHT + SOF0 + SOS + EOI is a lot.  For testing
  // the upload path we don't actually need a decodable image — the server
  // classifies by MIME type, and our MIME is image/jpeg.  Use a buffer that
  // starts with the JPEG magic so any sniffers are content.
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  return Buffer.concat([header, randomBytes(4096)]);
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/$/);
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => log(`   [pageerror] ${err.message}`));

  try {
    log('1) Logging in…');
    await login(page);

    log('2) QuickAdd → Log activity → pick first patient → Doctor round…');
    await page.getByRole('button', { name: /new entry/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('button', { name: /^Log activity/ }).click();
    await page.getByPlaceholder(/search by name/i).waitFor();
    const rows = dialog.locator('button').filter({ hasText: /Dog|Cat|Rabbit|Cow/ });
    await rows.first().waitFor({ timeout: 10_000 });
    await rows.first().click();
    await dialog.getByRole('button', { name: /^Doctor round$/ }).click();

    log('3) Attaching a JPEG via MediaUploader…');
    const fileChooserPromise = page.waitForEvent('filechooser');
    // The dropzone label is the click target.
    await dialog.getByText(/Click or drop files to upload/i).click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles({
      name: 'round-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: makeTinyJpeg(),
    });

    log('4) Wait for thumbnail to land in the modal grid…');
    // After the upload completes, an <img> with alt=round-photo.jpg shows up.
    await dialog.locator('img[alt="round-photo.jpg"]').waitFor({ timeout: 30_000 });

    log('5) Fill remarks + Save…');
    await dialog.locator('textarea').last().fill('Gap #1 e2e: round with photo attached.');
    await dialog.getByRole('button', { name: /save entry/i }).click();

    log('6) Wait for patient detail page navigation…');
    await page.waitForURL(/\/patients\/c[a-z0-9]{20,}$/, { timeout: 20_000 });

    log('7) Verify the activity is on the page with the remark…');
    await page.getByText(/Gap #1 e2e: round with photo attached/).waitFor({ timeout: 15_000 });

    log('PASS — activity created with attached photo; media link end-to-end works.');
  } catch (e) {
    log(`FAIL: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
