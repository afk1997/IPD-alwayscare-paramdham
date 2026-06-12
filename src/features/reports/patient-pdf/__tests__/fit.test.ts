import { describe, expect, it } from 'vitest';
import { fitWithin } from '../fit';

describe('fitWithin', () => {
  it('scales a landscape image to the width cap', () => {
    expect(fitWithin(1000, 750, 150, 220)).toEqual({ w: 150, h: 112.5 });
  });
  it('scales a tall X-ray to the height cap (no crop)', () => {
    expect(fitWithin(600, 1000, 150, 220)).toEqual({ w: 132, h: 220 });
  });
  it('never upscales a small image', () => {
    expect(fitWithin(80, 60, 150, 220)).toEqual({ w: 80, h: 60 });
  });
  it('falls back to the box for degenerate dimensions', () => {
    expect(fitWithin(0, 0, 150, 220)).toEqual({ w: 150, h: 220 });
  });
});
