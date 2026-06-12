import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { downscaleImage } from '../images';

describe('downscaleImage', () => {
  it('fits within 1000px, outputs JPEG, and reports the output dimensions', async () => {
    const src = await sharp({
      create: { width: 2000, height: 1500, channels: 3, background: { r: 14, g: 124, b: 123 } },
    })
      .png()
      .toBuffer();
    const out = await downscaleImage(src);
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe('jpeg');
    expect(out.width).toBe(meta.width);
    expect(out.height).toBe(meta.height);
    expect(out.width).toBeLessThanOrEqual(1000);
    expect(out.height).toBeLessThanOrEqual(1000);
    expect(out.data.length).toBeLessThan(src.length);
  });
});
