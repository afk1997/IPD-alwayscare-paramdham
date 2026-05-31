import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { downscaleImage } from '../images';

describe('downscaleImage', () => {
  it('fits within 1000px and outputs JPEG', async () => {
    const src = await sharp({
      create: { width: 2000, height: 1500, channels: 3, background: { r: 14, g: 124, b: 123 } },
    })
      .png()
      .toBuffer();
    const out = await downscaleImage(src);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width ?? 0).toBeLessThanOrEqual(1000);
    expect(meta.height ?? 0).toBeLessThanOrEqual(1000);
    expect(out.length).toBeLessThan(src.length);
  });
});
