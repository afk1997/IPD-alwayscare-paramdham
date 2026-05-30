import { describe, expect, it } from 'vitest';
import { filterActivities, filterBounds, parseDateInput, rangeLabel, toDateInputValue } from '../filter';
import type { SerializedActivity } from '../serialized';

// 15 May 2026, local noon. Local (not UTC) so it matches startOfDay/endOfDay.
const NOW = new Date(2026, 4, 15, 12, 0, 0);

function act(occurredAt: string): SerializedActivity {
  return {
    id: occurredAt,
    animalId: 'a',
    type: 'FOOD',
    occurredAt,
    byName: 'x',
    remarks: null,
    editedAt: null,
    data: {},
    media: [],
  };
}
// ISO timestamp `daysAgo` days before NOW, at local h:m.
function at(daysAgo: number, h = 12, m = 0): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

describe('filterActivities', () => {
  it('kind=all returns every activity unchanged', () => {
    const items = [act(at(0)), act(at(10))];
    expect(filterActivities(items, { kind: 'all' }, NOW)).toEqual(items);
  });

  it('preset Today (days:1) keeps today, drops yesterday', () => {
    const today = act(at(0));
    const yest = act(at(1));
    expect(filterActivities([today, yest], { kind: 'preset', days: 1 }, NOW)).toEqual([today]);
  });

  it('preset Last 3 days keeps today..2-days-ago, drops 3-days-ago', () => {
    const items = [act(at(0)), act(at(2)), act(at(3))];
    const res = filterActivities(items, { kind: 'preset', days: 3 }, NOW);
    expect(res.map((r) => r.id)).toEqual([at(0), at(2)]);
  });

  it('preset Last 7 days keeps 6-days-ago, drops 7-days-ago', () => {
    const items = [act(at(6)), act(at(7))];
    expect(filterActivities(items, { kind: 'preset', days: 7 }, NOW).map((r) => r.id)).toEqual([at(6)]);
  });

  it('custom range is inclusive of the whole start and end days', () => {
    const inStart = act(new Date(2026, 4, 13, 0, 0, 0, 0).toISOString());
    const inEnd = act(new Date(2026, 4, 14, 23, 59, 59, 999).toISOString());
    const before = act(new Date(2026, 4, 12, 23, 59, 59, 999).toISOString());
    const after = act(new Date(2026, 4, 15, 0, 0, 0, 0).toISOString());
    const res = filterActivities(
      [inStart, inEnd, before, after],
      { kind: 'custom', from: '2026-05-13', to: '2026-05-14' },
      NOW,
    );
    expect(res).toEqual([inStart, inEnd]);
  });
});

describe('filterBounds', () => {
  it('returns null for kind=all (no filtering)', () => {
    expect(filterBounds({ kind: 'all' }, NOW)).toBeNull();
  });

  it('preset Today spans local midnight..end-of-day', () => {
    const b = filterBounds({ kind: 'preset', days: 1 }, NOW);
    expect(b).not.toBeNull();
    const start = new Date((b as { start: number }).start);
    const end = new Date((b as { end: number }).end);
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(15);
    expect(end.getMilliseconds()).toBe(999);
  });
});

describe('parseDateInput / toDateInputValue', () => {
  it('parseDateInput reads YYYY-MM-DD as local date (no UTC off-by-one)', () => {
    const d = parseDateInput('2026-05-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(15);
  });

  it('toDateInputValue formats a local date as YYYY-MM-DD', () => {
    expect(toDateInputValue(new Date(2026, 4, 9))).toBe('2026-05-09');
  });
});

describe('rangeLabel', () => {
  it('is empty for kind=all', () => {
    expect(rangeLabel({ kind: 'all' }, NOW)).toBe('');
  });
  it('shows a single day for Today', () => {
    expect(rangeLabel({ kind: 'preset', days: 1 }, NOW)).toBe('15 May');
  });
  it('shows a span for Last 3 days', () => {
    expect(rangeLabel({ kind: 'preset', days: 3 }, NOW)).toBe('13 May – 15 May');
  });
  it('shows a single day for a custom single-day range', () => {
    expect(rangeLabel({ kind: 'custom', from: '2026-05-09', to: '2026-05-09' }, NOW)).toBe('9 May');
  });
  it('shows a span for a custom multi-day range', () => {
    expect(rangeLabel({ kind: 'custom', from: '2026-05-09', to: '2026-05-12' }, NOW)).toBe('9 May – 12 May');
  });
});
