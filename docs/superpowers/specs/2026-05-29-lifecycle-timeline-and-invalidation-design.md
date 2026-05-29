# Lifecycle Timeline, Invalidate/Re-validate, & Full-Card Drill-downs — Design

- **Date:** 2026-05-29
- **Status:** Draft (awaiting user review)
- **Builds on:** `2026-05-29-outcomes-and-closed-case-lock-design.md` (same branch `feat/outcomes-closed-case-lock`)

## Problem

After the outcomes/closed-case work, three gaps remain:
1. A death or discharge recorded **by mistake** can't be undone (it was an explicit non-goal). Staff need a way to correct it — without losing the record of what happened.
2. Admission, discharge, and death don't appear in the patient's **Activity timeline** or the **Today** feed, so the clinical history is incomplete. (They were deliberately kept out of the `Activity` table by the `SD-7` fix to avoid polluting counts — that constraint must hold.)
3. The dashboard tile drill-downs and the Outcomes register show **minimal rows**, not the rich patient card used on the Patients list.

## Goals

1. **Invalidate / Re-validate** a death or discharge (SUPER_ADMIN), preserving the original record and its attachments.
2. Show **admission / discharge / death as synthetic timeline entries** in the patient Activity tab and the Today feed, interleaved by time with distinct colors.
3. Reuse the real **`PatientCard`** in the Admissions/Deaths/Discharges drill-downs and the Outcomes register, with a cause/summary line for deaths/discharges; clicking → patient page.
4. Keep **cage assignment/release** consistent through invalidate/re-validate.

## Non-goals / hard constraints

- **No deletion** of death/discharge records — invalidation is a reversible flag.
- **No fabricated `Activity` rows** for lifecycle events — they stay synthetic (read-time), so counts/summaries are untouched (preserves `SD-7`).
- **Do not mutate the live Neon data.** All build + tests run against the local throwaway Postgres. The migration is purely **additive** (nullable columns) — it changes no existing data values. The invalidate/re-validate actions are never exercised against real records during development.

---

## Data model change (additive)

Add to **`DeathRecord`** and **`DischargeRecord`**:
```prisma
invalidatedAt   DateTime?
invalidatedById String?
invalidatedBy   User?     @relation("DeathInvalidatedBy" | "DischargeInvalidatedBy", fields: [invalidatedById], references: [id])
```
And the matching back-relations on `User`:
```prisma
invalidatedDeaths     DeathRecord[]     @relation("DeathInvalidatedBy")
invalidatedDischarges DischargeRecord[] @relation("DischargeInvalidatedBy")
```
Migration: hand-author the SQL (`ALTER TABLE "DeathRecord" ADD COLUMN ...` nullable, same for `DischargeRecord`) and apply with `prisma migrate deploy` (the harness can't run `migrate dev`). No data backfill — all existing records have `invalidatedAt = NULL` (valid), which is correct.

---

## Part A — Invalidate / Re-validate

**RBAC:** new action `lifecycle.invalidate` = **`['SUPER_ADMIN']`** (covers both invalidate and re-validate).

**`invalidateLifecycle(actor, animalId)`** (new, in `animals/lifecycle/service.ts`), in a transaction:
- `assertCan(actor, 'lifecycle.invalidate')`.
- Load the animal (must be `DECEASED` or `DISCHARGED`, else `ValidationError`).
- Set the corresponding record's `invalidatedAt = now`, `invalidatedById = actor.id`.
- Set the animal: `status = 'OBSERVATION'`, `deceasedAt = null` / `dischargedAt = null`, `editedAt`/`editedById`. **Leave `cageId` as-is (null) — do not restore the old cage** (it may be occupied; staff reassign normally).
- Audit row: `action 'update'`, `context: { lifecycle: 'invalidate', kind: 'death'|'discharge' }`, before/after status.

**`revalidateLifecycle(actor, animalId)`** (new), in a transaction:
- `assertCan(actor, 'lifecycle.invalidate')`.
- Load the animal; it must currently be active (not already DECEASED/DISCHARGED) and have an **invalidated** record of the kind being re-validated, else `ValidationError`.
- Clear the record's `invalidatedAt`/`invalidatedById`.
- Re-apply the animal: `status = 'DECEASED'`/`'DISCHARGED'`, `deceasedAt`/`dischargedAt = record.diedAt`/`record.dischargedAt` (the original time), `editedAt`/`editedById`. **Release any cage the animal currently holds: `cageId = null`** (mirrors normal death/discharge).
- Audit: `context: { lifecycle: 'revalidate', kind }`.

**Actions** (`animals/lifecycle/actions.ts`): `invalidateLifecycleAction` / `revalidateLifecycleAction` wrap the service, map errors, `revalidatePath` the patient page + dashboard + outcomes, and revalidate the `animals` cache tag.

**Edge cases:** invalidate on an already-active animal → `ValidationError`; re-validate when no invalidated record exists → `ValidationError`; both are no-ops/safe under the unique-cage index (they only null `cageId`).

---

## Part B — Lifecycle events in the timelines

**Builder** (`animals/lifecycle/events.ts`): `buildLifecycleEvents(animal, records)` → `LifecycleEvent[]`, sourced from the **records** (which persist), not from the animal's cleared timestamps:
```ts
interface LifecycleEvent {
  kind: 'admission' | 'discharge' | 'death';
  at: string;           // ISO — admittedAt / dischargedAt / diedAt
  detail: string | null; // complaint / summary / causeOfDeath
  byName: string | null; // createdBy / dischargedBy / recordedBy
  invalidated: boolean;  // discharge/death only
  invalidatedByName: string | null;
}
```
- **Admission:** always present (from `admittedAt` + `complaint` + `createdBy.name`). Non-clickable marker.
- **Discharge / Death:** present iff the record exists (even if invalidated). `invalidated` drives strikethrough + "Invalidated by [name]".

**Patient Activity tab** (`ActivityTimeline`): `AnimalDetail` builds the events and passes a `lifecycleEvents` prop. The component holds `activities` in state (for optimistic updates, unchanged) and at render merges `activities + lifecycleEvents`, sorts by time, groups by day. Renderers: existing `ActivityRow` for activities; new `LifecycleRow` for lifecycle. Colors/icons match the dashboard tiles: admission teal `#0E7C7B`/`UserPlus`, discharge green `#15803D`/`ArrowRight`, death gray `#5B6B7A`/`Skull`. A death/discharge `LifecycleRow` is **clickable → opens the LifecycleRecordSheet** (below); admission rows are non-clickable.

**Today feed** (`TodayTimelineList`): `TodayTimeline` fetches today's lifecycle events (admitted/discharged/deceased today, from the records) and passes them as `lifecycleEvents`. Merged + sorted with today's activities. On the Today feed, a `LifecycleRow` is **clickable → navigates to the patient page** (no sheet there).

**LifecycleRecordSheet** (patient page only): shows the death/discharge record detail — who logged it (`recordedBy`/`dischargedBy`), date, cause/summary, the **attached documents** (the animal's `DEATH`-category docs for a death, `CONSENT`-category for a discharge — these are what the lifecycle flow creates), each rendered via the existing media/`Photo` tiles. If the viewer is **SUPER_ADMIN**: an **Invalidate** button (when valid) or **Re-validate** button (when invalidated), each behind a confirm. The struck-through state + "Invalidated by [name]" is shown at the top.

---

## Part C — Full patient cards in drill-downs

Reuse the existing **`PatientCard`** (it already links to `/patients/[id]` and renders the Deceased/Discharged status badge).

- The today queries (`listTodayAdmissions/Deaths/Discharges`) and register queries (`listDeaths/listDischarges`) return the **`AnimalListItem`** shape `PatientCard` needs (id, name, species, breed, ward, cage, status, contagious, aggressive, admittedAt, lastActivityAt, thumbnailUrl) **plus** an optional `detail` (cause/summary) for deaths/discharges.
- `TodayLifecyclePanel` and `OutcomesTabs` render `<PatientCard animal={...} />` per row; for deaths/discharges, a one-line muted **cause/summary** is shown directly beneath the card. Click anywhere on the card → patient page.
- **Register filters invalidated out:** `listDeaths`/`listDischarges` add `where: { invalidatedAt: null }`. The dashboard counts already exclude invalidated implicitly (invalidate clears the animal's `deceasedAt`/`dischargedAt`, and the counts filter on those timestamps). So the register + counts reflect only *valid* outcomes; invalidated records remain visible on the patient's timeline (struck-through).

---

## Cage invariant (cross-cutting)

A `DECEASED`/`DISCHARGED` animal never holds a cage (existing release-on-close stays). On **invalidate**, the animal returns active with `cageId` null (not restored). On **re-validate**, any currently-held cage is released. Both transitions only ever *null* `cageId`, so they can't trip the unique-cage index.

## Testing (local DB only)

- **Integration:** invalidate a death → animal `OBSERVATION`, `deceasedAt` null, record `invalidatedAt` set, `cageId` null, appears in `listAnimals`, *gone* from `listDeaths`; re-validate → `DECEASED` again, record valid, removed from `listAnimals`, back in `listDeaths`; re-validate releases a held cage. RBAC: only SUPER_ADMIN may invalidate/re-validate (DOCTOR/ADMIN → `RbacError`).
- **Unit:** `buildLifecycleEvents` produces the right entries (admission always; death/discharge when records exist; `invalidated` flag) sorted by time; `lifecycle.invalidate` RBAC matrix.
- **Manual (local server):** timelines interleave lifecycle entries with correct colors + strikethrough; clicking opens the sheet (patient) / navigates (today); drill-downs show full cards + cause line; Reopen flow as a SUPER_ADMIN.

## Open decisions (resolved)

1. Invalidate returns animal to **Observation** (active list), cage **not** restored. ✓
2. Outcomes register + counts reflect **valid records only**; invalidated stays on the patient timeline (struck-through). ✓
3. Lifecycle entries are **synthetic** (record-sourced), never `Activity` rows. ✓
4. Re-validate restores the **original** `diedAt`/`dischargedAt` timestamp. ✓

## Suggested implementation phasing (for the plan)

The plan may sequence as: **A1** schema + migration → **A2** invalidate/re-validate service+actions+RBAC (+ cage rules) → **A3** LifecycleRecordSheet + Reopen UI → **B** lifecycle events in both timelines → **C** full-card drill-downs + register `invalidatedAt` filter. Each phase is independently testable.
