import { describe, expect, it } from 'vitest';
import { pickFont } from '../fonts';

describe('pickFont — script fallback', () => {
  it('Latin → Noto Sans', () => {
    expect(pickFont('Bruno')).toBe('Noto Sans');
  });
  it('Devanagari → Noto Sans Devanagari', () => {
    expect(pickFont('रॉकी')).toBe('Noto Sans Devanagari');
  });
  it('Gujarati → Noto Sans Gujarati', () => {
    expect(pickFont('કૂतरो')).toBe('Noto Sans Gujarati');
  });
  it('empty / undefined → Noto Sans', () => {
    expect(pickFont('')).toBe('Noto Sans');
    expect(pickFont(null)).toBe('Noto Sans');
  });
});
