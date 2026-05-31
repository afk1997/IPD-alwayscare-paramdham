import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { brandMarkSvg } from '../src/lib/brandmark-svg';

const ROOT = process.cwd();
const ICONS = join(ROOT, 'public/icons');

async function png(size: number, maskable: boolean, out: string) {
  const buf = await sharp(Buffer.from(brandMarkSvg(size, maskable)))
    .png()
    .toBuffer();
  await sharp(buf).toFile(out);
  console.info('wrote', out);
}

async function main() {
  mkdirSync(ICONS, { recursive: true });
  await png(192, false, join(ICONS, 'icon-192.png'));
  await png(512, false, join(ICONS, 'icon-512.png'));
  await png(512, true, join(ICONS, 'icon-maskable-512.png'));
  await png(180, false, join(ICONS, 'apple-touch-icon.png'));
  await png(512, false, join(ROOT, 'src/app/icon.png'));
  await png(180, false, join(ROOT, 'src/app/apple-icon.png'));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
