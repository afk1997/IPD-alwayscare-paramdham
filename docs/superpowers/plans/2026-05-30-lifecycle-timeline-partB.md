# Lifecycle Timeline Entries + Record Sheet (Part B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show admission / discharge / death as synthetic, record-sourced entries interleaved into the patient Activity timeline and the Today feed (distinct colors; invalidated ones struck-through), and add a record-detail sheet (logger, reason, attached docs) with SUPER_ADMIN invalidate/re-validate.

**Architecture:** A pure `buildLifecycleEvents(animal)` builder (no `Activity` rows — preserves the `SD-7` count fix). Timeline components receive a separate `lifecycleEvents` prop and merge+sort it with the (optimistically-updated) activities at render. A `LifecycleRecordSheet` shows record detail + docs. Builds on Part A's `invalidatedAt`/`invalidatedById` + the invalidate/re-validate actions.

**Tech Stack:** Next.js 15 App Router (RSC + client), Prisma 5, Vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-05-29-lifecycle-timeline-and-invalidation-design.md` (Part B). Part A is implemented; Part C (full-card drill-downs) is a separate plan.

> Tests: local Postgres only (`postgresql://arham:arham_dev@localhost:5433/arham_ipd`, `STORAGE_DRIVER=local`, `AUTH_SECRET=test-secret-32-bytes-aaaaaaaaaaaaaa`). The builder is a pure function (unit-testable, no DB).

---

### Task 1: `buildLifecycleEvents` builder (pure) + unit test

**Files:**
- Create: `src/features/animals/lifecycle/events.ts`
- Create: `src/features/animals/lifecycle/__tests__/events.test.ts`

- [ ] **Step 1: Write the failing test** — `src/features/animals/lifecycle/__tests__/events.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { type AnimalForEvents, buildLifecycleEvents } from '../events';

const base: AnimalForEvents = {
  admittedAt: new Date('2026-05-26T09:00:00.000Z'),
  complaint: 'Fracture',
  createdBy: { name: 'Asha' },
  deathRecord: null,
  dischargeRecord: null,
};

describe('buildLifecycleEvents', () => {
  it('always emits an admission event', () => {
    const ev = buildLifecycleEvents(base);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ kind: 'admission', detail: 'Fracture', byName: 'Asha', invalidated: false });
    expect(ev[0]?.at).toBe('2026-05-26T09:00:00.000Z');
  });

  it('emits a death event from the record, with invalidation flag + name', () => {
    const ev = buildLifecycleEvents({
      ...base,
      deathRecord: {
        causeOfDeath: 'Cardiac arrest',
        diedAt: new Date('2026-05-28T09:40:00.000Z'),
        recordedBy: { name: 'Dr. Mehta' },
        invalidatedAt: new Date('2026-05-29T10:00:00.000Z'),
        invalidatedBy: { name: 'Boss' },
      },
    });
    const death = ev.find((e) => e.kind === 'death');
    expect(death).toMatchObject({
      detail: 'Cardiac arrest',
      byName: 'Dr. Mehta',
      invalidated: true,
      invalidatedByName: 'Boss',
    });
  });

  it('emits a non-invalidated discharge event', () => {
    const ev = buildLifecycleEvents({
      ...base,
      dischargeRecord: {
        summary: 'Recovered',
        dischargedAt: new Date('2026-05-27T12:00:00.000Z'),
        dischargedBy: { name: 'Dr. Iyer' },
        invalidatedAt: null,
        invalidatedBy: null,
      },
    });
    const d = ev.find((e) => e.kind === 'discharge');
    expect(d).toMatchObject({ detail: 'Recovered', byName: 'Dr. Iyer', invalidated: false, invalidatedByName: null });
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `pnpm test -- src/features/animals/lifecycle/__tests__/events.test.ts` (module missing).

- [ ] **Step 3: Implement `src/features/animals/lifecycle/events.ts`:**
```ts
export interface LifecycleEvent {
  kind: 'admission' | 'discharge' | 'death';
  at: string; // ISO
  detail: string | null;
  byName: string | null;
  invalidated: boolean;
  invalidatedByName: string | null;
}

export interface AnimalForEvents {
  admittedAt: Date;
  complaint: string | null;
  createdBy: { name: string };
  deathRecord: {
    causeOfDeath: string;
    diedAt: Date;
    recordedBy: { name: string };
    invalidatedAt: Date | null;
    invalidatedBy: { name: string } | null;
  } | null;
  dischargeRecord: {
    summary: string;
    dischargedAt: Date;
    dischargedBy: { name: string };
    invalidatedAt: Date | null;
    invalidatedBy: { name: string } | null;
  } | null;
}

// Synthetic, record-sourced lifecycle entries for a patient. NOT Activity rows
// (keeps counts/summaries clean — the SD-7 fix). Death/discharge are sourced
// from the records so they still render (struck-through) after invalidation,
// even though the animal's deceasedAt/dischargedAt get cleared.
export function buildLifecycleEvents(a: AnimalForEvents): LifecycleEvent[] {
  const events: LifecycleEvent[] = [
    {
      kind: 'admission',
      at: a.admittedAt.toISOString(),
      detail: a.complaint,
      byName: a.createdBy.name,
      invalidated: false,
      invalidatedByName: null,
    },
  ];
  if (a.deathRecord) {
    events.push({
      kind: 'death',
      at: a.deathRecord.diedAt.toISOString(),
      detail: a.deathRecord.causeOfDeath,
      byName: a.deathRecord.recordedBy.name,
      invalidated: a.deathRecord.invalidatedAt !== null,
      invalidatedByName: a.deathRecord.invalidatedBy?.name ?? null,
    });
  }
  if (a.dischargeRecord) {
    events.push({
      kind: 'discharge',
      at: a.dischargeRecord.dischargedAt.toISOString(),
      detail: a.dischargeRecord.summary,
      byName: a.dischargeRecord.dischargedBy.name,
      invalidated: a.dischargeRecord.invalidatedAt !== null,
      invalidatedByName: a.dischargeRecord.invalidatedBy?.name ?? null,
    });
  }
  return events;
}
```

- [ ] **Step 4: Run, verify PASS** + `pnpm typecheck`.

- [ ] **Step 5: Commit**
```bash
git add src/features/animals/lifecycle/events.ts src/features/animals/lifecycle/__tests__/events.test.ts
git commit -m "feat(lifecycle): buildLifecycleEvents (synthetic, record-sourced)"
```

---

### Task 2: `getAnimal` includes the record relations; `AnimalDetail` builds events

**Files:**
- Modify: `src/features/animals/queries.ts` (`getAnimal` include)
- Modify: `src/features/animals/components/AnimalDetail.tsx`

- [ ] **Step 1: Extend `getAnimal`.** In `animals/queries.ts`, `getAnimal`'s include currently has (from Part A) `deathRecord: { select: { invalidatedAt: true } }` and `dischargeRecord: { select: { invalidatedAt: true } }`, plus `createdBy: { select: { id: true, name: true } }`. Replace the two record selects with the fuller shape the builder needs:
```ts
      deathRecord: {
        select: {
          causeOfDeath: true,
          diedAt: true,
          invalidatedAt: true,
          recordedBy: { select: { name: true } },
          invalidatedBy: { select: { name: true } },
        },
      },
      dischargeRecord: {
        select: {
          summary: true,
          dischargedAt: true,
          invalidatedAt: true,
          dischargedBy: { select: { name: true } },
          invalidatedBy: { select: { name: true } },
        },
      },
```
(`getAnimal` already selects `complaint` and includes `createdBy` with `name` — confirm; the Animal scalar `complaint` is returned by default since `getAnimal` uses `include` not `select`, and `createdBy` has `name`.)

- [ ] **Step 2: Build events in `AnimalDetail.tsx`.** Import the builder: `import { buildLifecycleEvents } from '@/features/animals/lifecycle/events';`. After the existing data prep, add:
```ts
  const lifecycleEvents = buildLifecycleEvents({
    admittedAt: animal.admittedAt,
    complaint: animal.complaint,
    createdBy: { name: animal.createdBy.name },
    deathRecord: animal.deathRecord
      ? {
          causeOfDeath: animal.deathRecord.causeOfDeath,
          diedAt: animal.deathRecord.diedAt,
          recordedBy: { name: animal.deathRecord.recordedBy.name },
          invalidatedAt: animal.deathRecord.invalidatedAt,
          invalidatedBy: animal.deathRecord.invalidatedBy,
        }
      : null,
    dischargeRecord: animal.dischargeRecord
      ? {
          summary: animal.dischargeRecord.summary,
          dischargedAt: animal.dischargeRecord.dischargedAt,
          dischargedBy: { name: animal.dischargeRecord.dischargedBy.name },
          invalidatedAt: animal.dischargeRecord.invalidatedAt,
          invalidatedBy: animal.dischargeRecord.invalidatedBy,
        }
      : null,
  });
```
Pass `lifecycleEvents={lifecycleEvents}` to `<ActivityTimeline … />`. Also pass `currentUserRole={currentUser?.role}` (the sheet needs to know if the viewer is SUPER_ADMIN) — `currentUser` already exists in this component.

- [ ] **Step 3: Verify** — `pnpm typecheck` (the new fields resolve via the regenerated Prisma client). This task has no rendering yet (the prop is added in Task 3); typecheck-only is fine if `ActivityTimeline`'s props don't yet accept `lifecycleEvents`/`currentUserRole` — to avoid a type error, do Step-3 verification together with Task 3, OR temporarily mark the new props optional in Task 3 first. Recommended: implement Task 3's prop additions, then run typecheck. (Commit Tasks 2+3 together.)

- [ ] **Step 4: Commit** (with Task 3) — see Task 3.

---

### Task 3: `ActivityTimeline` renders the merged union

**Files:**
- Modify: `src/features/activities/components/ActivityTimeline.tsx`

- [ ] **Step 1: Extend `Props` + merge.** Add to `Props`: `lifecycleEvents?: import('@/features/animals/lifecycle/events').LifecycleEvent[]; currentUserRole?: string;`. Destructure with defaults (`lifecycleEvents = []`). Today the component builds `const rows = flattenByDay(activities)` from the `activities` state. Introduce a unified entry type and merge:
```tsx
type TimelineEntry =
  | { kind: 'activity'; at: string; activity: SerializedActivity }
  | { kind: 'lifecycle'; at: string; event: LifecycleEvent };
```
Build a merged, time-sorted list from the (state) `activities` and `lifecycleEvents`, then group by day. Replace the existing `flattenByDay(activities)` usage:
```tsx
  const merged: TimelineEntry[] = [
    ...activities.map((a) => ({ kind: 'activity' as const, at: a.occurredAt, activity: a })),
    ...lifecycleEvents.map((e) => ({ kind: 'lifecycle' as const, at: e.at, event: e })),
  ].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
  const rows = flattenEntriesByDay(merged); // see below
```
Generalize the existing `flattenByDay`/`FlatRow` to operate on `TimelineEntry` (header rows unchanged; the per-item rows carry either an activity or a lifecycle event). Keep the empty-state check based on `activities.length === 0 && lifecycleEvents.length === 0`.

- [ ] **Step 2: Add `LifecycleRow`.** A new render branch for `kind: 'lifecycle'`:
```tsx
const LIFECYCLE_META = {
  admission: { icon: UserPlus, color: '#0E7C7B', label: 'Admitted' },
  discharge: { icon: ArrowRight, color: '#15803D', label: 'Discharged' },
  death: { icon: Skull, color: '#5B6B7A', label: 'Deceased' },
} as const;

function LifecycleRow({ event, onClick }: { event: LifecycleEvent; onClick?: () => void }) {
  const meta = LIFECYCLE_META[event.kind];
  const Icon = meta.icon;
  const body = (
    <div className="flex w-full items-start gap-3 rounded-xl border border-line bg-paper p-3 text-left">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${meta.color}1A`, color: meta.color }}>
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className={`font-display text-[14px] font-bold ${event.invalidated ? 'text-soft line-through' : ''}`}>
            {meta.label}
          </span>
          <span className="text-[11.5px] text-muted">{formatTime(event.at)}</span>
        </div>
        {event.detail && <p className={`mt-1 text-[13px] ${event.invalidated ? 'text-soft line-through' : 'text-text'}`}>{event.detail}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-soft">
          {event.byName && <span>by {event.byName}</span>}
          {event.invalidated && <span className="font-semibold text-observation">· Invalidated{event.invalidatedByName ? ` by ${event.invalidatedByName}` : ''}</span>}
        </div>
      </div>
    </div>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="w-full transition hover:opacity-90">{body}</button>
  ) : (
    <div>{body}</div>
  );
}
```
Imports: add `UserPlus, ArrowRight` to the existing `lucide-react` import (Skull is likely there; add if not). Reuse the existing `formatTime`.

- [ ] **Step 3: Wire the click → sheet.** Admission rows: non-clickable (`onClick` undefined). Death/discharge rows: `onClick={() => setRecordSheet(event)}` where `const [recordSheet, setRecordSheet] = useState<LifecycleEvent | null>(null)`. Render `<LifecycleRecordSheet event={recordSheet} animalId={animalId} currentUserRole={currentUserRole} onClose={() => setRecordSheet(null)} />` near the existing `<ActivitySheet>` (the sheet component is built in Task 4 — for this task, add the state + a placeholder import; Tasks 3+4 commit together).

- [ ] **Step 4: Verify + commit (Tasks 2+3+4 together).** After Task 4's sheet exists: `pnpm typecheck` + `pnpm lint`; manual: open a patient → admission/treatment/etc. interleaved by time; a discharged/deceased patient shows the struck-through lifecycle entry when invalidated.
```bash
git add src/features/animals/queries.ts src/features/animals/components/AnimalDetail.tsx src/features/activities/components/ActivityTimeline.tsx src/features/animals/lifecycle/components/LifecycleRecordSheet.tsx
git commit -m "feat(timeline): interleave lifecycle events into the patient timeline"
```

---

### Task 4: `LifecycleRecordSheet` (detail + docs + invalidate/re-validate)

**Files:**
- Create: `src/features/animals/lifecycle/components/LifecycleRecordSheet.tsx`
- Modify: `src/features/animals/components/AnimalDetail.tsx` (pass the relevant docs down)

- [ ] **Step 1: Pass docs to the timeline → sheet.** `AnimalDetail` already fetches `documents` (with `category`, `kind`, `name`, `fileUrl`, `file`). Compute the lifecycle docs and pass to `ActivityTimeline` as `lifecycleDocs`:
```ts
  const lifecycleDocs = {
    death: documents.filter((d) => d.category === 'DEATH').map(toDocLite),
    discharge: documents.filter((d) => d.category === 'CONSENT').map(toDocLite),
  };
```
where `toDocLite(d)` → `{ id, name, kind: d.kind, url: d.fileUrl, mediaKind: d.file?.kind ?? null }`. Add `lifecycleDocs` to `ActivityTimeline` Props and forward to the sheet.

- [ ] **Step 2: Build the sheet** `src/features/animals/lifecycle/components/LifecycleRecordSheet.tsx`:
```tsx
'use client';
import { Button } from '@/components/ui/Button';
import { Photo } from '@/components/media/Photo';
import { useToast } from '@/components/ui/Toast';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import type { LifecycleEvent } from '../events';
import { invalidateLifecycleAction, revalidateLifecycleAction } from '../actions';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useTransition } from 'react';

export interface LifecycleDocLite {
  id: string;
  name: string;
  kind: string;
  url: string | null;
  mediaKind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC' | null;
}

interface Props {
  event: LifecycleEvent | null; // death | discharge (admission never opens this)
  animalId: string;
  currentUserRole?: string;
  docs: LifecycleDocLite[];
  onClose: () => void;
}

export function LifecycleRecordSheet({ event, animalId, currentUserRole, docs, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, !!event);
  useBodyScrollLock(!!event);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();
  if (!event) return null;
  const isSuper = currentUserRole === 'SUPER_ADMIN';
  const title = event.kind === 'death' ? 'Death record' : 'Discharge record';
  const run = (fn: (id: string) => Promise<{ ok: boolean; error?: string }>, msg: string) => {
    if (!window.confirm(msg)) return;
    start(async () => {
      const r = await fn(animalId);
      showToast({ message: r.ok ? 'Done' : (r.error ?? 'Failed') });
      if (r.ok) { onClose(); router.refresh(); }
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/50" />
      <div ref={dialogRef} className="relative z-10 w-full max-w-md rounded-t-2xl bg-paper p-5 md:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        {event.invalidated && (
          <p className="mb-3 rounded-md bg-paper-2 px-3 py-2 text-[12.5px] text-observation">
            Invalidated{event.invalidatedByName ? ` by ${event.invalidatedByName}` : ''}
          </p>
        )}
        <dl className="flex flex-col gap-2 text-sm">
          <div><dt className="text-muted text-xs">{event.kind === 'death' ? 'Cause of death' : 'Summary'}</dt><dd>{event.detail ?? '—'}</dd></div>
          <div><dt className="text-muted text-xs">Logged by</dt><dd>{event.byName ?? '—'}</dd></div>
        </dl>
        {docs.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 font-semibold text-[12px] text-muted uppercase tracking-wide">Documents</h3>
            <div className="grid grid-cols-4 gap-2">
              {docs.map((d) => (
                <Photo key={d.id} seed={d.id} src={d.url ?? undefined}
                  kind={d.mediaKind === 'VIDEO' ? 'video' : d.mediaKind === 'XRAY' ? 'xray' : d.mediaKind === 'DOC' ? 'doc' : 'photo'}
                  alt={d.name} rounded={10} className="h-16 w-16" sizes="64px" />
              ))}
            </div>
          </div>
        )}
        {isSuper && (
          <div className="mt-5">
            {event.invalidated ? (
              <Button variant="ghost" disabled={pending}
                onClick={() => run(revalidateLifecycleAction, 'Re-validate? This re-declares the patient as deceased/discharged.')}>
                Re-validate
              </Button>
            ) : (
              <Button variant="ghost" disabled={pending}
                onClick={() => run(invalidateLifecycleAction, 'Reopen this case? It returns the patient to Observation; the record is kept but marked invalidated.')}>
                Reopen case
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```
Confirm `useToast`'s `showToast({ message })`, `Photo`'s props, `Button` props, and the hook signatures against existing usage (`ActivitySheet.tsx`); adapt as needed.

- [ ] **Step 3: Wire** the `lifecycleDocs` through `ActivityTimeline` → pick `event.kind === 'death' ? lifecycleDocs.death : lifecycleDocs.discharge` for the sheet's `docs`.

- [ ] **Step 4: Verify + commit** — see Task 3's commit (Tasks 2-4 together): `pnpm typecheck` + `pnpm lint`; manual: click a deceased patient's "Deceased" timeline entry → sheet shows cause, logger, docs; as SUPER_ADMIN, Reopen works; the patient-page button from Part A still works too.

---

### Task 5: Today feed shows lifecycle events

**Files:**
- Modify: `src/features/outcomes/queries.ts` (add `listTodayLifecycleEvents`)
- Modify: `src/features/reports/components/TodayTimeline.tsx` (fetch + pass)
- Modify: `src/features/reports/components/TodayTimelineList.tsx` (render union; lifecycle row → patient page)

- [ ] **Step 1: Today lifecycle query.** In `outcomes/queries.ts`, add (reusing the existing `todayBounds()`):
```ts
export interface TodayLifecycleEvent {
  animalId: string;
  animalName: string;
  kind: 'admission' | 'discharge' | 'death';
  at: string;
  detail: string | null;
}
export async function listTodayLifecycleEvents(): Promise<TodayLifecycleEvent[]> {
  const { start, upper } = todayBounds();
  const [admitted, discharged, deceased] = await Promise.all([
    prisma.animal.findMany({ where: { admittedAt: { gte: start, lte: upper }, deletedAt: null }, select: { id: true, name: true, admittedAt: true, complaint: true } }),
    prisma.dischargeRecord.findMany({ where: { invalidatedAt: null, dischargedAt: { gte: start, lte: upper }, animal: { deletedAt: null } }, select: { animalId: true, summary: true, dischargedAt: true, animal: { select: { name: true } } } }),
    prisma.deathRecord.findMany({ where: { invalidatedAt: null, diedAt: { gte: start, lte: upper }, animal: { deletedAt: null } }, select: { animalId: true, causeOfDeath: true, diedAt: true, animal: { select: { name: true } } } }),
  ]);
  return [
    ...admitted.map((a) => ({ animalId: a.id, animalName: a.name, kind: 'admission' as const, at: a.admittedAt.toISOString(), detail: a.complaint })),
    ...discharged.map((d) => ({ animalId: d.animalId, animalName: d.animal.name, kind: 'discharge' as const, at: d.dischargedAt.toISOString(), detail: d.summary })),
    ...deceased.map((d) => ({ animalId: d.animalId, animalName: d.animal.name, kind: 'death' as const, at: d.diedAt.toISOString(), detail: d.causeOfDeath })),
  ];
}
```
(Valid-only — `invalidatedAt: null` on discharge/death. Admissions have no invalidation.)

- [ ] **Step 2: `TodayTimeline`** — fetch the events and pass them: `const [items, lifecycle] = await Promise.all([listTodayActivities(type), listTodayLifecycleEvents()]);` (when `type` is set, i.e. a tile filter is active, skip lifecycle: pass `[]` so a "surgeries" filter shows only surgery activities). Pass `lifecycleEvents={type ? [] : lifecycle}` to `TodayTimelineList`.

- [ ] **Step 3: `TodayTimelineList`** — add `lifecycleEvents?: TodayLifecycleEvent[]` to Props. Merge with `items` (state) by time, render existing `TodayTimelineRowItem` for activities and a compact lifecycle row for lifecycle events (label + animal name + detail + time, colors from `LIFECYCLE_META`), wrapped in a `<Link href={'/patients/' + e.animalId}>` (navigates, per spec). The empty-state shows only when both are empty.

- [ ] **Step 4: Verify + commit** — `pnpm typecheck` + `pnpm lint`; manual: the Today feed interleaves today's admission/discharge/death with activities; clicking a lifecycle row → patient page; a tile filter (e.g. Deaths) still shows the Part-C drill-down (unaffected).
```bash
git add src/features/outcomes/queries.ts src/features/reports/components/TodayTimeline.tsx src/features/reports/components/TodayTimelineList.tsx
git commit -m "feat(today): interleave today's lifecycle events into the feed"
```

---

### Task 6: Verification sweep

- [ ] **Step 1:** `pnpm typecheck && pnpm lint && pnpm test` → green (incl. the new `events.test.ts`).
- [ ] **Step 2:** Full integration (local DB): `… npx vitest run --config vitest.integration.config.ts` → green.
- [ ] **Step 3:** `pnpm format`; commit any formatting.

---

## Self-Review

**Spec coverage (Part B):** synthetic record-sourced events (Task 1) ✓; patient-timeline interleave + colors + strikethrough (Tasks 2–3) ✓; record-detail sheet with logger/reason/docs + super invalidate/re-validate (Task 4) ✓; Today-feed interleave, clickable → patient (Task 5) ✓; valid-only in the Today lifecycle query, but records drive the patient timeline incl. invalidated (struck) ✓.

**Placeholder scan:** no TBD/TODO; code blocks present; the "confirm API/props" notes are explicit verification steps. The one cross-task sequencing note (Tasks 2–4 commit together because the props/sheet are interdependent) is intentional, not a placeholder.

**Type consistency:** `LifecycleEvent` (Task 1) reused in Tasks 3–4; `AnimalForEvents` shape matches `getAnimal`'s new include (Task 2); `LifecycleDocLite` consistent (Task 4); `TodayLifecycleEvent` consistent (Task 5). `showToast({ message })` matches the API confirmed in Part A.

**Note:** Part C (full-card drill-downs) remains a separate plan after B.
