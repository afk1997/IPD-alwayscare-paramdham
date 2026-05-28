import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signMediaUrl, verifyMediaUrl } from '../media-sign';

const ASSET = 'clz0a1b2c3d4e5f6g7h8';
const ORIG_SECRET = process.env.AUTH_SECRET;

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-32-bytes-aaaaaaaaaaaa';
});

afterEach(() => {
  // biome-ignore lint/performance/noDelete: process.env assignment would set the string "undefined", not remove the key
  if (ORIG_SECRET === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = ORIG_SECRET;
});

describe('signMediaUrl / verifyMediaUrl', () => {
  it('signs and verifies a roundtrip', () => {
    const url = signMediaUrl(ASSET);
    expect(url).toMatch(/^\/api\/files\/clz0a1b2c3d4e5f6g7h8\?v=orig&sig=[A-Za-z0-9_-]{22}$/);
    const params = new URL(`http://x${url}`).searchParams;
    const v = verifyMediaUrl(ASSET, params);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.variant).toBe('orig');
  });

  it('rejects a tampered signature', () => {
    const url = signMediaUrl(ASSET);
    const params = new URL(`http://x${url}`).searchParams;
    const sig = params.get('sig') ?? '';
    const tampered = sig[0] === 'A' ? `B${sig.slice(1)}` : `A${sig.slice(1)}`;
    params.set('sig', tampered);
    const v = verifyMediaUrl(ASSET, params);
    expect(v.ok).toBe(false);
  });

  it('rejects when the asset id does not match what was signed', () => {
    const url = signMediaUrl(ASSET);
    const params = new URL(`http://x${url}`).searchParams;
    const v = verifyMediaUrl('clxxxxxxxxxxxxxxxxxx', params);
    expect(v.ok).toBe(false);
  });

  it('rejects an unknown variant', () => {
    const url = signMediaUrl(ASSET);
    const params = new URL(`http://x${url}`).searchParams;
    params.set('v', 'thumb');
    const v = verifyMediaUrl(ASSET, params);
    expect(v.ok).toBe(false);
  });

  it('rejects when sig is the wrong length', () => {
    const params = new URLSearchParams({ v: 'orig', sig: 'short' });
    const v = verifyMediaUrl(ASSET, params);
    expect(v.ok).toBe(false);
  });

  it('throws when AUTH_SECRET is missing at sign time', () => {
    // biome-ignore lint/performance/noDelete: process.env assignment would set the string "undefined", not remove the key
    delete process.env.AUTH_SECRET;
    expect(() => signMediaUrl(ASSET)).toThrow(/AUTH_SECRET/);
  });

  it('rejects at verify time when AUTH_SECRET is missing', () => {
    const url = signMediaUrl(ASSET);
    const params = new URL(`http://x${url}`).searchParams;
    // biome-ignore lint/performance/noDelete: process.env assignment would set the string "undefined", not remove the key
    delete process.env.AUTH_SECRET;
    const v = verifyMediaUrl(ASSET, params);
    expect(v.ok).toBe(false);
  });

  it('produces the same URL on repeated calls for the same asset (stable sig)', () => {
    expect(signMediaUrl(ASSET)).toEqual(signMediaUrl(ASSET));
  });
});
