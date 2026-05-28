import { describe, expect, it } from 'vitest';
import { isStale, relativeTime, startOfISTDay } from '../time';

const NOW = new Date('2026-05-15T12:00:00Z');

describe('relativeTime', () => {
  it('returns — for null', () => {
    expect(relativeTime(null, NOW)).toBe('—');
  });
  it('returns "just now" for <1m', () => {
    const d = new Date(NOW.getTime() - 30 * 1000);
    expect(relativeTime(d, NOW)).toBe('just now');
  });
  it('returns minutes for <1h', () => {
    const d = new Date(NOW.getTime() - 5 * 60 * 1000);
    expect(relativeTime(d, NOW)).toBe('5m ago');
  });
  it('returns hours for <24h', () => {
    const d = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);
    expect(relativeTime(d, NOW)).toBe('3h ago');
  });
  it('returns days for <7d', () => {
    const d = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(relativeTime(d, NOW)).toBe('2d ago');
  });
});

describe('isStale', () => {
  it('returns true for null', () => {
    expect(isStale(null)).toBe(true);
  });
  it('returns false for activity 5h ago', () => {
    const d = new Date(Date.now() - 5 * 60 * 60 * 1000);
    expect(isStale(d, 6)).toBe(false);
  });
  it('returns true for activity 7h ago', () => {
    const d = new Date(Date.now() - 7 * 60 * 60 * 1000);
    expect(isStale(d, 6)).toBe(true);
  });
});

describe('startOfISTDay', () => {
  // Runtime-timezone-independent: asserted via toISOString (UTC), so these pass
  // whether the test process is UTC (CI) or IST (local).
  it('maps a post-midnight-IST instant to that IST day start', () => {
    // 2026-05-28T20:00:00Z = 2026-05-29 01:30 IST → IST day May 29 → 18:30Z
    expect(startOfISTDay(new Date('2026-05-28T20:00:00Z')).toISOString()).toBe('2026-05-28T18:30:00.000Z');
  });
  it('maps a daytime-IST instant to that IST day start', () => {
    // 2026-05-28T10:00:00Z = 15:30 IST May 28 → IST day May 28 → 2026-05-27T18:30Z
    expect(startOfISTDay(new Date('2026-05-28T10:00:00Z')).toISOString()).toBe('2026-05-27T18:30:00.000Z');
  });
  it('is idempotent at exactly IST midnight', () => {
    const istMidnight = new Date('2026-05-27T18:30:00.000Z');
    expect(startOfISTDay(istMidnight).toISOString()).toBe('2026-05-27T18:30:00.000Z');
  });
});
