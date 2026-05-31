import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { brandMarkSvg } from '../brandmark-svg';

describe('brandMarkSvg', () => {
  it('uses the teal brand color and the paw path', () => {
    const svg = brandMarkSvg(512, false);
    expect(svg).toContain('#0E7C7B');
    expect(svg).toContain('M34 60'); // paw pad path
    expect(svg).toContain('rx="20"'); // rounded for normal icon
  });
  it('maskable variant is full-bleed (no rounded corners)', () => {
    expect(brandMarkSvg(512, true)).toContain('rx="0"');
  });
  it('rasterizes to a valid PNG of the requested size', async () => {
    const png = await sharp(Buffer.from(brandMarkSvg(192, false)))
      .png()
      .toBuffer();
    const meta = await sharp(png).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(192);
  });
});
