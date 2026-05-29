# Lifecycle Invalidate / Re-validate (Part A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a SUPER_ADMIN reverse a wrongly-recorded death/discharge by *invalidating* it (record preserved, animal returns to Observation, cage rules respected), and re-validate it later — all auditable.

**Architecture:** Two nullable columns (`invalidatedAt`, `invalidatedById`) on `DeathRecord`/`DischargeRecord` (additive migration). A `lifecycle.invalidate` RBAC action (SUPER_ADMIN). `invalidateLifecycle`/`revalidateLifecycle` services + actions. Reopen / Re-validate buttons on the patient page. The Outcomes register filters out invalidated records.

**Tech Stack:** Prisma 5 + Postgres, Next.js 15 App Router, Zod, Vitest (unit + integration on local Postgres), Biome.

**Spec:** `docs/superpowers/specs/2026-05-29-lifecycle-timeline-and-invalidation-design.md`. **This plan is Part A only.** Part B (lifecycle entries in the timelines + record-detail sheet) and Part C (full-card drill-downs) will be separate plans after A ships.

> **Hard constraint:** never run invalidate/re-validate against the live Neon DB. All tests use local Postgres: `docker compose up -d postgres`, env `DATABASE_URL`/`DIRECT_URL=postgresql://arham:arham_dev@localhost:5433/arham_ipd`, `STORAGE_DRIVER=local`, `AUTH_SECRET=test-secret-32-bytes-aaaaaaaaaaaaaa`; seed once with `… npx tsx prisma/seed.ts`. The migration is additive (nullable columns) — safe to `migrate deploy`.

---

### Task 1: Schema + migration — `invalidatedAt`/`invalidatedById`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260529120000_add_lifecycle_invalidation/migration.sql`

- [ ] **Step 1: Edit `prisma/schema.prisma`.** In `model DeathRecord`, after `recordedBy ...`, add:
```prisma
  invalidatedAt    DateTime?
  invalidatedById  String?
  invalidatedBy    User?     @relation("DeathInvalidatedBy", fields: [invalidatedById], references: [id])
```
In `model DischargeRecord`, after `dischargedBy ...`, add:
```prisma
  invalidatedAt   DateTime?
  invalidatedById String?
  invalidatedBy   User?    @relation("DischargeInvalidatedBy", fields: [invalidatedById], references: [id])
```
In `model User`, alongside the existing `deathRecords`/`discharges` back-relations, add:
```prisma
  invalidatedDeaths     DeathRecord[]     @relation("DeathInvalidatedBy")
  invalidatedDischarges DischargeRecord[] @relation("DischargeInvalidatedBy")
```

- [ ] **Step 2: Hand-author the migration** (the harness can't run `migrate dev`). Create `prisma/migrations/20260529120000_add_lifecycle_invalidation/migration.sql`:
```sql
-- AlterTable
ALTER TABLE "DeathRecord" ADD COLUMN "invalidatedAt" TIMESTAMP(3);
ALTER TABLE "DeathRecord" ADD COLUMN "invalidatedById" TEXT;
ALTER TABLE "DischargeRecord" ADD COLUMN "invalidatedAt" TIMESTAMP(3);
ALTER TABLE "DischargeRecord" ADD COLUMN "invalidatedById" TEXT;

-- AddForeignKey
ALTER TABLE "DeathRecord" ADD CONSTRAINT "DeathRecord_invalidatedById_fkey" FOREIGN KEY ("invalidatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DischargeRecord" ADD CONSTRAINT "DischargeRecord_invalidatedById_fkey" FOREIGN KEY ("invalidatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply to local DB + regenerate client.**
Run (local-DB env): `DATABASE_URL='postgresql://arham:arham_dev@localhost:5433/arham_ipd' DIRECT_URL='postgresql://arham:arham_dev@localhost:5433/arham_ipd' npx prisma migrate deploy` → expect "1 migration applied". Then `npx prisma generate`.

- [ ] **Step 4: Verify** — `pnpm typecheck` (clean; the new fields exist on the Prisma types).

- [ ] **Step 5: Commit**
```bash
git add prisma/schema.prisma prisma/migrations/20260529120000_add_lifecycle_invalidation
git commit -m "feat(schema): add invalidatedAt/invalidatedById to death & discharge records"
```

---

### Task 2: RBAC `lifecycle.invalidate`

**Files:**
- Modify: `src/lib/rbac.ts`
- Test: `src/lib/__tests__/rbac.test.ts`

- [ ] **Step 1: Write failing test** — append to `rbac.test.ts`:
```ts
describe('lifecycle.invalidate permission', () => {
  it('allows only SUPER_ADMIN', () => {
    expect(can({ id: 'u', role: 'SUPER_ADMIN' }, 'lifecycle.invalidate')).toBe(true);
    for (const role of ['STAFF', 'DOCTOR', 'ADMIN', 'VIEWER'] as const) {
      expect(can({ id: 'u', role }, 'lifecycle.invalidate')).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `pnpm test -- src/lib/__tests__/rbac.test.ts`. (Also note: the `MATRIX` in this test file is typed `Record<Action, …>`, so adding the action to the union will require a `MATRIX` entry — add `'lifecycle.invalidate': [false, false, false, true, false]` matching the `[STAFF,DOCTOR,ADMIN,SUPER_ADMIN,VIEWER]` column order used in that file.)

- [ ] **Step 3: Implement** in `src/lib/rbac.ts`: add `| 'lifecycle.invalidate'` to the `Action` union and `'lifecycle.invalidate': ['SUPER_ADMIN'],` to `PERMISSIONS`.

- [ ] **Step 4: Run, verify PASS** — `pnpm test -- src/lib/__tests__/rbac.test.ts` and `pnpm typecheck`.

- [ ] **Step 5: Commit**
```bash
git add src/lib/rbac.ts src/lib/__tests__/rbac.test.ts
git commit -m "feat(rbac): add lifecycle.invalidate (super-admin only)"
```

---

### Task 3: `invalidateLifecycle` + `revalidateLifecycle` services (+ cage rules)

**Files:**
- Modify: `src/features/animals/lifecycle/service.ts`
- Test: `src/features/animals/__integration__/lifecycle.test.ts`

- [ ] **Step 1: Write failing integration tests** — append to `lifecycle.test.ts` (it already imports `prisma`, `actorByEmail`, `qaName`, `purgeQa`, `DOCTOR_EMAIL`, `ADMIN_EMAIL`, `RbacError`). Add a local super-admin helper at the top of this describe (no SUPER_ADMIN is seeded):
```ts
describe('invalidate / re-validate', () => {
  async function makeSuperAdmin() {
    return prisma.user.create({
      data: {
        email: `${qaName('sa')}@qa-roles.local`,
        name: qaName('SA'),
        role: 'SUPER_ADMIN',
        passwordHash: 'x',
        active: true,
      },
    });
  }
  async function cleanupSuper(id: string) {
    await prisma.auditLog.deleteMany({ where: { actorId: id } });
    await prisma.user.deleteMany({ where: { id } });
  }

  it('SUPER_ADMIN invalidates a death: animal returns to OBSERVATION, record kept + flagged, cage null', async () => {
    const sa = await makeSuperAdmin();
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await prisma.animal.create({
      data: {
        name: qaName('inv'),
        species: 'Dog',
        status: 'DECEASED',
        deceasedAt: new Date(),
        vaccination: 'NONE',
        createdById: doctor.id,
        deathRecord: { create: { causeOfDeath: qaName('c'), diedAt: new Date(), recordedById: doctor.id } },
      },
    });
    await invalidateLifecycle({ id: sa.id, role: 'SUPER_ADMIN' }, animal.id);
    const after = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } });
    expect(after.status).toBe('OBSERVATION');
    expect(after.deceasedAt).toBeNull();
    expect(after.cageId).toBeNull();
    const rec = await prisma.deathRecord.findUniqueOrThrow({ where: { animalId: animal.id } });
    expect(rec.invalidatedAt).not.toBeNull();
    expect(rec.invalidatedById).toBe(sa.id);
    await cleanupSuper(sa.id);
  });

  it('DOCTOR cannot invalidate', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await prisma.animal.create({
      data: {
        name: qaName('inv2'),
        species: 'Dog',
        status: 'DECEASED',
        deceasedAt: new Date(),
        vaccination: 'NONE',
        createdById: doctor.id,
        deathRecord: { create: { causeOfDeath: qaName('c'), diedAt: new Date(), recordedById: doctor.id } },
      },
    });
    await expect(invalidateLifecycle(doctor, animal.id)).rejects.toBeInstanceOf(RbacError);
  });

  it('re-validate re-declares deceased, restores original diedAt, releases held cage', async () => {
    const sa = await makeSuperAdmin();
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const diedAt = new Date('2026-05-20T10:00:00.000Z');
    const animal = await prisma.animal.create({
      data: {
        name: qaName('reval'),
        species: 'Dog',
        status: 'OBSERVATION',
        vaccination: 'NONE',
        createdById: doctor.id,
        deathRecord: {
          create: { causeOfDeath: qaName('c'), diedAt, recordedById: doctor.id, invalidatedAt: new Date(), invalidatedById: sa.id },
        },
      },
    });
    // give it a cage to prove release
    const cage = await prisma.cage.create({ data: { name: qaName('cage') } });
    await prisma.animal.update({ where: { id: animal.id }, data: { cageId: cage.id } });
    await revalidateLifecycle({ id: sa.id, role: 'SUPER_ADMIN' }, animal.id);
    const after = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } });
    expect(after.status).toBe('DECEASED');
    expect(after.deceasedAt?.toISOString()).toBe(diedAt.toISOString());
    expect(after.cageId).toBeNull();
    const rec = await prisma.deathRecord.findUniqueOrThrow({ where: { animalId: animal.id } });
    expect(rec.invalidatedAt).toBeNull();
    await prisma.animal.update({ where: { id: animal.id }, data: { cageId: null } }); // detach before purge
    await prisma.cage.delete({ where: { id: cage.id } });
    await cleanupSuper(sa.id);
  });
});
```
Add imports: `import { invalidateLifecycle, revalidateLifecycle } from '../lifecycle/service';` (adjust the relative path to match the test file's location — the test is in `animals/__integration__/`, service is `animals/lifecycle/service.ts`, so `'../lifecycle/service'`). `ADMIN_EMAIL` may already be imported; add if missing.

- [ ] **Step 2: Run, verify FAIL** — `… npx vitest run --config vitest.integration.config.ts src/features/animals/__integration__/lifecycle.test.ts`. Expected: import error / functions undefined.

- [ ] **Step 3: Implement** in `src/features/animals/lifecycle/service.ts`. `assertCan` and the imports (`writeAuditLog`, `NotFoundError`, `ValidationError`, `prisma`, `Actor`) are already present. Append:
```ts
export async function invalidateLifecycle(actor: Actor, animalId: string) {
  assertCan(actor, 'lifecycle.invalidate');
  return prisma.$transaction(async (tx) => {
    const animal = await tx.animal.findFirst({ where: { id: animalId, deletedAt: null } });
    if (!animal) throw new NotFoundError('Animal', animalId);
    if (animal.status !== 'DECEASED' && animal.status !== 'DISCHARGED') {
      throw new ValidationError('This patient is not discharged or deceased');
    }
    const kind = animal.status === 'DECEASED' ? 'death' : 'discharge';
    const now = new Date();
    if (kind === 'death') {
      await tx.deathRecord.update({
        where: { animalId },
        data: { invalidatedAt: now, invalidatedById: actor.id },
      });
    } else {
      await tx.dischargeRecord.update({
        where: { animalId },
        data: { invalidatedAt: now, invalidatedById: actor.id },
      });
    }
    // Return to active care. cageId is already null (released at close time);
    // we do NOT restore the old cage — it may now hold another patient.
    const updated = await tx.animal.update({
      where: { id: animalId },
      data: { status: 'OBSERVATION', deceasedAt: null, dischargedAt: null, editedAt: now, editedById: actor.id },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'update',
      entityType: 'Animal',
      entityId: animalId,
      before: { status: animal.status },
      after: { status: 'OBSERVATION' },
      context: { lifecycle: 'invalidate', kind },
    });
    return updated;
  });
}

export async function revalidateLifecycle(actor: Actor, animalId: string) {
  assertCan(actor, 'lifecycle.invalidate');
  return prisma.$transaction(async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, deletedAt: null },
      include: { deathRecord: true, dischargeRecord: true },
    });
    if (!animal) throw new NotFoundError('Animal', animalId);
    if (animal.status === 'DECEASED' || animal.status === 'DISCHARGED') {
      throw new ValidationError('This patient is already closed');
    }
    const now = new Date();
    if (animal.deathRecord?.invalidatedAt) {
      await tx.deathRecord.update({ where: { animalId }, data: { invalidatedAt: null, invalidatedById: null } });
      const updated = await tx.animal.update({
        where: { id: animalId },
        // Re-declare deceased at the original time; release any held cage.
        data: { status: 'DECEASED', deceasedAt: animal.deathRecord.diedAt, cageId: null, editedAt: now, editedById: actor.id },
      });
      await writeAuditLog(tx, {
        actorId: actor.id, action: 'update', entityType: 'Animal', entityId: animalId,
        before: { status: animal.status }, after: { status: 'DECEASED' }, context: { lifecycle: 'revalidate', kind: 'death' },
      });
      return updated;
    }
    if (animal.dischargeRecord?.invalidatedAt) {
      await tx.dischargeRecord.update({ where: { animalId }, data: { invalidatedAt: null, invalidatedById: null } });
      const updated = await tx.animal.update({
        where: { id: animalId },
        data: { status: 'DISCHARGED', dischargedAt: animal.dischargeRecord.dischargedAt, cageId: null, editedAt: now, editedById: actor.id },
      });
      await writeAuditLog(tx, {
        actorId: actor.id, action: 'update', entityType: 'Animal', entityId: animalId,
        before: { status: animal.status }, after: { status: 'DISCHARGED' }, context: { lifecycle: 'revalidate', kind: 'discharge' },
      });
      return updated;
    }
    throw new ValidationError('No invalidated death or discharge to re-validate');
  });
}
```

- [ ] **Step 4: Run, verify PASS** — the three new tests pass; existing lifecycle tests stay green. `pnpm typecheck`.

- [ ] **Step 5: Commit**
```bash
git add src/features/animals/lifecycle/service.ts src/features/animals/__integration__/lifecycle.test.ts
git commit -m "feat: invalidate/re-validate lifecycle (super-admin), cage-aware"
```

---

### Task 4: Actions

**Files:**
- Modify: `src/features/animals/lifecycle/actions.ts`

- [ ] **Step 1: Implement** — add to `actions.ts` (it already has `requireActor`, `genericError`, `LifecycleResult`, `revalidateTag`, `revalidatePath`). Import the two services: change the existing `import { dischargeAnimal, recordDeath } from './service';` to also import `invalidateLifecycle, revalidateLifecycle`. Then append:
```ts
export async function invalidateLifecycleAction(animalId: string): Promise<LifecycleResult> {
  try {
    const actor = await requireActor();
    await invalidateLifecycle(actor, animalId);
    revalidateTag('animals');
    revalidateTag('today-counts');
    revalidateTag('today-timeline');
    revalidatePath(`/patients/${animalId}`);
    revalidatePath('/outcomes');
    return { ok: true };
  } catch (e) {
    return genericError('reopen case', e);
  }
}

export async function revalidateLifecycleAction(animalId: string): Promise<LifecycleResult> {
  try {
    const actor = await requireActor();
    await revalidateLifecycle(actor, animalId);
    revalidateTag('animals');
    revalidateTag('today-counts');
    revalidateTag('today-timeline');
    revalidatePath(`/patients/${animalId}`);
    revalidatePath('/outcomes');
    return { ok: true };
  } catch (e) {
    return genericError('re-validate', e);
  }
}
```

- [ ] **Step 2: Verify** — `pnpm typecheck` + `pnpm lint` (exit 0).

- [ ] **Step 3: Commit**
```bash
git add src/features/animals/lifecycle/actions.ts
git commit -m "feat: invalidate/re-validate lifecycle server actions"
```

---

### Task 5: Outcomes register filters out invalidated

**Files:**
- Modify: `src/features/outcomes/queries.ts` (`listDeaths`, `listDischarges`)
- Test: `src/features/outcomes/__integration__/outcomes.test.ts`

- [ ] **Step 1: Write failing test** — append to `outcomes.test.ts`:
```ts
it('listDeaths excludes an invalidated death', async () => {
  const admin = await actorByEmail(ADMIN_EMAIL);
  const a = await prisma.animal.create({
    data: {
      name: qaName('invdead'),
      species: 'Dog',
      status: 'OBSERVATION',
      vaccination: 'NONE',
      createdById: admin.id,
      deathRecord: {
        create: { causeOfDeath: qaName('c'), diedAt: new Date(), recordedById: admin.id, invalidatedAt: new Date(), invalidatedById: admin.id },
      },
    },
  });
  const rows = await listDeaths();
  expect(rows.some((r) => r.animalId === a.id)).toBe(false);
});
```
(`ADMIN_EMAIL` is imported in this file already; if not, add it.)

- [ ] **Step 2: Run, verify FAIL** — `… npx vitest run --config vitest.integration.config.ts src/features/outcomes/__integration__/outcomes.test.ts`.

- [ ] **Step 3: Implement** — in `listDeaths` and `listDischarges`, change the `where` from `{ animal: { deletedAt: null } }` to `{ invalidatedAt: null, animal: { deletedAt: null } }`.

- [ ] **Step 4: Run, verify PASS** + `pnpm typecheck`.

- [ ] **Step 5: Commit**
```bash
git add src/features/outcomes/queries.ts src/features/outcomes/__integration__/outcomes.test.ts
git commit -m "feat(outcomes): exclude invalidated records from the register"
```

---

### Task 6: Reopen / Re-validate buttons on the patient page

**Files:**
- Modify: `src/features/animals/queries.ts` (`getAnimal` — include record invalidation flags)
- Modify: `src/features/animals/components/AnimalDetail.tsx` (compute + pass flags)
- Modify: `src/features/animals/components/AnimalDetailActions.tsx` (buttons)

- [ ] **Step 1: Surface the lifecycle-record state.** In `getAnimal` (`animals/queries.ts`), the `include` currently has `testsAdvised`, `media`, `createdBy`, `cage`. Add:
```ts
      deathRecord: { select: { invalidatedAt: true } },
      dischargeRecord: { select: { invalidatedAt: true } },
```
(These are 1:1 relations on Animal — confirm the field names `deathRecord`/`dischargeRecord` match the schema; they do.)

- [ ] **Step 2: Compute flags in `AnimalDetail.tsx`.** After the existing `caseLocked`/`isSuperAdmin` block, add:
```ts
  const hasInvalidatedRecord =
    !!animal.deathRecord?.invalidatedAt || !!animal.dischargeRecord?.invalidatedAt;
```
Pass two new props to `<AnimalDetailActions … />`: `canReopen={isSuperAdmin && caseClosed}` and `canRevalidate={isSuperAdmin && !caseClosed && hasInvalidatedRecord}`. (`isSuperAdmin` and `caseClosed` already exist from the closed-case-lock work.)

- [ ] **Step 3: Add the buttons in `AnimalDetailActions.tsx`.** Extend `Props` with `canReopen?: boolean; canRevalidate?: boolean;`. Import the actions: `import { invalidateLifecycleAction, revalidateLifecycleAction } from '@/features/animals/lifecycle/actions';`, `useToast` (already used elsewhere — check), `useTransition`, `useRouter`. Add a confirm-then-call handler and render the buttons (place next to `PatientShareButton`):
```tsx
  const [pending, start] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();
  const runLifecycle = (fn: (id: string) => Promise<{ ok: boolean; error?: string }>, confirmMsg: string) => {
    if (!window.confirm(confirmMsg)) return;
    start(async () => {
      const r = await fn(animalId);
      if (r.ok) { showToast('Done'); router.refresh(); }
      else showToast(r.error ?? 'Failed');
    });
  };
```
Then, inside the actions row:
```tsx
      {canReopen && (
        <Button size="sm" variant="ghost" disabled={pending}
          onClick={() => runLifecycle(invalidateLifecycleAction, 'Reopen this case? It returns the patient to Observation; the death/discharge record is kept but marked invalidated.')}>
          Reopen case
        </Button>
      )}
      {canRevalidate && (
        <Button size="sm" variant="ghost" disabled={pending}
          onClick={() => runLifecycle(revalidateLifecycleAction, 'Re-validate? This re-declares the patient as deceased/discharged.')}>
          Re-validate
        </Button>
      )}
```
Confirm `useToast`'s API (`showToast`) and `Button`'s `variant`/`size` props against existing usage in this file / `ActivitySheet.tsx`; adapt names if they differ. `window.confirm` is acceptable for v1 (matches the app's lightweight confirm style); if the codebase has a confirm component, prefer it.

- [ ] **Step 4: Verify** — `pnpm typecheck` + `pnpm lint`. Manual (local server, logged in as a SUPER_ADMIN — promote a user via `/admin/users` or set role in local DB): open a deceased patient → "Reopen case" → confirm → patient returns to Observation and appears in Patients; on that now-active patient, "Re-validate" appears → re-declares deceased. As a DOCTOR, neither button shows.

- [ ] **Step 5: Commit**
```bash
git add src/features/animals/queries.ts src/features/animals/components/AnimalDetail.tsx src/features/animals/components/AnimalDetailActions.tsx
git commit -m "feat: reopen/re-validate buttons on patient page (super-admin)"
```

---

### Task 7: Verification sweep

- [ ] **Step 1:** `pnpm typecheck && pnpm lint && pnpm test` → all green (incl. new rbac test).
- [ ] **Step 2:** Full integration (local DB): `… npx vitest run --config vitest.integration.config.ts` → all green (incl. new invalidate/re-validate + outcomes-exclusion tests).
- [ ] **Step 3:** `pnpm format` then commit any formatting: `git add -A && git commit -m "chore: formatting" || echo "clean"`.

---

## Self-Review

**Spec coverage (Part A scope):**
- Schema `invalidatedAt`/`invalidatedById` (additive) → Task 1. ✓
- `lifecycle.invalidate` RBAC (super-only) → Task 2. ✓
- invalidate → Observation, record kept+flagged, cage not restored → Task 3. ✓
- re-validate → re-declare at original time, release held cage → Task 3. ✓
- actions + revalidation → Task 4. ✓
- register excludes invalidated → Task 5. ✓
- Reopen/Re-validate UI (super-only, confirm) → Task 6. ✓
- Counts auto-exclude invalidated (timestamps cleared) → no task needed (verified by reasoning; `getCachedTodayCounts` filters on `deceasedAt`/`dischargedAt`, which invalidate clears). ✓
- **Deferred to Part B:** synthetic lifecycle entries in timelines, struck-through display, the record-detail sheet with attached docs (the "click the entry → see logger/reason/docs" UX). Part A's revert is reachable via the patient-page buttons.
- **Deferred to Part C:** full-card drill-downs.

**Placeholder scan:** No TBD/TODO; each code step has concrete code; the "confirm the API/props" notes are explicit verification steps with adapt-if-different guidance, not placeholders.

**Type consistency:** `invalidateLifecycle`/`revalidateLifecycle(actor, animalId)` signatures consistent across Tasks 3, 4. `LifecycleResult` reused. `lifecycle.invalidate` action string consistent (Tasks 2, 3). `canReopen`/`canRevalidate` prop names consistent (Task 6). Relation field names (`deathRecord`, `dischargeRecord`, `invalidatedAt`, `invalidatedById`) consistent with Task 1's schema.
