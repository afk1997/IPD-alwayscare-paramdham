import { getStorage } from '@/lib/storage';
import sharp from 'sharp';
import type { ReportImage } from './fit';

// Downscale + normalise orientation; JPEG keeps the PDF small.
// Returns the bytes plus output dimensions so the renderer can lay the
// COMPLETE image out at its own aspect ratio (never cropped).
export async function downscaleImage(buf: Buffer): Promise<ReportImage> {
  const { data, info } = await sharp(buf)
    .rotate() // honour EXIF orientation
    .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

// Tiny inline concurrency limiter (avoids a p-limit dependency).
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      const item = items[idx];
      if (item !== undefined) await fn(item);
    }
  });
  await Promise.all(workers);
}

// Fetch + downscale every still. A single failure → skipped (renderer shows a
// placeholder); never fails the whole report.
export async function loadReportImages(
  assets: { assetId: string; storageKey: string }[],
): Promise<Map<string, ReportImage>> {
  const out = new Map<string, ReportImage>();
  const storage = getStorage();
  await mapLimit(assets, 4, async (a) => {
    try {
      const { stream } = await storage.getStreamOnly(a.storageKey);
      out.set(a.assetId, await downscaleImage(await streamToBuffer(stream)));
    } catch {
      // skip — placeholder in the PDF
    }
  });
  return out;
}
