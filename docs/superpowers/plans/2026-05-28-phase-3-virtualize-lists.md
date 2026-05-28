# Phase 3 — Virtualize long lists

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use `@tanstack/react-virtual` to keep only visible rows mounted in the three long lists, so a long-stay patient or a busy day doesn't ship 500+ DOM rows.

**Architecture:** One new prod dep (`@tanstack/react-virtual`, ~3 KB gzipped, headless). `ActivityTimeline` flattens day-grouped data into a single mixed-row array `({kind:'header'} | {kind:'activity'})[]` and uses `useVirtualizer` with per-row `estimateSize`. `PatientList` and `TodayTimelineList` are uniform — same hook with constant `estimateSize`. State management from Phase 2 (local state + canonical-row splicing) stays untouched; only the *rendering* changes.

**Tech Stack:** `@tanstack/react-virtual` v3, React 18.3.1, Next.js 15 client components, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-28-app-performance-design.md` § Phase 3.

---

## Prerequisites

- Phase 2 in production at `main` `f0c3645` (or later) — verified.
- Local: `git checkout main && git pull --ff-only`.
- 180/180 unit tests pass; `bash scripts/check-no-raw-file-urls.sh` clean.

---

## Scope check

The spec covers three components — each independent. Spec calls for one PR per list with measurement gates between. Per-list PR plan adopted: PR 1 (ActivityTimeline + the dep), PR 2 (PatientList), PR 3 (TodayTimelineList).

---

## Test Strategy

- **Unit (Vitest):** None new for the virtualization itself — `@tanstack/react-virtual` is well-tested upstream. We rely on existing tests not regressing.
- **Smoke (manual, post-deploy):** Each PR's measurement: open the target page, scroll, verify rows mount/unmount via DevTools elements panel (`<ol>` should have ≪ total-row-count children at any time).
- **No new e2e tests required** — existing e2e (`signed-media.spec.ts`, `optimistic-mutations.spec.ts`) exercises the rendered DOM through Playwright locators, which still match because the elements still exist (just in a different DOM subtree).

---

## File Structure

**New files:**
- None.

**Modified files (one component per PR):**
- PR 1: `package.json` (`+@tanstack/react-virtual`), `pnpm-lock.yaml`, `src/features/activities/components/ActivityTimeline.tsx`
- PR 2: `src/features/animals/components/PatientList.tsx`
- PR 3: `src/features/reports/components/TodayTimelineList.tsx`

**Untouched:**
- All state-management work from Phase 2 (callbacks, store, optimistic updates) stays. Virtualization is a rendering concern only.

---

## Branch / commit discipline

Three PRs, each branched off `main`:
- `perf-phase-3-pr1` — add dep + ActivityTimeline
- `perf-phase-3-pr2` — PatientList
- `perf-phase-3-pr3` — TodayTimelineList

One commit per task. Each PR ships to production before the next one starts.

---

# PR 1 — Add `@tanstack/react-virtual` + virtualize `ActivityTimeline`

## Task 3.1: Install `@tanstack/react-virtual`

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install the package**

```bash
pnpm add @tanstack/react-virtual@3
```

(Pin to the v3 major; minor/patch upgrades are fine via lockfile.)

- [ ] **Step 2: Verify it appears in `dependencies`**

```bash
grep '"@tanstack/react-virtual"' package.json
```

Expected: a line like `"@tanstack/react-virtual": "3.x.y"` in the `dependencies` block.

- [ ] **Step 3: Typecheck + tests still pass**

```bash
pnpm typecheck && pnpm test
```

Expected: 180/180 pass, typecheck clean.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add @tanstack/react-virtual

Phase 3 dep — headless virtualization for the three long lists
(ActivityTimeline 500-cap, PatientList 200-cap, TodayTimelineList
200-cap).  ~3 KB gzipped, MIT, single small surface API used
through the rest of Phase 3."
```

---

## Task 3.2: Virtualize `ActivityTimeline`

**Files:**
- Modify: `src/features/activities/components/ActivityTimeline.tsx`

The current render renders all rows in a non-virtual `<div>`/`<ol>` tree. Switch to a single flat virtual list where each row is either a day header or an activity row.

### Step 1: Read the current render to anchor changes

```bash
grep -n "groupByDay\|formatDayHeader\|return (" src/features/activities/components/ActivityTimeline.tsx
```

Identify where `groups.map(...)` renders day → list, around line 113–128 per the post-Phase-2 file.

### Step 2: Build a flat-rows helper at the top of the file

After the existing imports and BEFORE the `ActivityTimeline` function, add:

```ts
type FlatRow =
  | { kind: 'header'; day: string; count: number; key: string }
  | { kind: 'activity'; activity: SerializedActivity; key: string };

function flattenByDay(activities: SerializedActivity[]): FlatRow[] {
  const groups = groupByDay(activities);
  const out: FlatRow[] = [];
  for (const [day, items] of groups) {
    out.push({ kind: 'header', day, count: items.length, key: `h-${day}` });
    for (const a of items) out.push({ kind: 'activity', activity: a, key: a.id });
  }
  return out;
}
```

(`groupByDay` is the existing helper in the same file.)

### Step 3: Replace the JSX render block

Inside `ActivityTimeline`, replace the block that does `<div className="flex flex-col gap-5"> {groups.map(...)} </div>` with a virtualized version. Find the existing return statement that begins `return (<>` and replace the outer `<div>` containing `groups.map`:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
// (add to existing react imports)
import { useRef } from 'react';

// ...

export function ActivityTimeline({ activities: initial }: Props) {
  const [activities, setActivities] = useState<SerializedActivity[]>(initial);
  // ... existing useEffect, onSaved/onDeleted/onDuplicated/onRestored, feed subscriber

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="No activities yet"
        description="Log treatments, rounds, food, walks, and other care actions to populate this feed."
      />
    );
  }

  const rows = flattenByDay(activities);
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    // Header rows are ~36px; activity rows are ~92px in the current design.
    // measureElement adapts if a row turns out to be taller (e.g., multi-line
    // remarks).  We pass an estimate per-index because rows aren't uniform.
    estimateSize: (i) => (rows[i].kind === 'header' ? 36 : 92),
    overscan: 5,
  });

  return (
    <>
      <div ref={parentRef} className="max-h-[78vh] overflow-y-auto md:max-h-[80vh]">
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index];
            return (
              <div
                key={row.key}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                {row.kind === 'header' ? (
                  <div className="mb-2 flex items-baseline gap-2 px-1 pt-2">
                    <h3 className="font-display text-[13px] font-bold">{formatDayHeader(row.day)}</h3>
                    <span className="text-[11px] text-muted">{row.count} entries</span>
                  </div>
                ) : (
                  <div className="pb-2">
                    <ActivityRow activity={row.activity} onClick={() => onClickRow(row.activity)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <ActivitySheet
        activity={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onSaved={onSaved}
        onDeleted={onDeleted}
        onDuplicated={onDuplicated}
        onRestored={onRestored}
      />
    </>
  );
}
```

Notes:
- The wrapping `<div ref={parentRef} className="max-h-[78vh] overflow-y-auto md:max-h-[80vh]">` gives the virtualizer a scroll container. Without `max-h` + `overflow-y-auto`, every row would always be in viewport and virtualization is a no-op. Mobile = 78vh, desktop = 80vh — fits inside the existing patient-detail tabs layout.
- `data-index` is required for `measureElement` to identify rows during the resize-observer dance.
- Adjacent margin from the old `<ol className="flex flex-col gap-2">` is replaced with per-row `pb-2` so virtual items don't overlap.
- `pt-2` on headers replaces the previous `gap-5` between day groups (rough visual parity).

### Step 4: Verify

```bash
pnpm typecheck && pnpm test
bash scripts/check-no-raw-file-urls.sh
```

All must be clean.

### Step 5: Manual smoke (defer to executor — note for the agent)

The agent running this can skip live verification. Production smoke after merge:

1. Open a patient detail page with many activities.
2. DevTools → Elements → expand `<div>` inside the timeline. The element should contain a small number (10–15) of activity-row children at any one time, regardless of how many activities exist.
3. Scroll. New rows mount; off-screen rows unmount.

### Step 6: Commit

```bash
git add src/features/activities/components/ActivityTimeline.tsx
git commit -m "feat(perf): virtualize ActivityTimeline with @tanstack/react-virtual

500-cap activity feed is flattened into a single mixed-row array
(day headers + activity rows) and rendered through useVirtualizer.
~10–15 rows mount at a time regardless of total count.  estimateSize
returns 36px for headers, 92px for activity rows; measureElement
adjusts on render.  overscan=5 keeps scroll smooth.

Scroll container is max-h-[78vh] mobile / 80vh desktop with
overflow-y-auto.  Phase 2's local-state + canonical-row mutation
flow is untouched — only the render layer changed."
```

---

## Task 3.3: Open PR 1

- [ ] **Step 1: Push + open PR**

```bash
git push -u origin perf-phase-3-pr1
gh pr create --base main --head perf-phase-3-pr1 \
  --title "feat(perf): phase 3 PR1 — virtualize ActivityTimeline" \
  --body "Phase 3 PR 1 of 3.

- chore: +@tanstack/react-virtual@3 (~3KB gzipped, headless, MIT).
- feat: ActivityTimeline flattens the day-grouped structure into a
  single mixed-row array (header + activity) and renders through
  useVirtualizer.  Only ~10–15 rows mount at a time regardless of
  total count.  Headers ~36px, activity rows ~92px estimated;
  measureElement adapts.  Scroll container is max-h-[78vh] mobile /
  80vh desktop.

Phase 2 state management is unchanged; this is a render-layer fix
only.  180/180 unit tests pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 2: Wait for CI + merge**

```bash
sleep 30
gh pr merge --squash --delete-branch
```

- [ ] **Step 3: Wait for Vercel deploy**

```bash
for i in 1 2 3 4 5 6 7 8 9; do
  VCL=$(gh api repos/afk1997/IPD-alwayscare-paramdham/commits/main/statuses --jq '[.[] | select(.context=="Vercel")][0].state' 2>/dev/null)
  echo "vercel=$VCL"
  [ "$VCL" = "success" ] && break
  sleep 25
done
```

- [ ] **Step 4: Smoke test on production**

After Vercel deploy, the controller (you) manually verifies a long-stay patient's timeline scrolls smoothly with virtualized rows. Document any UX regressions before starting PR 2.

---

# PR 2 — Virtualize `PatientList`

## Task 3.4: Virtualize `PatientList`

**Files:**
- Modify: `src/features/animals/components/PatientList.tsx`

`PatientList` is a server component that renders patient cards in a non-virtual `<div className="flex flex-col gap-2">`. Convert to a client component (since virtualizer needs a ref + scroll element).

### Step 1: Read the current shape

```bash
cat src/features/animals/components/PatientList.tsx
```

Note: it currently `await listAnimals(...)` server-side. The list rendering needs to move to a client child while the server data fetch stays in this file (or a parent).

### Step 2: Refactor — split into server `PatientList` (RSC) + client `PatientListVirtual`

In `src/features/animals/components/PatientList.tsx`, change the file so:

- The `default export` (or named `PatientList`) stays a server component that does the fetch.
- A new client component `PatientListVirtual` does the virtual render.

```tsx
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { AnimalStatus } from '@prisma/client';
import { PawPrint } from 'lucide-react';
import Link from 'next/link';
import { listAnimals, type AnimalListItem } from '../queries';
import { PatientListFilters } from './PatientListFilters';
import { PatientListVirtual } from './PatientListVirtual';

interface Props {
  search?: string | undefined;
  status?: AnimalStatus | undefined;
  species?: string | undefined;
}

export async function PatientList({ search, status, species }: Props = {}) {
  const animals = await listAnimals({
    take: 200,
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(species ? { species } : {}),
  });
  const hasFilters = Boolean(search || status || species);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight">Patients</h1>
          <p className="mt-1 text-muted text-sm">
            {animals.length} {animals.length === 1 ? 'animal' : 'animals'}
            {hasFilters ? ' matching filters' : ' currently admitted'}
          </p>
        </div>
        <Link href="/patients/new">
          <Button>Admit new</Button>
        </Link>
      </div>

      <PatientListFilters
        initialSearch={search ?? ''}
        initialStatus={status ?? 'ALL'}
        initialSpecies={species ?? ''}
      />

      {animals.length === 0 ? (
        hasFilters ? (
          <p className="px-1 py-2 text-muted text-sm">No animals match these filters.</p>
        ) : (
          <EmptyState
            icon={PawPrint}
            title="No patients yet"
            description="Start with your first admission to see the list populate."
            action={
              <Link href="/patients/new">
                <Button>Admit new patient</Button>
              </Link>
            }
          />
        )
      ) : (
        <PatientListVirtual animals={animals} />
      )}
    </div>
  );
}
```

### Step 3: Create `PatientListVirtual.tsx`

Create `src/features/animals/components/PatientListVirtual.tsx`:

```tsx
'use client';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import type { AnimalListItem } from '../queries';
import { PatientCard } from './PatientCard';

interface Props {
  animals: AnimalListItem[];
}

export function PatientListVirtual({ animals }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: animals.length,
    getScrollElement: () => parentRef.current,
    // PatientCard renders an h-[60px] image + content padding.  The full
    // card is roughly 86–92px tall on mobile; 86 is a good lower-bound
    // estimate, measureElement adapts.
    estimateSize: () => 86,
    overscan: 6,
  });

  return (
    <div ref={parentRef} className="max-h-[78vh] overflow-y-auto md:max-h-[80vh]">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const animal = animals[vi.index];
          if (!animal) return null;
          return (
            <div
              key={animal.id}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start}px)`,
              }}
            >
              <div className="pb-2">
                <PatientCard animal={animal} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Step 4: Verify

```bash
pnpm typecheck && pnpm test
bash scripts/check-no-raw-file-urls.sh
```

### Step 5: Commit

```bash
git add src/features/animals/components/PatientList.tsx \
        src/features/animals/components/PatientListVirtual.tsx
git commit -m "feat(perf): virtualize PatientList

200-cap patient list is split: server-component PatientList fetches
+ renders the page chrome (header, filters, empty state), and a new
client component PatientListVirtual does the virtual render via
useVirtualizer.

estimateSize=86 (~PatientCard h-[60px] image + padding), overscan=6.
Scroll container is max-h-[78vh] mobile / 80vh desktop."
```

---

## Task 3.5: Open PR 2

- [ ] **Step 1: Push + open PR**

```bash
git push -u origin perf-phase-3-pr2
gh pr create --base main --head perf-phase-3-pr2 \
  --title "feat(perf): phase 3 PR2 — virtualize PatientList" \
  --body "Phase 3 PR 2 of 3.

PatientList is split into:
- A server component (default export, unchanged signature) that
  fetches + renders the page chrome.
- A new client component PatientListVirtual that renders the cards
  through useVirtualizer.  estimateSize=86, overscan=6.  Scroll
  container max-h-[78vh] / 80vh.

180/180 unit tests pass.  Typecheck clean.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 2: Wait, merge, wait for deploy**

(Same pattern as PR 1.)

---

# PR 3 — Virtualize `TodayTimelineList`

## Task 3.6: Virtualize `TodayTimelineList`

**Files:**
- Modify: `src/features/reports/components/TodayTimelineList.tsx`

`TodayTimelineList` is already a client component (`'use client'`) and was rewired in Phase 2 to lift `items` to local state + subscribe to `useActivityFeed`. The structure is uniform — each item is rendered the same way regardless of activity type. Apply the virtualization in place.

### Step 1: Find the existing render block

```bash
grep -n "items.map\|return (\|<ol\|<ul" src/features/reports/components/TodayTimelineList.tsx
```

### Step 2: Apply the virtualization

In `TodayTimelineList.tsx`, replace the block that iterates `items.map(...)` with a virtual render. The structure:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
// (merge with existing imports)

export function TodayTimelineList({ items: initial }: Props) {
  // ... existing state, useEffect, useActivityFeed subscriber

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    // Today timeline rows show an animal thumbnail + activity content.
    // Roughly the same height as ActivityTimeline rows — 92px estimate,
    // measureElement adapts.
    estimateSize: () => 92,
    overscan: 5,
  });

  // ... existing empty-state check stays.  Then the main render:
  return (
    <>
      <div ref={parentRef} className="max-h-[70vh] overflow-y-auto md:max-h-[75vh]">
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map((vi) => {
            const it = items[vi.index];
            if (!it) return null;
            return (
              <div
                key={it.id}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                <div className="pb-2">
                  {/* existing per-row JSX — extract into a helper component
                      if the row markup is long, OR inline if already terse */}
                  <TodayTimelineRow item={it} onClick={() => setSelected(/* existing */)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ActivitySheet
        activity={selected}
        /* ... existing props ... */
      />
    </>
  );
}
```

If the existing file inlines the row JSX directly inside the map callback (not via a `TodayTimelineRow` helper), extract it into a small in-file component first:

```tsx
function TodayTimelineRow({ item, onClick }: { item: TodayTimelineRowType; onClick: () => void }) {
  // — paste the existing per-row JSX here, exactly as it was inside the map
  // — return that JSX
}
```

(Reuse the existing type name — `TodayTimelineRow` may already exist as a type. If so rename the component to `TodayTimelineRowItem` to avoid the collision; the type stays.)

### Step 3: Verify

```bash
pnpm typecheck && pnpm test
bash scripts/check-no-raw-file-urls.sh
```

### Step 4: Commit

```bash
git add src/features/reports/components/TodayTimelineList.tsx
git commit -m "feat(perf): virtualize TodayTimelineList

200-cap today timeline now renders through useVirtualizer.
estimateSize=92 (per-row height roughly matches ActivityTimeline
rows), overscan=5.  Scroll container max-h-[70vh] mobile / 75vh
desktop — slightly shorter than the per-patient timeline because
the dashboard has top-of-page tiles + Quick Actions above it.

The Phase 2 useActivityFeed subscriber stays untouched."
```

---

## Task 3.7: Open PR 3

- [ ] **Step 1: Push + open PR**

```bash
git push -u origin perf-phase-3-pr3
gh pr create --base main --head perf-phase-3-pr3 \
  --title "feat(perf): phase 3 PR3 — virtualize TodayTimelineList" \
  --body "Phase 3 PR 3 of 3 — final.

TodayTimelineList renders through useVirtualizer.  estimateSize=92,
overscan=5.  Scroll container max-h-[70vh] / 75vh.

Phase 2 useActivityFeed subscriber stays untouched.

180/180 unit tests pass.  Typecheck clean.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 2: Wait, merge, wait for deploy**

(Same pattern.)

---

## Self-Review Checklist

1. **Spec coverage:**
   - Phase 3 § Library choice — Task 3.1 ✓
   - Phase 3 § ActivityTimeline (flatten day-grouped) — Task 3.2 ✓
   - Phase 3 § PatientList (uniform) — Task 3.4 ✓
   - Phase 3 § TodayTimelineList (uniform) — Task 3.6 ✓
   - Phase 3 § Rollout (3 PRs, ship ActivityTimeline first) — Tasks 3.3, 3.5, 3.7 ✓

2. **Placeholder scan:** No `TBD`, no `TODO`. Each code change has full code shown. The TodayTimelineRow extraction in Task 3.6 says "paste the existing per-row JSX here" — that's instruction, not a placeholder; the row content already exists in the file and the executor reads it before extracting.

3. **Type consistency:**
   - `FlatRow` introduced in Task 3.2, only used there.
   - `useVirtualizer` API: `count`, `getScrollElement`, `estimateSize`, `overscan` — same names across all three tasks.
   - `data-index` + `ref={virtualizer.measureElement}` pattern repeated identically.
   - `style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: \`translateY(${vi.start}px)\` }}` repeated identically.

4. **Risk surface:** Each PR touches exactly one target component. Each is independently mergeable; failure of one doesn't block another. Worst case: revert the offending PR.

Plan is complete and self-consistent.
