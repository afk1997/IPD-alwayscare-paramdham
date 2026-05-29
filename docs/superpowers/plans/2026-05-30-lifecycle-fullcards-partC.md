# Full-Card Drill-downs (Part C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the full `PatientCard` (photo, name, status badge, species, last-update, flags, chevron → patient page) in the Admissions/Deaths/Discharges dashboard drill-downs and the Outcomes register, with a one-line cause/summary beneath for deaths/discharges.

**Architecture:** Extract `PatientCard`'s data shape (`AnimalListItem`) into a reusable `listAnimalCardsByIds(ids)` query (no active-only filters, so it covers deceased/discharged). The today/outcomes panels fetch cards by id and zip them with the existing detail (cause/summary).

**Tech Stack:** Next.js 15 App Router, Prisma 5, Vitest, Biome. Tests: local Postgres only.

**Spec:** `docs/superpowers/specs/2026-05-29-lifecycle-timeline-and-invalidation-design.md` (Part C). Parts A & B are implemented.

---

### Task 1: `listAnimalCardsByIds` (reuses the PatientCard shape)

**Files:**
- Modify: `src/features/animals/queries.ts`
- Test: `src/features/animals/__integration__/animals.test.ts`

- [ ] **Step 1: Write the failing integration test** — append to `animals.test.ts` (it already imports `prisma`, `actorByEmail`, `ADMIN_EMAIL`/`DOCTOR_EMAIL`, `qaName`, `purgeQa`):
```ts
describe('listAnimalCardsByIds', () => {
  it('returns AnimalListItem cards for the given ids, including deceased, in input order', async () => {
    const admin = await actorByEmail(ADMIN_EMAIL);
    const a1 = await prisma.animal.create({ data: { name: qaName('card1'), species: 'Dog', status: 'DECEASED', deceasedAt: new Date(), vaccination: 'NONE', createdById: admin.id } });
    const a2 = await prisma.animal.create({ data: { name: qaName('card2'), species: 'Cat', status: 'OBSERVATION', vaccination: 'NONE', createdById: admin.id } });
    const cards = await listAnimalCardsByIds([a2.id, a1.id]);
    expect(cards.map((c) => c.id)).toEqual([a2.id, a1.id]); // input order preserved
    expect(cards[0]).toMatchObject({ name: expect.stringContaining('__qa__'), species: 'Cat', status: 'OBSERVATION' });
    expect(cards[1]?.status).toBe('DECEASED'); // deceased included
  });

  it('returns [] for no ids and skips soft-deleted', async () => {
    expect(await listAnimalCardsByIds([])).toEqual([]);
    const admin = await actorByEmail(ADMIN_EMAIL);
    const del = await prisma.animal.create({ data: { name: qaName('del'), species: 'Dog', status: 'OBSERVATION', vaccination: 'NONE', createdById: admin.id, deletedAt: new Date() } });
    expect(await listAnimalCardsByIds([del.id])).toEqual([]);
  });
});
```
Add `import { listAnimalCardsByIds } from '../queries';` (merge into the existing queries import if present).

- [ ] **Step 2: Run, verify FAIL** — `… npx vitest run --config vitest.integration.config.ts src/features/animals/__integration__/animals.test.ts` (env from earlier; local DB).

- [ ] **Step 3: Implement** in `src/features/animals/queries.ts`. READ `listAnimals` first. Extract its select + row-mapper into module-level reusables and add `listAnimalCardsByIds`, then refactor `listAnimals` to use them (NO behavior change). Concretely:
```ts
const ANIMAL_CARD_SELECT = {
  id: true,
  name: true,
  species: true,
  breed: true,
  ward: true,
  cage: { select: { name: true } },
  status: true,
  contagious: true,
  aggressive: true,
  admittedAt: true,
  media: {
    take: 1,
    orderBy: { order: 'asc' as const },
    where: { asset: { status: 'READY' as const } },
    select: { asset: { select: { id: true } } },
  },
  activities: {
    take: 1,
    orderBy: { occurredAt: 'desc' as const },
    where: { deletedAt: null },
    select: { occurredAt: true },
  },
} satisfies Prisma.AnimalSelect;

type AnimalCardRow = Prisma.AnimalGetPayload<{ select: typeof ANIMAL_CARD_SELECT }>;

function toAnimalListItem(r: AnimalCardRow): AnimalListItem {
  return {
    id: r.id,
    name: r.name,
    species: r.species,
    breed: r.breed,
    ward: r.ward,
    cage: r.cage?.name ?? null,
    status: r.status,
    contagious: r.contagious,
    aggressive: r.aggressive,
    admittedAt: r.admittedAt,
    lastActivityAt: r.activities[0]?.occurredAt ?? null,
    thumbnailUrl: r.media[0]?.asset.id ? signMediaUrl(r.media[0].asset.id) : null,
  };
}

export async function listAnimalCardsByIds(ids: string[]): Promise<AnimalListItem[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.animal.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: ANIMAL_CARD_SELECT,
  });
  const byId = new Map(rows.map((r) => [r.id, toAnimalListItem(r)]));
  return ids.map((id) => byId.get(id)).filter((x): x is AnimalListItem => x !== undefined);
}
```
Then change `listAnimals` to use `select: ANIMAL_CARD_SELECT` and `return rows.map(toAnimalListItem);` (it currently inlines the same select + map — replace with the shared pieces; keep its `where`/`orderBy`/`take`/`cursor` exactly as-is).

- [ ] **Step 4: Run, verify PASS** — the 2 new tests pass AND the existing animals/patients integration tests stay green (confirms the `listAnimals` refactor didn't change behavior). `pnpm typecheck`.

- [ ] **Step 5: Commit**
```bash
git add src/features/animals/queries.ts src/features/animals/__integration__/animals.test.ts
git commit -m "feat(animals): listAnimalCardsByIds + shared AnimalListItem mapper"
```

---

### Task 2: Today drill-downs render full cards

**Files:**
- Modify: `src/features/reports/components/TodayLifecyclePanel.tsx`

- [ ] **Step 1: Implement.** READ the file (it currently maps `listTodayAdmissions/Deaths/Discharges` rows to minimal `<li>` rows linking to the patient). Change it to fetch full cards and render `PatientCard` + (for death/discharge) a cause/summary line:
```tsx
import { listAnimalCardsByIds } from '@/features/animals/queries';
import { PatientCard } from '@/features/animals/components/PatientCard';
// keep the existing LOADERS / EMPTY maps
export async function TodayLifecyclePanel({ kind }: { kind: keyof typeof LOADERS }) {
  const rows = await LOADERS[kind]();
  if (rows.length === 0) {
    return <p className="rounded-2xl border border-line border-dashed bg-paper p-6 text-center text-muted text-sm">{EMPTY[kind]}</p>;
  }
  const cards = await listAnimalCardsByIds(rows.map((r) => r.id));
  const byId = new Map(cards.map((c) => [c.id, c]));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const card = byId.get(r.id);
        if (!card) return null;
        return (
          <div key={r.id}>
            <PatientCard animal={card} />
            {r.detail && <p className="mt-1 px-3 text-[12.5px] text-muted">{r.detail}</p>}
          </div>
        );
      })}
    </div>
  );
}
```
(`TodayLifecycleRow` has `id` and `detail`; admissions have `detail: null` so no extra line. The query `LOADERS` and `EMPTY` consts stay.)

- [ ] **Step 2: Verify** — `pnpm typecheck` + `pnpm lint`. Manual (local server): dashboard → click Admissions/Deaths/Discharges → full patient cards; deaths/discharges show the cause/summary line; click a card → patient page.

- [ ] **Step 3: Commit**
```bash
git add src/features/reports/components/TodayLifecyclePanel.tsx
git commit -m "feat(today): drill-downs render full PatientCard + cause/summary"
```

---

### Task 3: Outcomes register renders full cards

**Files:**
- Modify: `src/app/(app)/outcomes/page.tsx`
- Modify: `src/features/outcomes/components/OutcomesTabs.tsx`

- [ ] **Step 1: Page fetches cards.** READ `outcomes/page.tsx` (it calls `listDeaths()`/`listDischarges()` and maps to `OutcomeRow[]` for `OutcomesTabs`). Fetch cards for both lists and pass them. After the `Promise.all([listDeaths(), listDischarges()])`:
```ts
  const cardIds = [...deaths.map((d) => d.animalId), ...discharges.map((d) => d.animalId)];
  const cards = await listAnimalCardsByIds(cardIds);
```
(import `listAnimalCardsByIds` from `@/features/animals/queries`.) Pass `cards={cards}` to `<OutcomesTabs … />` alongside the existing `deaths`/`discharges` props (keep those — they carry `animalId` + `detail`/`at`/`byName`).

- [ ] **Step 2: `OutcomesTabs` renders cards.** READ it. Add `cards: AnimalListItem[]` to `Props` (`import type { AnimalListItem } from '@/features/animals/queries';`). Build `const byId = new Map(cards.map((c) => [c.id, c]));`. In the `List`/`Group` rendering, replace the hand-rolled `<li>` with: `PatientCard` (from `@/features/animals/components/PatientCard`) for `byId.get(row.animalId)` + the existing `detail` line beneath. Keep the SegmentedTabs + Today/Earlier grouping. Each row:
```tsx
        {rows.map((r) => {
          const card = byId.get(r.animalId);
          if (!card) return null;
          return (
            <li key={r.animalId}>
              <PatientCard animal={card} />
              <p className="mt-1 px-3 text-[12.5px] text-muted">
                {r.detail} · {formatDateTime(new Date(r.at))} · by {r.byName}
              </p>
            </li>
          );
        })}
```
(Drop the old inline card markup; `PatientCard` is the link now. `formatDateTime` is already imported in this file.)

- [ ] **Step 3: Verify** — `pnpm typecheck` + `pnpm lint`. Manual: `/outcomes` → Deaths/Discharges tabs show full patient cards + a cause/summary·date·by line; click → patient page.

- [ ] **Step 4: Commit**
```bash
git add "src/app/(app)/outcomes/page.tsx" src/features/outcomes/components/OutcomesTabs.tsx
git commit -m "feat(outcomes): register renders full PatientCard + detail"
```

---

### Task 4: Verification sweep

- [ ] **Step 1:** `pnpm typecheck && pnpm lint && pnpm test` → green.
- [ ] **Step 2:** Full integration (local DB): `… npx vitest run --config vitest.integration.config.ts` → green (incl. new `listAnimalCardsByIds` tests + the `listAnimals` refactor unbroken).
- [ ] **Step 3:** `pnpm format`; commit any formatting.

---

## Self-Review

**Spec coverage (Part C):** full `PatientCard` in the dashboard tile drill-downs (Task 2) ✓ and the Outcomes register (Task 3) ✓, with cause/summary line for deaths/discharges ✓; click → patient page (PatientCard is a Link) ✓; reuses `AnimalListItem` via the shared mapper + `listAnimalCardsByIds` (Task 1) ✓.

**Placeholder scan:** no TBD/TODO; complete code in each step.

**Type consistency:** `AnimalListItem` (existing) is the shared shape across Tasks 1–3; `listAnimalCardsByIds(ids: string[]): Promise<AnimalListItem[]>` consistent. `TodayLifecycleRow.id`/`.detail` and `OutcomeRow.animalId`/`.detail`/`.at`/`.byName` match the existing query/types. The `listAnimals` refactor is behavior-preserving (verified by Task 1 Step 4 running the existing integration tests).
