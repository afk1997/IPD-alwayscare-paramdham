# Activity Date Filter — Design

- **Date:** 2026-05-31
- **Status:** Draft (awaiting user review)
- **Area:** Patient detail page → Activity tab

## Problem

On a patient's **Activity** tab the feed is grouped by calendar day (Today / Yesterday / `Thu 28 May` …) with no way to narrow it. For a patient admitted 10+ days with multiple entries per day, reaching "day 3" or "day 5" means scrolling past everything newer. Staff need to jump to a day — or a span of days — directly.

## Goals

1. A **date filter** above the feed that restricts the visible `Activity` entries to a chosen range.
2. One-tap **presets** for the common "recent care" lookups, plus a **custom range** for any exact span.
3. Keep the existing day-grouping, real-time updates, and lifecycle markers intact.

## Non-goals / hard constraints

- **No server/query changes.** The timeline is a client component that already receives all activities (≤ `ACTIVITY_FEED_CAP = 500`) as props; filtering is done entirely client-side. No new fetch, no loading state, no pagination change.
- **No data-model / Prisma / migration change.** This is a pure UI feature — it touches no database at all (so the "never mutate live Neon" rule is moot here).
- **Lifecycle markers are never filtered.** Admitted / Discharged / Deceased always render at their natural day position (decision below).
- **`flattenItemsByDay` stays untouched** — we filter the activities array *before* it, and pass lifecycle events through unfiltered.
- **Hydration-safe dates.** All date labels use fixed `en-GB` formatting per the convention documented in `src/lib/time.ts` (mixed locales were a past hydration-bug source).
- **No persistence.** Filter resets to All on every page load and tab switch (the Activity tab unmounts on tab change today; we keep that).

## UX decisions (from brainstorming)

| Decision | Choice |
| --- | --- |
| Filter control | Smart presets + custom range (chips + calendar) |
| Preset chips | `All` · `Today` · `Last 3 days` · `Last 7 days` · `Custom range` |
| "Last N days" meaning | Last **N calendar days including today** (aligns with day-grouped headers) |
| Lifecycle markers under a filter | **Always pinned** — shown regardless of the active range, at their real day position |
| Default | **All**, not remembered |
| Tab badge `Activity N` | Stays the **total** count; the filter is a view, not a redefinition |
| Custom range bounds | `[admission day … today]`, inclusive, whole days only |

## Architecture

Three units. The date math is isolated in a pure, React-free module so it is unit-testable without rendering; the chip bar is a self-contained client component; `ActivityTimeline` wires them together.

### New — `src/features/activities/filter.ts` (pure, no React)

```ts
import type { SerializedActivity } from './serialized';

export type ActivityFilter =
  | { kind: 'all' }
  | { kind: 'preset'; days: 1 | 3 | 7 }        // Today = 1, Last 3 = 3, Last 7 = 7
  | { kind: 'custom'; from: string; to: string }; // 'YYYY-MM-DD', inclusive, from <= to

// Local-time day boundaries (NOT UTC — avoids the `new Date('YYYY-MM-DD')`
// UTC-midnight off-by-one).
function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date): Date   { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function parseDateInput(s: string): Date {           // 'YYYY-MM-DD' -> local midnight
  const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d);
}
export function toDateInputValue(d: Date): string {  // local date -> 'YYYY-MM-DD'
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`;
}

// Inclusive [start, end] ms bounds, or null for 'all' (no filtering).
export function filterBounds(filter: ActivityFilter, now: Date): { start: number; end: number } | null {
  if (filter.kind === 'all') return null;
  if (filter.kind === 'preset') {
    const startDay = new Date(now); startDay.setDate(startDay.getDate() - (filter.days - 1));
    return { start: startOfDay(startDay).getTime(), end: endOfDay(now).getTime() };
  }
  return { start: startOfDay(parseDateInput(filter.from)).getTime(),
           end: endOfDay(parseDateInput(filter.to)).getTime() };
}

export function filterActivities(
  activities: SerializedActivity[], filter: ActivityFilter, now: Date,
): SerializedActivity[] {
  const b = filterBounds(filter, now);
  if (!b) return activities;
  return activities.filter((a) => {
    const t = new Date(a.occurredAt).getTime();
    return t >= b.start && t <= b.end;
  });
}

// Concrete date span derived from `filterBounds` (so presets show real dates,
// not "Last 3 days"). 'all' -> ''; single day -> '31 May'; span -> '29 May – 31 May'.
// Fixed en-GB day/month formatting (hydration-safe).
export function rangeLabel(filter: ActivityFilter, now: Date): string { /* … */ }
```

### New — `src/features/activities/components/ActivityDateFilter.tsx` (`'use client'`)

```ts
interface Props {
  value: ActivityFilter;
  onChange: (f: ActivityFilter) => void;
  minDate: string; // 'YYYY-MM-DD' = admission day
  maxDate: string; // 'YYYY-MM-DD' = today
}
```

- Renders the chip row. Each preset chip sets `{kind:'all'}` / `{kind:'preset',days}`. Active chip is teal-filled (`bg-accent text-white`), matching `SegmentedTabs`.
- The `Custom range` chip toggles a small popover containing two `<Input type="date">` (From / To, the existing `@/components/ui/Input` pattern), each with `min={minDate} max={maxDate}`, plus an **Apply** button that emits `{kind:'custom',from,to}` (guarding `from <= to`, swapping if needed). When a custom range is active, the chip shows `rangeLabel`.
- Pure presentational + local popover open/close state; all selected state lives in the parent.

### Edit — `src/features/activities/components/ActivityTimeline.tsx`

- Add prop `admittedAt: string`.
- `const [filter, setFilter] = useState<ActivityFilter>({ kind: 'all' });`
- `const visible = useMemo(() => filterActivities(activities, filter, new Date()), [activities, filter]);`
- Render `<ActivityDateFilter>` above the feed **only when `activities.length > 0`** (`minDate = toDateInputValue(new Date(admittedAt))`, `maxDate = toDateInputValue(new Date())`).
- `const rows = flattenItemsByDay(visible, lifecycleEvents);` — **`lifecycleEvents` stays unfiltered** ⇒ markers remain pinned at their day.
- Below the chips, when `filter.kind !== 'all'`: a summary line — `Showing {visible.length} of {activities.length} entries · {rangeLabel} · [Show all]` (Show all → `setFilter({kind:'all'})`).
- When `filter.kind !== 'all' && visible.length === 0`: render an inline note `No activity from {from} to {to} · [Show all]` above the rows; pinned lifecycle rows still render beneath it.
- Real-time `useActivityFeed` keeps updating the full `activities` state; a newly created entry only appears if it falls in the active range (consistent — the active chip signals a filter is on).

### Edit — `src/features/animals/components/AnimalDetail.tsx`

Pass `admittedAt={animal.admittedAt.toISOString()}` to `<ActivityTimeline>`.

## Filter semantics (precise)

- **Today** (`days:1`): `startOfDay(today)` … `endOfDay(today)`.
- **Last 3 days** (`days:3`): `startOfDay(today − 2)` … `endOfDay(today)` — i.e. today + 2 prior calendar days.
- **Last 7 days** (`days:7`): `startOfDay(today − 6)` … `endOfDay(today)`.
- **Custom**: `startOfDay(from)` … `endOfDay(to)`, inclusive on both ends.
- Comparison is against `Activity.occurredAt`.

## Edge cases

- **No activities at all:** existing `EmptyState` shows; filter bar hidden.
- **Admitted, zero activities yet** (`activities.length === 0`, lifecycle present): filter bar hidden; lifecycle markers render as today.
- **Range matches zero activities:** inline "No activity from X to Y · Show all"; pinned lifecycle still shown.
- **Open across midnight:** preset bounds use `new Date()` at render; "Today" may be one render stale — negligible, self-corrects on next interaction.
- **`from > to` in custom inputs:** swap before applying.

## Testing

- **Unit — `filter.test.ts`** (pure, no render): each preset covers the right calendar days; custom range inclusive at `00:00` start and `23:59:59.999` end; activity exactly on a boundary is included; `'all'` returns input unchanged; `parseDateInput` has no UTC off-by-one; `from > to` handled.
- **E2E — Playwright:** seed a patient with activities across ≥ 5 days + an admission. Load Activity tab → apply **Last 3 days** → assert older activity rows are gone **and** the `Admitted` marker is still present → apply a **custom range** covering only older days → assert correct rows → click **Show all** → full feed restored. Follows the existing e2e harness (seed → run stack → assert), consistent with the project's validation-before-done practice.

## Out of scope / YAGNI

- Server-side filtering or pagination (client-side over the ≤500 cap is enough).
- Persisting the filter across reloads or tab switches.
- Time-of-day filtering (whole calendar days only).
- Filtering the Documents tab or the global Today feed (this is the patient Activity tab only).
