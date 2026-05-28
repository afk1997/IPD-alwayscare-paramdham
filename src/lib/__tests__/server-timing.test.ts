import { describe, expect, it } from 'vitest';
import { createTimings } from '../server-timing';

describe('createTimings', () => {
  it('accumulates marks and emits a Server-Timing header value', () => {
    const t = createTimings();
    t.mark('auth');
    t.mark('db');
    const header = t.header();
    // Marks are absolute ms from start.  Order preserved.  Final
    // `total` mark is always emitted.
    expect(header).toMatch(/^auth;dur=\d+(\.\d+)?,db;dur=\d+(\.\d+)?,total;dur=\d+(\.\d+)?$/);
  });

  it('emits a single total mark when no other marks were taken', () => {
    const t = createTimings();
    expect(t.header()).toMatch(/^total;dur=\d+(\.\d+)?$/);
  });

  it('rejects metric names containing reserved characters', () => {
    const t = createTimings();
    expect(() => t.mark('db query')).toThrow(/invalid metric name/);
    expect(() => t.mark('cache,hit')).toThrow(/invalid metric name/);
    expect(() => t.mark('a;b')).toThrow(/invalid metric name/);
  });

  it('returns strictly non-decreasing durations', () => {
    const t = createTimings();
    t.mark('a');
    t.mark('b');
    t.mark('c');
    const parts = t
      .header()
      .split(',')
      .map((p) => Number(p.split('dur=')[1]));
    parts.reduce((prev, curr) => {
      expect(curr).toBeGreaterThanOrEqual(prev);
      return curr;
    });
  });
});
