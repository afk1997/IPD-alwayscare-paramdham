# Activity Date Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side date filter to the patient Activity tab so staff can narrow a long timeline to a preset window (Today / Last 3 / Last 7 days) or a custom range, while lifecycle markers (Admitted/Discharged/Deceased) stay pinned.

**Architecture:** Pure date-math lives in a new React-free module (`filter.ts`, unit-tested). A small presentational client component (`ActivityDateFilter`) renders the chips + a custom-range popover and emits the selected filter. `ActivityTimeline` holds the filter state, derives the visible activities with `useMemo`, and passes them — together with the **unfiltered** lifecycle events — into the existing `flattenItemsByDay`. No server, query, or schema change.

**Tech Stack:** Next.js (App Router, RSC), React client components, TypeScript, Tailwind, Vitest + Testing Library (unit/component), Playwright (e2e), Biome (lint/format).

**Spec:** `docs/superpowers/specs/2026-05-31-activity-date-filter-design.md`

---

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `src/features/activities/filter.ts` | **Create** | `ActivityFilter` type + pure helpers: `filterBounds`, `filterActivities`, `rangeLabel`, `parseDateInput`, `toDateInputValue`. No React. |
| `src/features/activities/__tests__/filter.test.ts` | **Create** | Unit tests for `filter.ts`. |
| `src/features/activities/components/ActivityDateFilter.tsx` | **Create** | Client component: chip row (`All`/`Today`/`Last 3 days`/`Last 7 days`) + `Custom range` popover with two native date inputs. Emits `ActivityFilter` via `onChange`. |
| `src/features/activities/components/__tests__/ActivityDateFilter.test.tsx` | **Create** | Component tests (Testing Library). |
| `src/features/activities/components/ActivityTimeline.tsx` | **Modify** | Hold filter state, derive `visible`, render `<ActivityDateFilter>` + summary line, filter activities (lifecycle stays unfiltered), add `data-testid="lifecycle-row"`. |
| `src/features/animals/components/AnimalDetail.tsx` | **Modify** | Pass `admittedAt` into `<ActivityTimeline>`. |
| `tests/e2e/activity.spec.ts` | **Modify** | Add e2e: filter narrows the feed + admission stays pinned. |

`ActivityTimeline` is rendered in exactly one place (`AnimalDetail.tsx:185`); no other call site needs the new prop.

---

## Task 1: Pure filter module (`filter.ts`)

**Files:**
- Create: `src/features/activities/filter.ts`
- Test: `src/features/activities/__tests__/filter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/activities/__tests__/filter.test.ts`:

```ts
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
```

> Note: the span separator is an en-dash `–` (U+2013), not a hyphen.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- src/features/activities/__tests__/filter.test.ts`
Expected: FAIL — `Failed to resolve import "../filter"` / functions not defined.

- [ ] **Step 3: Write the implementation**

Create `src/features/activities/filter.ts`:

```ts
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
  const [y, m, d] = s.split('-').map(Number);
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
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const start = fmt(b.start);
  const end = fmt(b.end);
  return start === end ? start : `${start} – ${end}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- src/features/activities/__tests__/filter.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/activities/filter.ts src/features/activities/__tests__/filter.test.ts
git commit -m "feat(activities): add client-side activity date filter helpers"
```

---

## Task 2: Filter control component (`ActivityDateFilter`)

**Files:**
- Create: `src/features/activities/components/ActivityDateFilter.tsx`
- Test: `src/features/activities/components/__tests__/ActivityDateFilter.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/activities/components/__tests__/ActivityDateFilter.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActivityFilter } from '../../filter';
import { ActivityDateFilter } from '../ActivityDateFilter';

function setup(value: ActivityFilter = { kind: 'all' }) {
  const onChange = vi.fn();
  render(
    <ActivityDateFilter value={value} onChange={onChange} minDate="2026-05-01" maxDate="2026-05-15" />,
  );
  return { onChange };
}

describe('ActivityDateFilter', () => {
  it('renders the preset chips and custom-range chip', () => {
    setup();
    for (const name of ['All', 'Today', 'Last 3 days', 'Last 7 days', 'Custom range']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('emits a preset filter when a chip is clicked', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Last 3 days' }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'preset', days: 3 });
  });

  it('emits all when All is clicked', async () => {
    const { onChange } = setup({ kind: 'preset', days: 7 });
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'all' });
  });

  it('opens the popover and emits a custom range on Apply', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Custom range' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-05-10' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-05-12' } });
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'custom', from: '2026-05-10', to: '2026-05-12' });
  });

  it('swaps from/to when entered in reverse', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Custom range' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-05-12' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-05-10' } });
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'custom', from: '2026-05-10', to: '2026-05-12' });
  });

  it('labels the custom chip with the active range', () => {
    setup({ kind: 'custom', from: '2026-05-09', to: '2026-05-12' });
    expect(screen.getByRole('button', { name: '9 May – 12 May' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- src/features/activities/components/__tests__/ActivityDateFilter.test.tsx`
Expected: FAIL — cannot resolve `../ActivityDateFilter`.

- [ ] **Step 3: Write the implementation**

Create `src/features/activities/components/ActivityDateFilter.tsx`:

```tsx
'use client';
import { Input } from '@/components/ui/Input';
import { useState } from 'react';
import { type ActivityFilter, rangeLabel } from '../filter';

interface Props {
  value: ActivityFilter;
  onChange: (f: ActivityFilter) => void;
  minDate: string; // 'YYYY-MM-DD'
  maxDate: string; // 'YYYY-MM-DD'
}

const PRESETS: { label: string; days: 1 | 3 | 7 }[] = [
  { label: 'Today', days: 1 },
  { label: 'Last 3 days', days: 3 },
  { label: 'Last 7 days', days: 7 },
];

function chipClass(active: boolean): string {
  return `rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
    active ? 'border-accent bg-accent text-white' : 'border-line bg-paper text-muted hover:text-text'
  }`;
}

export function ActivityDateFilter({ value, onChange, minDate, maxDate }: Props) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(minDate);
  const [to, setTo] = useState(maxDate);

  const applyCustom = () => {
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    onChange({ kind: 'custom', from: lo, to: hi });
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chipClass(value.kind === 'all')} onClick={() => onChange({ kind: 'all' })}>
          All
        </button>
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            className={chipClass(value.kind === 'preset' && value.days === p.days)}
            onClick={() => onChange({ kind: 'preset', days: p.days })}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={chipClass(value.kind === 'custom')}
          onClick={() => setOpen((o) => !o)}
        >
          {value.kind === 'custom' ? rangeLabel(value, new Date()) : 'Custom range'}
        </button>
      </div>

      {open && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-paper p-3">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
            From
            <Input
              type="date"
              min={minDate}
              max={maxDate}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-auto"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
            To
            <Input
              type="date"
              min={minDate}
              max={maxDate}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-auto"
            />
          </label>
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-2 font-semibold text-sm text-white"
            onClick={applyCustom}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- src/features/activities/components/__tests__/ActivityDateFilter.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/activities/components/ActivityDateFilter.tsx src/features/activities/components/__tests__/ActivityDateFilter.test.tsx
git commit -m "feat(activities): add ActivityDateFilter chip + custom range control"
```

---

## Task 3: Wire the filter into the timeline

**Files:**
- Modify: `src/features/activities/components/ActivityTimeline.tsx`
- Modify: `src/features/animals/components/AnimalDetail.tsx`

This task is behavior-covered by the Task 4 e2e (filtering across a live feed needs real rows + the pinned lifecycle marker). Verification here is typecheck/lint/unit + a manual dev-server check.

- [ ] **Step 1: Add `useMemo` to the React import**

In `src/features/activities/components/ActivityTimeline.tsx`, change:

```ts
import { useEffect, useRef, useState } from 'react';
```

to:

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
```

- [ ] **Step 2: Add the filter + component imports**

Immediately after this existing line:

```ts
import { ActivitySheet, type ActivitySummary } from './ActivitySheet';
```

add:

```ts
import { type ActivityFilter, filterActivities, rangeLabel, toDateInputValue } from '../filter';
import { ActivityDateFilter } from './ActivityDateFilter';
```

- [ ] **Step 3: Add the `admittedAt` prop**

In the `Props` interface, add `admittedAt`:

```ts
interface Props {
  activities: SerializedActivity[];
  animalId: string;
  admittedAt: string;
  caseLocked?: boolean;
  lifecycleEvents?: LifecycleEvent[];
  lifecycleDocs?: { death: LifecycleDocLite[]; discharge: LifecycleDocLite[] };
  currentUserRole?: string | undefined;
}
```

And destructure it in the component signature:

```ts
export function ActivityTimeline({
  activities: initial,
  animalId,
  admittedAt,
  caseLocked,
  lifecycleEvents = [],
  lifecycleDocs = { death: [], discharge: [] },
  currentUserRole,
}: Props) {
```

- [ ] **Step 4: Add filter state, derive visible activities, compute bounds**

Find:

```ts
  const [selected, setSelected] = useState<ActivitySummary | null>(null);
  const [recordEvent, setRecordEvent] = useState<LifecycleEvent | null>(null);

  const rows = flattenItemsByDay(activities, lifecycleEvents);
```

Replace with:

```ts
  const [selected, setSelected] = useState<ActivitySummary | null>(null);
  const [recordEvent, setRecordEvent] = useState<LifecycleEvent | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>({ kind: 'all' });

  const visible = useMemo(() => filterActivities(activities, filter, new Date()), [activities, filter]);
  const rows = flattenItemsByDay(visible, lifecycleEvents);

  // Lower bound for the custom range = the oldest thing in the feed (admission,
  // or an even-older activity if one was back-dated). Never block a day that
  // actually has an entry. Upper bound = today.
  const minDate = toDateInputValue(
    new Date(activities.reduce((m, a) => Math.min(m, Date.parse(a.occurredAt)), Date.parse(admittedAt))),
  );
  const maxDate = toDateInputValue(new Date());
```

- [ ] **Step 5: Render the filter bar + summary line**

Find the start of the main return:

```tsx
  return (
    <>
      <div className="relative">
```

Replace with:

```tsx
  return (
    <>
      {activities.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          <ActivityDateFilter value={filter} onChange={setFilter} minDate={minDate} maxDate={maxDate} />
          {filter.kind !== 'all' && (
            <p className="px-1 text-[11.5px] text-muted">
              {visible.length === 0
                ? `No activity ${rangeLabel(filter, new Date())}`
                : `Showing ${visible.length} of ${activities.length} entries · ${rangeLabel(filter, new Date())}`}{' '}
              ·{' '}
              <button
                type="button"
                className="font-semibold text-accent"
                onClick={() => setFilter({ kind: 'all' })}
              >
                Show all
              </button>
            </p>
          )}
        </div>
      )}
      <div className="relative">
```

- [ ] **Step 6: Add a test id to the lifecycle row**

In the `LifecycleRow` function, find the inner wrapper:

```tsx
    <div className="flex w-full items-start gap-3 rounded-xl border border-line bg-paper p-3 text-left">
```

Replace with:

```tsx
    <div
      data-testid="lifecycle-row"
      className="flex w-full items-start gap-3 rounded-xl border border-line bg-paper p-3 text-left"
    >
```

- [ ] **Step 7: Pass `admittedAt` from `AnimalDetail`**

In `src/features/animals/components/AnimalDetail.tsx`, find:

```tsx
          <ActivityTimeline
            activities={serializedActivities}
            animalId={animal.id}
            caseLocked={caseLocked}
            lifecycleEvents={lifecycleEvents}
            lifecycleDocs={lifecycleDocs}
            currentUserRole={currentUser?.role}
          />
```

Replace with:

```tsx
          <ActivityTimeline
            activities={serializedActivities}
            animalId={animal.id}
            admittedAt={animal.admittedAt.toISOString()}
            caseLocked={caseLocked}
            lifecycleEvents={lifecycleEvents}
            lifecycleDocs={lifecycleDocs}
            currentUserRole={currentUser?.role}
          />
```

- [ ] **Step 8: Typecheck, lint, run the unit suite**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: typecheck clean, lint clean, all unit/component tests pass.

- [ ] **Step 9: Manual dev-server check**

Run: `pnpm db:up` (if the local Postgres isn't already running), then `pnpm dev`.
Open a patient with several days of activity. Verify:
- The chip row appears between the tabs and the feed.
- `Today` / `Last 3 days` / `Last 7 days` narrow the feed; the `Admitted` marker stays visible even when its day is outside the range.
- `Custom range` opens two date inputs bounded to `[oldest entry … today]`; applying shows the summary line `Showing N of M entries · <range>`; `Show all` clears.

- [ ] **Step 10: Commit**

```bash
git add src/features/activities/components/ActivityTimeline.tsx src/features/animals/components/AnimalDetail.tsx
git commit -m "feat(activities): wire date filter into patient activity timeline"
```

---

## Task 4: End-to-end test

**Files:**
- Modify: `tests/e2e/activity.spec.ts`

- [ ] **Step 1: Add the e2e test**

Append to `tests/e2e/activity.spec.ts` (the file already imports `{ expect, test }` and `{ login }`):

```ts
test('date filter narrows the feed and keeps the admission pinned', async ({ page }) => {
  await login(page);

  // Admit a fresh patient (admission timestamp ~ now / today).
  await page.goto('/patients/new');
  await page.getByLabel('Animal name / temporary ID').fill('FilterTest');
  await page.getByLabel('Species').selectOption('Cat');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Chief complaint').fill('Date filter flow');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Admit animal' }).click();
  await page.waitForURL(/\/patients\/[a-z0-9]+$/, { timeout: 30_000 });

  const pad = (n: number) => String(n).padStart(2, '0');
  const dtLocal = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Entry #1 — back-dated 5 days ago.
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  fiveDaysAgo.setHours(10, 0, 0, 0);
  await page.getByRole('button', { name: /log activity/i }).click();
  await page.getByRole('button', { name: /food & water/i }).click();
  await page.getByLabel('Food type').fill('BackdatedFood');
  await page.getByRole('button', { name: 'Fully', exact: true }).click();
  await page.locator('input[type="datetime-local"]').fill(dtLocal(fiveDaysAgo));
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByText('BackdatedFood')).toBeVisible({ timeout: 10_000 });

  // Entry #2 — today (default occurredAt).
  await page.getByRole('button', { name: /log activity/i }).click();
  await page.getByRole('button', { name: /food & water/i }).click();
  await page.getByLabel('Food type').fill('TodayFood');
  await page.getByRole('button', { name: 'Fully', exact: true }).click();
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByText('TodayFood')).toBeVisible({ timeout: 10_000 });

  // Custom range covering 5..4 days ago — includes the back-dated entry,
  // excludes today (so it also excludes the admission, which is ~today).
  const from = new Date();
  from.setDate(from.getDate() - 5);
  const to = new Date();
  to.setDate(to.getDate() - 4);
  await page.getByRole('button', { name: 'Custom range' }).click();
  await page.locator('input[type="date"]').first().fill(dateInput(from));
  await page.locator('input[type="date"]').nth(1).fill(dateInput(to));
  await page.getByRole('button', { name: 'Apply' }).click();

  // Back-dated entry visible; today's entry filtered out.
  await expect(page.getByText('BackdatedFood')).toBeVisible();
  await expect(page.getByText('TodayFood')).toHaveCount(0);
  // Admission is outside the range but pinned, so it stays visible.
  await expect(page.getByTestId('lifecycle-row').filter({ hasText: 'Admitted' })).toBeVisible();

  // Clear → today's entry returns.
  await page.getByRole('button', { name: 'Show all' }).click();
  await expect(page.getByText('TodayFood')).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e test**

Ensure the local DB is seeded (admin creds come from `tests/e2e/helpers.ts`): `pnpm db:up && pnpm db:seed` if not already done. Then:

Run: `pnpm test:e2e -- activity.spec.ts --project=chromium-desktop`
Expected: both tests in the file PASS (Playwright starts/reuses the dev server on :3000).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/activity.spec.ts
git commit -m "test(e2e): cover activity date filter + pinned admission"
```

---

## Task 5: Full verification gate

- [ ] **Step 1: Run every gate**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e -- activity.spec.ts --project=chromium-desktop
```

Expected: all green. If anything fails, fix it and create a follow-up commit (do not amend).

- [ ] **Step 2: Confirm the diff is scoped**

Run: `git diff main --stat`
Expected: only the seven files in the File Structure table (plus the spec from the brainstorming commit) changed. No schema, query, or migration files.

---

## Self-Review

**Spec coverage:**
- Preset chips `All · Today · Last 3 days · Last 7 days · Custom range` → Task 2 component + `PRESETS`.
- "Last N days" = N calendar days incl. today → `filterBounds` preset branch + Task 1 tests.
- Custom range via native date inputs, whole-day inclusive → `ActivityDateFilter` popover + `filterBounds` custom branch + Task 1 inclusive-range test.
- Custom range bounds → Task 3 `minDate`/`maxDate` (refined to oldest-entry floor; **spec §"Custom range bounds" updated to match**).
- Lifecycle pinned → Task 3 passes `lifecycleEvents` unfiltered into `flattenItemsByDay`; Task 4 asserts the pinned `Admitted` row.
- Default All, not remembered → `useState({ kind: 'all' })`, resets on remount.
- Tab badge stays total → untouched (`activeCount` in `AnimalDetailTabs` still uses total length).
- Summary line + empty-in-range note → Task 3 Step 5.
- Filter bar hidden when no activities → `{activities.length > 0 && …}` guard.
- Hydration-safe `en-GB` labels → `rangeLabel` uses fixed locale.
- Tests: unit (`filter.test.ts`), component (`ActivityDateFilter.test.tsx`), e2e (`activity.spec.ts`).

**Placeholder scan:** none — every code/step is concrete.

**Type consistency:** `ActivityFilter` is the single shared type (`filter.ts`), imported by the component and the timeline. `filterActivities(activities, filter, now)`, `rangeLabel(filter, now)`, `filterBounds(filter, now)`, `toDateInputValue(date)`, `parseDateInput(string)` signatures are used identically in tests, component, and timeline.
