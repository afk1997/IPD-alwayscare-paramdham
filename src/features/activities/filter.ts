import type { SerializedActivity } from './serialized';

export type ActivityFilter =
  | { kind: 'all' }
  | { kind: 'preset'; days: 1 | 3 | 7 } // Today = 1, Last 3 = 3, Last 7 = 7
  | { kind: 'custom'; from: string; to: string }; // 'YYYY-MM-DD', inclusive

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// 'YYYY-MM-DD' -> local midnight (avoids `new Date('YYYY-MM-DD')` UTC off-by-one).
export function parseDateInput(s: string): Date {
  const parts = s.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(y, m - 1, d);
}

// local Date -> 'YYYY-MM-DD' for <input type="date">.
export function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Inclusive [start, end] ms bounds, or null for 'all' (no filtering).
export function filterBounds(filter: ActivityFilter, now: Date): { start: number; end: number } | null {
  if (filter.kind === 'all') return null;
  if (filter.kind === 'preset') {
    const startDay = new Date(now);
    startDay.setDate(startDay.getDate() - (filter.days - 1));
    return { start: startOfDay(startDay).getTime(), end: endOfDay(now).getTime() };
  }
  return {
    start: startOfDay(parseDateInput(filter.from)).getTime(),
    end: endOfDay(parseDateInput(filter.to)).getTime(),
  };
}

export function filterActivities(
  activities: SerializedActivity[],
  filter: ActivityFilter,
  now: Date,
): SerializedActivity[] {
  const b = filterBounds(filter, now);
  if (!b) return activities;
  return activities.filter((a) => {
    const t = new Date(a.occurredAt).getTime();
    return t >= b.start && t <= b.end;
  });
}

// '' for all; '15 May' for a single day; '13 May – 15 May' for a span.
// Fixed en-GB day/month (hydration-safe, matches lib/time.ts convention).
export function rangeLabel(filter: ActivityFilter, now: Date): string {
  const b = filterBounds(filter, now);
  if (!b) return '';
  const fmt = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const start = fmt(b.start);
  const end = fmt(b.end);
  return start === end ? start : `${start} – ${end}`;
}
