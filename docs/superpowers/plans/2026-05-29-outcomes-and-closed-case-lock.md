# Outcomes (Deaths & Discharges) + Closed-Case Lock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Today" tiles drill into today's records, add a read-only Deaths & Discharges register (everyone except STAFF), and freeze closed cases so only SUPER_ADMIN can mutate a deceased/discharged animal or anything attached to it.

**Architecture:** A new `outcome.read` RBAC action + an `assertOpenCase` guard reused across the mutation services. New `features/outcomes` module (queries + page + tabs). The dashboard becomes URL-param driven (`/?show=deaths`). Server enforcement is the security boundary; UI hiding is defense-in-depth.

**Tech Stack:** Next.js 15 App Router (RSC), Prisma 5, Zod, Vitest (unit + integration against local Postgres), Biome.

Spec: `docs/superpowers/specs/2026-05-29-outcomes-and-closed-case-lock-design.md`

> **Local DB for integration tests** (per project workflow): `docker compose up -d postgres`, then run vitest with `DATABASE_URL`/`DIRECT_URL` = `postgresql://arham:arham_dev@localhost:5433/arham_ipd`, `STORAGE_DRIVER=local`, `AUTH_SECRET=test-secret-32-bytes-aaaaaaaaaaaaaa`. Seed first: `… npx tsx prisma/seed.ts`. Never point integration tests at the Neon URL in `.env.local`.

---

### Task 1: RBAC — `outcome.read` action + `assertOpenCase` guard

**Files:**
- Modify: `src/lib/rbac.ts`
- Test: `src/lib/__tests__/rbac.test.ts`

- [ ] **Step 1: Write failing tests** — append to `src/lib/__tests__/rbac.test.ts`:

```ts
import { assertOpenCase } from '../rbac';
import { RbacError } from '../errors';

describe('outcome.read permission', () => {
  it.each(['VIEWER', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'] as const)('allows %s', (role) => {
    expect(can({ id: 'u', role }, 'outcome.read')).toBe(true);
  });
  it('denies STAFF', () => {
    expect(can({ id: 'u', role: 'STAFF' }, 'outcome.read')).toBe(false);
  });
});

describe('assertOpenCase (closed-case lock)', () => {
  it('throws for a non-super actor on a DECEASED animal', () => {
    expect(() => assertOpenCase({ id: 'u', role: 'DOCTOR' }, 'DECEASED')).toThrow(RbacError);
  });
  it('throws for a non-super actor on a DISCHARGED animal', () => {
    expect(() => assertOpenCase({ id: 'u', role: 'ADMIN' }, 'DISCHARGED')).toThrow(RbacError);
  });
  it('allows SUPER_ADMIN on a DECEASED animal', () => {
    expect(() => assertOpenCase({ id: 'u', role: 'SUPER_ADMIN' }, 'DECEASED')).not.toThrow();
  });
  it('allows any role on an open (non-terminal) animal', () => {
    expect(() => assertOpenCase({ id: 'u', role: 'STAFF' }, 'OBSERVATION')).not.toThrow();
    expect(() => assertOpenCase({ id: 'u', role: 'DOCTOR' }, 'CRITICAL')).not.toThrow();
  });
});
```

> Note: `can` is already imported at the top of the existing test file. If not, add it to the existing import from `../rbac`.

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test -- src/lib/__tests__/rbac.test.ts`
Expected: FAIL — `assertOpenCase` is not exported / `outcome.read` not in map.

- [ ] **Step 3: Implement in `src/lib/rbac.ts`** — add `'outcome.read'` to the `Action` union and the `PERMISSIONS` map, and add the guard:

In the `Action` union, add the line:
```ts
  | 'outcome.read'
```

In `PERMISSIONS`, add the entry:
```ts
  'outcome.read': ['VIEWER', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
```

At the end of the file, add:
```ts
// Closed-case finality: once an animal is DECEASED or DISCHARGED, only a
// SUPER_ADMIN may mutate it or anything attached to it. Reused by every
// mutation service that touches an animal.
export function assertOpenCase(actor: Actor, status: string): void {
  if ((status === 'DECEASED' || status === 'DISCHARGED') && actor.role !== 'SUPER_ADMIN') {
    throw new RbacError('closed-case.locked');
  }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test -- src/lib/__tests__/rbac.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rbac.ts src/lib/__tests__/rbac.test.ts
git commit -m "feat(rbac): add outcome.read action + assertOpenCase closed-case guard"
```

---

### Task 2: Apply closed-case lock to animal mutations

**Files:**
- Modify: `src/features/animals/service.ts` (`updateAnimal` ~line 144, `softDeleteAnimal` ~line 265)
- Test: `src/features/animals/__integration__/lifecycle.test.ts`

- [ ] **Step 1: Write failing integration test** — append to `lifecycle.test.ts` (it already imports `prisma`, `actorByEmail`, `qaName`, `purgeQa`, `DOCTOR_EMAIL`; mirror its existing setup):

```ts
describe('closed-case lock — animal mutations', () => {
  it('DOCTOR cannot edit a DECEASED animal', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await prisma.animal.create({
      data: {
        name: qaName('locked'),
        species: 'Dog',
        status: 'DECEASED',
        deceasedAt: new Date(),
        vaccination: 'NONE',
        createdById: doctor.id,
      },
    });
    await expect(
      updateAnimal(doctor, animal.id, { name: qaName('hacked') }),
    ).rejects.toBeInstanceOf(RbacError);
  });
});
```

Add imports at the top if missing: `import { updateAnimal } from '../service';` and `import { RbacError } from '@/lib/errors';`.

- [ ] **Step 2: Run, verify fail**

Run: `docker compose up -d postgres` then (with the local-DB env from the header) `… npx vitest run --config vitest.integration.config.ts src/features/animals/__integration__/lifecycle.test.ts`
Expected: FAIL — the edit currently succeeds (no lock), so `rejects` is unmet.

- [ ] **Step 3: Implement** — in `src/features/animals/service.ts`:

Add to the import from `@/lib/rbac`: `assertOpenCase`. The line becomes:
```ts
import { type Actor, assertCan, assertOpenCase } from '@/lib/rbac';
```

In `updateAnimal`, immediately after the `if (!before) throw new NotFoundError(...)` line, add:
```ts
  // Closed-case lock: a deceased/discharged animal is frozen to SUPER_ADMIN.
  assertOpenCase(actor, before.status);
```

In `softDeleteAnimal`, after its `if (!before) throw new NotFoundError(...)` and before the existing `if (before.deletedAt) return before;`, add the same line:
```ts
  assertOpenCase(actor, before.status);
```

- [ ] **Step 4: Run, verify pass**

Run: `… npx vitest run --config vitest.integration.config.ts src/features/animals/__integration__/lifecycle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/animals/service.ts src/features/animals/__integration__/lifecycle.test.ts
git commit -m "feat: freeze animal edits/deletes on closed cases (super-admin only)"
```

---

### Task 3: Apply closed-case lock to activity mutations

**Files:**
- Modify: `src/features/activities/service.ts` (`createActivity` ~31, `updateActivity` ~83, `softDeleteActivity` ~176, `duplicateActivity` ~146)
- Test: `src/features/activities/__integration__/activities.test.ts`

- [ ] **Step 1: Write failing integration test** — append to `activities.test.ts`:

```ts
describe('closed-case lock — activity mutations', () => {
  it('DOCTOR cannot add an activity to a DISCHARGED animal', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL); // { id, role, name }
    const animal = await prisma.animal.create({
      data: {
        name: qaName('closed-act'),
        species: 'Cat',
        status: 'DISCHARGED',
        dischargedAt: new Date(),
        vaccination: 'NONE',
        createdById: doctor.id,
      },
    });
    await expect(
      createActivity(doctor, {
        animalId: animal.id,
        type: 'FOOD',
        byName: doctor.name,
        data: { foodType: 'kibble', intake: 'Fully' },
        mediaAssetIds: [],
      }),
    ).rejects.toBeInstanceOf(RbacError);
  });
});
```

Ensure imports exist: `import { createActivity } from '../service';`, `import { RbacError } from '@/lib/errors';`, and `DOCTOR_EMAIL`, `qaName`, `prisma` (the file already uses these per its existing tests).

- [ ] **Step 2: Run, verify fail**

Run: `… npx vitest run --config vitest.integration.config.ts src/features/activities/__integration__/activities.test.ts`
Expected: FAIL — create currently succeeds (the animal-exists check doesn't look at status).

- [ ] **Step 3: Implement** — in `src/features/activities/service.ts`:

Add `assertOpenCase` to the `@/lib/rbac` import:
```ts
import { type Actor, assertCan, assertOpenCase, can } from '@/lib/rbac';
```

**createActivity** — change the animal lookup to also select `status`, then assert. Replace:
```ts
  const animal = await prisma.animal.findFirst({
    where: { id: parsed.animalId, deletedAt: null },
    select: { id: true },
  });
  if (!animal) throw new NotFoundError('Animal', parsed.animalId);
```
with:
```ts
  const animal = await prisma.animal.findFirst({
    where: { id: parsed.animalId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!animal) throw new NotFoundError('Animal', parsed.animalId);
  assertOpenCase(actor, animal.status);
```

**updateActivity** — change the `before` lookup to include the animal status, then assert. Replace:
```ts
  const before = await prisma.activity.findFirst({
    where: { id: activityId, deletedAt: null, animal: { deletedAt: null } },
  });
  if (!before) throw new NotFoundError('Activity', activityId);
```
with:
```ts
  const before = await prisma.activity.findFirst({
    where: { id: activityId, deletedAt: null, animal: { deletedAt: null } },
    include: { animal: { select: { status: true } } },
  });
  if (!before) throw new NotFoundError('Activity', activityId);
  assertOpenCase(actor, before.animal.status);
```

**softDeleteActivity** — change the lookup to include animal status and assert after the existing not-found / already-deleted checks. Replace:
```ts
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { media: { include: { asset: true } } },
  });
  if (!activity) throw new NotFoundError('Activity', activityId);
  if (activity.deletedAt) return activity;
```
with:
```ts
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { media: { include: { asset: true } }, animal: { select: { status: true } } },
  });
  if (!activity) throw new NotFoundError('Activity', activityId);
  if (activity.deletedAt) return activity;
  assertOpenCase(actor, activity.animal.status);
```

**duplicateActivity** — the lookup (from the prior soft-delete-guard work) is a `findFirst` with the animal join; add status + assert. Replace:
```ts
  const original = await prisma.activity.findFirst({
    where: { id: activityId, deletedAt: null, animal: { deletedAt: null } },
  });
  if (!original) throw new NotFoundError('Activity', activityId);
  assertCan(actor, requiredAction(original.type) as 'activity.create' | 'activity.create.clinical');
```
with:
```ts
  const original = await prisma.activity.findFirst({
    where: { id: activityId, deletedAt: null, animal: { deletedAt: null } },
    include: { animal: { select: { status: true } } },
  });
  if (!original) throw new NotFoundError('Activity', activityId);
  assertCan(actor, requiredAction(original.type) as 'activity.create' | 'activity.create.clinical');
  assertOpenCase(actor, original.animal.status);
```

> `softDeleteActivity`'s `actor` is typed `Actor` (no name) — `assertOpenCase(actor, ...)` only needs `actor.role`, so this is fine.

- [ ] **Step 4: Run, verify pass**

Run: `… npx vitest run --config vitest.integration.config.ts src/features/activities/__integration__/activities.test.ts`
Expected: PASS (all existing activity tests still green too).

- [ ] **Step 5: Commit**

```bash
git add src/features/activities/service.ts src/features/activities/__integration__/activities.test.ts
git commit -m "feat: freeze activity create/edit/delete/duplicate on closed cases"
```

---

### Task 4: Apply closed-case lock to document + media mutations

**Files:**
- Modify: `src/features/documents/service.ts` (`createDocument` ~9, `softDeleteDocument` ~48, `restoreDocument` ~103)
- Modify: `src/features/media/service.ts` (`initiateUpload` ~39, the activity/document branch ~71)
- Test: `src/features/documents/__integration__/documents.test.ts`

- [ ] **Step 1: Write failing integration test** — append to `documents.test.ts`:

```ts
describe('closed-case lock — documents', () => {
  it('DOCTOR cannot add a document to a DECEASED animal', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await prisma.animal.create({
      data: {
        name: qaName('closed-doc'),
        species: 'Dog',
        status: 'DECEASED',
        deceasedAt: new Date(),
        vaccination: 'NONE',
        createdById: doctor.id,
      },
    });
    const asset = await prisma.mediaAsset.create({
      data: {
        kind: 'DOC',
        filename: qaName('f') + '.pdf',
        mimeType: 'application/pdf',
        size: 10,
        storageKey: `local:${qaName('k')}.pdf`,
        status: 'READY',
        uploadedById: doctor.id,
      },
    });
    await expect(
      createDocument(doctor, {
        animalId: animal.id,
        category: 'MEDICAL',
        kind: 'Report',
        name: qaName('doc'),
        fileId: asset.id,
      }),
    ).rejects.toBeInstanceOf(RbacError);
  });
});
```

Ensure imports: `import { createDocument } from '../service';`, `RbacError`, `DOCTOR_EMAIL`, `qaName`, `prisma`.

- [ ] **Step 2: Run, verify fail**

Run: `… npx vitest run --config vitest.integration.config.ts src/features/documents/__integration__/documents.test.ts`
Expected: FAIL — create currently succeeds.

- [ ] **Step 3: Implement**

In `src/features/documents/service.ts`, add to the `@/lib/rbac` import: `assertOpenCase`.

**createDocument** — change the animal lookup + assert. Replace:
```ts
  const animal = await prisma.animal.findFirst({
    where: { id: parsed.animalId, deletedAt: null },
    select: { id: true },
  });
  if (!animal) throw new NotFoundError('Animal', parsed.animalId);
```
with:
```ts
  const animal = await prisma.animal.findFirst({
    where: { id: parsed.animalId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!animal) throw new NotFoundError('Animal', parsed.animalId);
  assertOpenCase(actor, animal.status);
```

**softDeleteDocument** — its `doc` lookup is `findFirst({ where: { id, deletedAt: null }, include: { file: {...} } })`. Add `animal: { select: { status: true } }` to the include and assert after the not-found check:
```ts
  const doc = await prisma.document.findFirst({
    where: { id: documentId, deletedAt: null },
    include: {
      file: { select: { id: true, storageKey: true, filename: true } },
      animal: { select: { status: true } },
    },
  });
  if (!doc) throw new NotFoundError('Document', documentId);
  assertOpenCase(actor, doc.animal.status);
```

**restoreDocument** — its lookup already includes `animal: { select: { deletedAt: true } }` (from the orphan-guard work). Extend the select to `{ deletedAt: true, status: true }` and add the assert after the existing `doc.animal.deletedAt` guard:
```ts
  if (doc.animal.deletedAt) {
    throw new ValidationError('Restore the patient first — this document belongs to a deleted patient');
  }
  assertOpenCase(actor, doc.animal.status);
```

In `src/features/media/service.ts`, add `assertOpenCase` to the `@/lib/rbac` import. In `initiateUpload`, the non-staging branch fetches the animal; change its select + assert. Replace:
```ts
    const animal = await prisma.animal.findUnique({
      where: { id: input.context.animalId },
      select: { id: true, name: true },
    });
    if (!animal) throw new NotFoundError('Animal', input.context.animalId);
```
with:
```ts
    const animal = await prisma.animal.findUnique({
      where: { id: input.context.animalId },
      select: { id: true, name: true, status: true },
    });
    if (!animal) throw new NotFoundError('Animal', input.context.animalId);
    assertOpenCase(actor, animal.status);
```

- [ ] **Step 4: Run, verify pass**

Run: `… npx vitest run --config vitest.integration.config.ts src/features/documents/__integration__/documents.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/documents/service.ts src/features/media/service.ts src/features/documents/__integration__/documents.test.ts
git commit -m "feat: freeze document/media writes on closed cases"
```

---

### Task 5: Outcomes queries (register + today lists)

**Files:**
- Create: `src/features/outcomes/queries.ts`
- Test: `src/features/outcomes/__integration__/outcomes.test.ts`

- [ ] **Step 1: Write failing integration test** — create `src/features/outcomes/__integration__/outcomes.test.ts`:

```ts
import { prisma } from '@/lib/prisma';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actorByEmail, ADMIN_EMAIL, purgeQa, qaName } from '@/lib/__integration__/helpers';
import { listDeaths, listTodayDeaths } from '../queries';

describe('outcomes queries', () => {
  let animalId: string;
  beforeAll(async () => {
    await purgeQa();
    const admin = await actorByEmail(ADMIN_EMAIL);
    const animal = await prisma.animal.create({
      data: {
        name: qaName('dead'),
        species: 'Dog',
        status: 'DECEASED',
        deceasedAt: new Date(),
        vaccination: 'NONE',
        createdById: admin.id,
        deathRecord: {
          create: { causeOfDeath: qaName('cause'), diedAt: new Date(), recordedById: admin.id },
        },
      },
    });
    animalId = animal.id;
  });
  afterAll(purgeQa);

  it('listDeaths returns the deceased animal with its cause + recorder', async () => {
    const rows = await listDeaths();
    const row = rows.find((r) => r.animalId === animalId);
    expect(row).toBeTruthy();
    expect(row?.animalName).toContain('__qa__');
    expect(row?.causeOfDeath).toContain('__qa__');
    expect(row?.recordedByName).toBeTruthy();
  });

  it('listTodayDeaths includes a death recorded today', async () => {
    const rows = await listTodayDeaths();
    expect(rows.some((r) => r.animalId === animalId)).toBe(true);
  });

  it('excludes a soft-deleted animal', async () => {
    await prisma.animal.update({ where: { id: animalId }, data: { deletedAt: new Date() } });
    const rows = await listDeaths();
    expect(rows.some((r) => r.animalId === animalId)).toBe(false);
    await prisma.animal.update({ where: { id: animalId }, data: { deletedAt: null } });
  });
});
```

> `purgeQa` already deletes DeathRecords for `__qa__` animals before deleting the animals.

- [ ] **Step 2: Run, verify fail**

Run: `… npx vitest run --config vitest.integration.config.ts src/features/outcomes/__integration__/outcomes.test.ts`
Expected: FAIL — `../queries` does not exist.

- [ ] **Step 3: Implement `src/features/outcomes/queries.ts`:**

```ts
import { prisma } from '@/lib/prisma';

const REGISTER_CAP = 100;

function todayBounds(): { start: Date; upper: Date } {
  const now = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0); // IST midnight (server runtime is pinned to Asia/Kolkata)
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, upper: now < end ? now : end };
}

export interface DeathRow {
  animalId: string;
  animalName: string;
  animalSpecies: string;
  causeOfDeath: string;
  diedAt: Date;
  recordedByName: string;
}

export interface DischargeRow {
  animalId: string;
  animalName: string;
  animalSpecies: string;
  summary: string;
  dischargedAt: Date;
  dischargedByName: string;
}

export async function listDeaths(): Promise<DeathRow[]> {
  const rows = await prisma.deathRecord.findMany({
    where: { animal: { deletedAt: null } },
    orderBy: { diedAt: 'desc' },
    take: REGISTER_CAP,
    select: {
      animalId: true,
      causeOfDeath: true,
      diedAt: true,
      recordedBy: { select: { name: true } },
      animal: { select: { name: true, species: true } },
    },
  });
  return rows.map((r) => ({
    animalId: r.animalId,
    animalName: r.animal.name,
    animalSpecies: r.animal.species,
    causeOfDeath: r.causeOfDeath,
    diedAt: r.diedAt,
    recordedByName: r.recordedBy.name,
  }));
}

export async function listDischarges(): Promise<DischargeRow[]> {
  const rows = await prisma.dischargeRecord.findMany({
    where: { animal: { deletedAt: null } },
    orderBy: { dischargedAt: 'desc' },
    take: REGISTER_CAP,
    select: {
      animalId: true,
      summary: true,
      dischargedAt: true,
      dischargedBy: { select: { name: true } },
      animal: { select: { name: true, species: true } },
    },
  });
  return rows.map((r) => ({
    animalId: r.animalId,
    animalName: r.animal.name,
    animalSpecies: r.animal.species,
    summary: r.summary,
    dischargedAt: r.dischargedAt,
    dischargedByName: r.dischargedBy.name,
  }));
}

export interface TodayLifecycleRow {
  id: string;
  name: string;
  species: string;
  at: Date;
  detail: string | null; // cause (death) / summary (discharge) / null (admission)
  byName: string | null;
}

export async function listTodayDeaths(): Promise<TodayLifecycleRow[]> {
  const { start, upper } = todayBounds();
  const rows = await prisma.animal.findMany({
    where: { deceasedAt: { gte: start, lte: upper }, deletedAt: null },
    orderBy: { deceasedAt: 'desc' },
    select: {
      id: true,
      name: true,
      species: true,
      deceasedAt: true,
      deathRecord: { select: { causeOfDeath: true, recordedBy: { select: { name: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    species: r.species,
    at: r.deceasedAt as Date,
    detail: r.deathRecord?.causeOfDeath ?? null,
    byName: r.deathRecord?.recordedBy.name ?? null,
  }));
}

export async function listTodayDischarges(): Promise<TodayLifecycleRow[]> {
  const { start, upper } = todayBounds();
  const rows = await prisma.animal.findMany({
    where: { dischargedAt: { gte: start, lte: upper }, deletedAt: null },
    orderBy: { dischargedAt: 'desc' },
    select: {
      id: true,
      name: true,
      species: true,
      dischargedAt: true,
      dischargeRecord: { select: { summary: true, dischargedBy: { select: { name: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    species: r.species,
    at: r.dischargedAt as Date,
    detail: r.dischargeRecord?.summary ?? null,
    byName: r.dischargeRecord?.dischargedBy.name ?? null,
  }));
}

export async function listTodayAdmissions(): Promise<TodayLifecycleRow[]> {
  const { start, upper } = todayBounds();
  const rows = await prisma.animal.findMany({
    where: { admittedAt: { gte: start, lte: upper }, deletedAt: null },
    orderBy: { admittedAt: 'desc' },
    select: { id: true, name: true, species: true, admittedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    species: r.species,
    at: r.admittedAt,
    detail: null,
    byName: null,
  }));
}
```

- [ ] **Step 4: Run, verify pass**

Run: `… npx vitest run --config vitest.integration.config.ts src/features/outcomes/__integration__/outcomes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/outcomes/queries.ts src/features/outcomes/__integration__/outcomes.test.ts
git commit -m "feat(outcomes): register + today-lifecycle queries"
```

---

### Task 6: `/outcomes` page + guard + tabs + nav

**Files:**
- Modify: `src/lib/auth.ts` (add `requireOutcomeReadRole`)
- Create: `src/app/(app)/outcomes/page.tsx`
- Create: `src/features/outcomes/components/OutcomesTabs.tsx`
- Modify: `src/components/shell/SideNav.tsx` (nav link)

- [ ] **Step 1: Add the page guard** in `src/lib/auth.ts`, after `requireCageManageRole`:

```ts
// Server-side guard for /outcomes (deaths & discharges register). Everyone
// except STAFF may view it (VIEWER is the read-only "sees everything" role).
export async function requireOutcomeReadRole(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role === 'STAFF') redirect('/');
  return user;
}
```

- [ ] **Step 2: Create the tabs client component** `src/features/outcomes/components/OutcomesTabs.tsx`:

```tsx
'use client';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { formatDateTime } from '@/lib/time';
import Link from 'next/link';
import { useState } from 'react';

export interface OutcomeRow {
  animalId: string;
  animalName: string;
  animalSpecies: string;
  detail: string; // cause of death / discharge summary
  at: string; // ISO
  byName: string;
}

interface Props {
  deaths: OutcomeRow[];
  discharges: OutcomeRow[];
}

type Tab = 'deaths' | 'discharges';

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function List({ rows, verb }: { rows: OutcomeRow[]; verb: string }) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-line bg-paper p-6 text-center text-muted text-sm">No {verb} recorded.</p>;
  }
  const today = rows.filter((r) => isToday(r.at));
  const earlier = rows.filter((r) => !isToday(r.at));
  return (
    <div className="flex flex-col gap-4">
      {today.length > 0 && <Group title="Today" rows={today} />}
      {earlier.length > 0 && <Group title="Earlier" rows={earlier} />}
    </div>
  );
}

function Group({ title, rows }: { title: string; rows: OutcomeRow[] }) {
  return (
    <div>
      <h3 className="mb-2 px-1 font-display text-[13px] font-bold">{title}</h3>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.animalId} className="rounded-lg border border-line bg-paper p-3">
            <Link href={`/patients/${r.animalId}`} className="block hover:opacity-80">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{r.animalName}</span>
                <span className="text-muted text-xs">{r.animalSpecies}</span>
                <span className="ml-auto text-muted text-xs">{formatDateTime(new Date(r.at))}</span>
              </div>
              <p className="mt-1 text-[13px] text-text">{r.detail}</p>
              <p className="mt-0.5 text-[11px] text-soft">by {r.byName}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OutcomesTabs({ deaths, discharges }: Props) {
  const [tab, setTab] = useState<Tab>('deaths');
  return (
    <div className="flex flex-col gap-4">
      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'deaths', label: 'Deaths', count: deaths.length },
          { value: 'discharges', label: 'Discharges', count: discharges.length },
        ]}
      />
      {tab === 'deaths' ? <List rows={deaths} verb="deaths" /> : <List rows={discharges} verb="discharges" />}
    </div>
  );
}
```

> Verify `formatDateTime` exists in `src/lib/time.ts` (it is used elsewhere, e.g. ActivitySheet). If its signature differs, adapt the call.

- [ ] **Step 3: Create the page** `src/app/(app)/outcomes/page.tsx`:

```tsx
import { OutcomesTabs } from '@/features/outcomes/components/OutcomesTabs';
import { listDeaths, listDischarges } from '@/features/outcomes/queries';
import { requireOutcomeReadRole } from '@/lib/auth';

export default async function OutcomesPage() {
  await requireOutcomeReadRole();
  const [deaths, discharges] = await Promise.all([listDeaths(), listDischarges()]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Outcomes</h1>
        <p className="mt-1 text-muted text-sm">Deaths and discharges across all patients</p>
      </div>
      <OutcomesTabs
        deaths={deaths.map((d) => ({
          animalId: d.animalId,
          animalName: d.animalName,
          animalSpecies: d.animalSpecies,
          detail: d.causeOfDeath,
          at: d.diedAt.toISOString(),
          byName: d.recordedByName,
        }))}
        discharges={discharges.map((d) => ({
          animalId: d.animalId,
          animalName: d.animalName,
          animalSpecies: d.animalSpecies,
          detail: d.summary,
          at: d.dischargedAt.toISOString(),
          byName: d.dischargedByName,
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 4: Add the nav link** in `src/components/shell/SideNav.tsx`. Add `ClipboardList` to the `lucide-react` import. After the Cages `NavLink` block (the `(userRole === 'DOCTOR' || …)` block), add:

```tsx
        {userRole !== 'STAFF' && (
          <NavLink
            item={{ href: '/outcomes', label: 'Outcomes', icon: ClipboardList }}
            active={isActive('/outcomes')}
          />
        )}
```

- [ ] **Step 5: Typecheck + manual verify**

Run: `pnpm typecheck` (expect clean). Then with the app running on the local DB (`pnpm dev`, logged in as `admin@arham.care`), visit `/outcomes` → see Deaths/Discharges tabs; click a row → patient detail. Log in as `sahil@arham.care` (STAFF) → `/outcomes` redirects to `/`, and the "Outcomes" nav item is absent.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts "src/app/(app)/outcomes/page.tsx" src/features/outcomes/components/OutcomesTabs.tsx src/components/shell/SideNav.tsx
git commit -m "feat(outcomes): /outcomes register page, guard, and nav link"
```

---

### Task 7: Dashboard "Today" tile filters

**Files:**
- Modify: `src/app/(app)/page.tsx` (read `searchParams`)
- Modify: `src/features/reports/components/TodayDashboard.tsx` (tiles → links + filtered panel)
- Create: `src/features/reports/components/TodayLifecyclePanel.tsx`
- Modify: `src/features/reports/components/TodayTimeline.tsx` + `src/features/reports/queries.ts` (`listTodayActivities` type filter)

- [ ] **Step 1: Add a type filter to `listTodayActivities`** in `src/features/reports/queries.ts`. Change the function signature and the `where`:

Find `async function _listTodayActivitiesRaw(): Promise<TodayTimelineItemCached[]> {` and its `where: { occurredAt: { gte: start, lte: upper }, deletedAt: null, animal: { deletedAt: null } },`. Change the raw function to accept an optional type and add it to the where:

```ts
async function _listTodayActivitiesRaw(type?: string): Promise<TodayTimelineItemCached[]> {
  // ...unchanged start/upper math...
  const rows = await prisma.activity.findMany({
    where: {
      occurredAt: { gte: start, lte: upper },
      deletedAt: null,
      animal: { deletedAt: null },
      ...(type ? { type: type as never } : {}),
    },
    // ...rest unchanged...
```

Then update the exported wrapper `listTodayActivities` to forward the arg. Locate the `export const listTodayActivities = unstable_cache(...)` (or the exported function) and ensure it accepts and forwards `type`. If it's `unstable_cache(_listTodayActivitiesRaw, ['today-activities'], ...)`, change the export to a thin function so the cache key varies by type:

```ts
export async function listTodayActivities(type?: string) {
  return _listTodayActivitiesCached(type);
}
```
and rename the cached const accordingly (`_listTodayActivitiesCached`). (Match the existing `searchActiveAnimals` pattern in `animals/queries.ts`, which wraps `unstable_cache` the same way so the arg becomes part of the key.)

- [ ] **Step 2: Forward the filter through `TodayTimeline`** in `src/features/reports/components/TodayTimeline.tsx`:

```tsx
export async function TodayTimeline({ type }: { type?: string } = {}) {
  const items = await listTodayActivities(type);
  // ...rest unchanged...
}
```

- [ ] **Step 3: Create `TodayLifecyclePanel`** `src/features/reports/components/TodayLifecyclePanel.tsx`:

```tsx
import { listTodayAdmissions, listTodayDeaths, listTodayDischarges } from '@/features/outcomes/queries';
import { formatDateTime } from '@/lib/time';
import Link from 'next/link';

const LOADERS = {
  admissions: listTodayAdmissions,
  deaths: listTodayDeaths,
  discharges: listTodayDischarges,
} as const;

const EMPTY: Record<keyof typeof LOADERS, string> = {
  admissions: 'No admissions today.',
  deaths: 'No deaths today.',
  discharges: 'No discharges today.',
};

export async function TodayLifecyclePanel({ kind }: { kind: keyof typeof LOADERS }) {
  const rows = await LOADERS[kind]();
  if (rows.length === 0) {
    return <p className="rounded-2xl border border-line border-dashed bg-paper p-6 text-center text-muted text-sm">{EMPTY[kind]}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-lg border border-line bg-paper p-3">
          <Link href={`/patients/${r.id}`} className="block hover:opacity-80">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium">{r.name}</span>
              <span className="text-muted text-xs">{r.species}</span>
              <span className="ml-auto text-muted text-xs">{formatDateTime(r.at)}</span>
            </div>
            {r.detail && <p className="mt-1 text-[13px] text-text">{r.detail}</p>}
            {r.byName && <p className="mt-0.5 text-[11px] text-soft">by {r.byName}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Read searchParams in the home page** `src/app/(app)/page.tsx`:

```tsx
import { TodayDashboard } from '@/features/reports/components/TodayDashboard';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  return <TodayDashboard show={show} />;
}
```

- [ ] **Step 5: Make tiles filter the panel** in `src/features/reports/components/TodayDashboard.tsx`. Rewrite the component to: accept `show`, resolve the current user (for the deaths/discharges RBAC gate), render each tile as a `Link` (or static for STAFF on deaths/discharges), and render the matching panel. Replace the whole file with:

```tsx
import { getCachedTodayCounts } from '@/features/animals/queries';
import { getCurrentUser } from '@/lib/auth';
import { ArrowRight, type LucideIcon, Plus, Scissors, Skull } from 'lucide-react';
import Link from 'next/link';
import { QuickActions } from './QuickActions';
import { TodayLifecyclePanel } from './TodayLifecyclePanel';
import { TodayTimeline } from './TodayTimeline';

type ShowKey = 'admissions' | 'surgeries' | 'discharges' | 'deaths';
const SHOW_KEYS: ShowKey[] = ['admissions', 'surgeries', 'discharges', 'deaths'];
const OUTCOME_KEYS = new Set<ShowKey>(['deaths', 'discharges']);

interface Tile {
  key: ShowKey;
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  tint: string;
}

export async function TodayDashboard({ show }: { show?: string } = {}) {
  const [counts, user] = await Promise.all([getCachedTodayCounts(), getCurrentUser()]);
  const canSeeOutcomes = !!user && user.role !== 'STAFF';

  const active: ShowKey | null = SHOW_KEYS.includes(show as ShowKey) ? (show as ShowKey) : null;
  // STAFF cannot drill into deaths/discharges, even via a hand-typed URL.
  const effectiveActive = active && OUTCOME_KEYS.has(active) && !canSeeOutcomes ? null : active;

  const tiles: Tile[] = [
    { key: 'admissions', label: 'Admissions', value: counts.admissionsToday, icon: Plus, color: '#0E7C7B', tint: '#D6EEEE' },
    { key: 'surgeries', label: 'Surgeries', value: counts.surgeriesToday, icon: Scissors, color: '#B5471A', tint: '#F6E2D2' },
    { key: 'discharges', label: 'Discharges', value: counts.dischargesToday, icon: ArrowRight, color: '#15803D', tint: '#DCFAE6' },
    { key: 'deaths', label: 'Deaths', value: counts.deathsToday, icon: Skull, color: '#5B6B7A', tint: '#E2E8EE' },
  ];

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-[28px] font-extrabold tracking-tight md:text-[32px]">Today</h1>
        <p className="mt-1 text-sm text-muted">{dateLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          const clickable = !OUTCOME_KEYS.has(t.key) || canSeeOutcomes;
          const isActive = effectiveActive === t.key;
          const inner = (
            <div
              className={`flex items-center gap-3.5 rounded-2xl border bg-paper px-4 py-3.5 ${
                isActive ? 'border-accent ring-1 ring-accent' : 'border-line'
              } ${clickable ? 'transition hover:border-accent/50' : ''}`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: t.tint, color: t.color }}>
                <Icon size={18} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="font-display text-[26px] font-bold leading-none">{t.value}</div>
                <div className="mt-1 text-[12.5px] text-muted">{t.label}</div>
              </div>
            </div>
          );
          if (!clickable) return <div key={t.key}>{inner}</div>;
          // Toggle: active tile links back to the default view.
          return (
            <Link key={t.key} href={isActive ? '/' : `/?show=${t.key}`} aria-pressed={isActive}>
              {inner}
            </Link>
          );
        })}
      </div>

      <section>
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className="font-bold text-[10.5px] text-muted uppercase tracking-[0.07em]">Quick actions</h2>
        </div>
        <QuickActions />
      </section>

      <section>
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className="font-bold text-[10.5px] text-muted uppercase tracking-[0.07em]">
            {effectiveActive ? `Today's ${effectiveActive}` : "Today's activities"}
          </h2>
        </div>
        {effectiveActive === 'surgeries' ? (
          <TodayTimeline type="SURGERY" />
        ) : effectiveActive === 'admissions' || effectiveActive === 'deaths' || effectiveActive === 'discharges' ? (
          <TodayLifecyclePanel kind={effectiveActive} />
        ) : (
          <TodayTimeline />
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck + manual verify**

Run: `pnpm typecheck`. Then in the browser (local DB): as admin, the dashboard tiles are clickable; clicking **Deaths** highlights it and the panel lists today's deceased animals (link → patient); clicking it again returns to the full timeline; **Surgeries** shows only today's surgery activities. As STAFF (`sahil@arham.care`), Admissions/Surgeries are clickable but Deaths/Discharges are not, and `/?show=deaths` typed manually shows the default timeline.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/page.tsx" src/features/reports/components/TodayDashboard.tsx src/features/reports/components/TodayLifecyclePanel.tsx src/features/reports/components/TodayTimeline.tsx src/features/reports/queries.ts
git commit -m "feat(dashboard): today tiles filter the panel; deaths/discharges gated to non-staff"
```

---

### Task 8: Hide mutation affordances on closed cases (patient detail UI)

The server lock (Tasks 2–4) is the security boundary; this hides the buttons so non-super users don't hit a toast error on a closed case. Scope: the patient detail page, which knows the animal's status.

**Files:**
- Modify: `src/features/animals/components/AnimalDetail.tsx` (compute `caseLocked`, pass down)
- Modify: `src/features/animals/components/AnimalDetailActions.tsx`
- Modify: `src/features/animals/components/ActivityTimeline.tsx` + `src/features/activities/components/ActivitySheet.tsx`
- Modify: `src/features/documents/components/DocumentsPanel.tsx`

- [ ] **Step 1: Compute the lock in `AnimalDetail.tsx`.** It already fetches `currentUser` (from the canWrite work) and `animal`. After `const canWriteDocs = …;` add:

```ts
  const caseClosed = animal.status === 'DECEASED' || animal.status === 'DISCHARGED';
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  // On a closed case, only SUPER_ADMIN may mutate (mirrors the server lock).
  const caseLocked = caseClosed && !isSuperAdmin;
```
Then update the affordance props: change `canWrite={canWriteDocs}` on `DocumentsPanel` to `canWrite={canWriteDocs && !caseLocked}`, and pass `caseLocked` to the timeline: change `<ActivityTimeline activities={serializedActivities} animalId={animal.id} />` to `<ActivityTimeline activities={serializedActivities} animalId={animal.id} caseLocked={caseLocked} />`.

- [ ] **Step 2: `AnimalDetailActions`** already reads `currentUserRole` from context and has `isClosed`. Add a super-admin escape so its Edit / log-activity affordances hide on a locked case. After `const canWrite = currentUserRole !== 'VIEWER';` add:

```tsx
  const isSuperAdmin = currentUserRole === 'SUPER_ADMIN';
  const caseLocked = isClosed && !isSuperAdmin;
```
Then gate the write affordances (the "Log activity" / quick-add trigger and the "Edit" link) behind `!caseLocked` in addition to `canWrite` (e.g. render them only when `canWrite && !caseLocked`). Leave the read-only items (Share) unchanged. (The discharge/death lifecycle links already hide when `isClosed`.)

- [ ] **Step 3: Thread `caseLocked` into `ActivityTimeline` → `ActivitySheet`.** In `ActivityTimeline.tsx`, extend `Props` with `caseLocked?: boolean` and pass it to `<ActivitySheet … caseLocked={caseLocked} />`. In `ActivitySheet.tsx`, extend its `Props` with `caseLocked?: boolean`; compute `const isSuperAdmin = currentUserRole === 'SUPER_ADMIN';` (it already reads `currentUserRole`) and treat the existing `canWrite` as `canWrite && (!caseLocked || isSuperAdmin)` — i.e. hide Edit / Delete / Duplicate when the case is locked. Since `caseLocked` already accounts for super-admin from the parent, simply AND it in: replace the `canWrite` derivation with:

```tsx
  const canWrite = currentUserRole !== 'VIEWER' && !caseLocked;
```

- [ ] **Step 4: `DocumentsPanel`** — no change needed beyond Step 1 (it already keys off the `canWrite` prop, now passed `&& !caseLocked`).

- [ ] **Step 5: Typecheck + manual verify**

Run: `pnpm typecheck`. Then in the browser: open a DECEASED/DISCHARGED patient as a DOCTOR → no Edit / Log-activity / Upload / activity Edit-Delete affordances; open the same as SUPER_ADMIN → all affordances present. Open an OBSERVATION patient as DOCTOR → affordances present (unchanged).

> No SUPER_ADMIN is seeded by default — to test the super path, promote a user via `/admin/users` while logged in as a SUPER_ADMIN, or temporarily set a user's role in the DB.

- [ ] **Step 6: Commit**

```bash
git add src/features/animals/components/AnimalDetail.tsx src/features/animals/components/AnimalDetailActions.tsx src/features/activities/components/ActivityTimeline.tsx src/features/activities/components/ActivitySheet.tsx
git commit -m "feat: hide mutation affordances on closed cases for non-super-admins"
```

---

### Task 9: Full verification sweep

- [ ] **Step 1: Static + unit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green (180+ unit tests; new rbac tests included).

- [ ] **Step 2: Integration (local DB)**

Run (local-DB env from the header, after `pnpm db:up` + seed): `… npx vitest run --config vitest.integration.config.ts`
Expected: all green, including the new closed-case-lock and outcomes tests.

- [ ] **Step 3: Final commit (if any formatting fixups)**

```bash
pnpm format
git add -A
git commit -m "chore: formatting" || echo "nothing to format"
```

---

## Self-Review

**Spec coverage:**
- Part 1 (tile filters) → Task 7. ✓
- Part 2 (register page) → Task 6 + queries Task 5. ✓
- Part 3 (`outcome.read`) → Task 1; page guard Task 6. ✓
- Part 4 (closed-case lock) → Tasks 1 (helper) + 2/3/4 (services) + 8 (UI). ✓
- Open-question #1 (create on closed animal frozen) → implemented in Tasks 3 & 4 (createActivity/createDocument/initiateUpload assert). ✓
- Open-question #2 (`/outcomes`, "Outcomes") → Task 6. ✓
- Open-question #3 (cap 100, no load-more in v1) → Task 5 (`REGISTER_CAP = 100`); load-more deferred (documented YAGNI deviation from the spec's "+ load more"). ✓

**Placeholder scan:** No TBD/TODO; every code step has concrete code; commands have expected output. The one "verify X exists" notes (`formatDateTime`, the `unstable_cache` wrapper shape) are explicit verification steps with a fallback, not placeholders.

**Type consistency:** `assertOpenCase(actor, status)` signature is consistent across Tasks 1–4. `TodayLifecycleRow` / `DeathRow` / `DischargeRow` field names match between `queries.ts` (Task 5) and the components (Tasks 6–7). `ShowKey` values match the `?show=` hrefs and the panel switch.

**Known deviations from spec:** register pagination is cap-only (100) in v1; "Load more" deferred. Flag for the user.
