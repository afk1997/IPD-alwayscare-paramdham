# Cage Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad-hoc patient location tracking with a managed set of cages that patients are assigned into, where the database guarantees one cage holds at most one patient and the cage frees automatically on discharge/death/trash.

**Architecture:** A new `Cage` table plus a nullable, **unique** `Animal.cageId` foreign key. Postgres allows many NULLs in a unique index, so unassigned/freed patients are NULL (no conflict) while the unique constraint makes two-patients-one-cage impossible — race-proof. Cage management lives in a new `cages` feature folder mirroring the existing `users` feature; assignment is a normal patient field set on the admission and edit forms. The free-text `ward` field stays untouched during this transition.

**Tech Stack:** Next.js 15 (App Router, server actions), Prisma 5 + PostgreSQL, NextAuth, Zod, React Hook Form (admission) + controlled state (edit), Tailwind, Biome, Vitest (unit + `__integration__` against a real DB).

**Spec:** `docs/superpowers/specs/2026-05-28-cage-assignment-design.md`

---

## Prerequisites

- On branch `feat/cage-assignment` (already created).
- A reachable dev Postgres in `.env.local` (`DATABASE_URL`/`DIRECT_URL`). For a local DB: `pnpm db:up`.
- The DB is seeded so integration tests can find seeded users (`admin@arham.care`, `mehta@arham.care`, `sahil@arham.care`): `pnpm db:seed`.
- Integration tests hit the real DB and run sequentially; they are **not** part of `pnpm test`. Run them with `pnpm test:integration <file>`.

---

## Task 1: Schema + migration (`Cage` model, `Animal.cageId`)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<generated>/migration.sql` (via Prisma)

- [ ] **Step 1: Add the `Cage` model**

In `prisma/schema.prisma`, add a new model (place it after the `Animal` model block, before `Activity`):

```prisma
model Cage {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  occupant Animal? // 0..1 — the patient currently in this cage
}
```

- [ ] **Step 2: Add `cageId` + relation to `Animal`**

In the `Animal` model, immediately after the `ward String?` line (currently `prisma/schema.prisma` ~line with `ward String?`), add:

```prisma
  ward            String?
  cageId          String?      @unique
  cage            Cage?        @relation(fields: [cageId], references: [id], onDelete: Restrict)
```

(Keep all other `Animal` fields unchanged. `onDelete: Restrict` makes the DB refuse to delete a cage that still has an occupant.)

- [ ] **Step 3: Generate and apply the migration**

Run: `pnpm db:migrate --name add_cages`
Expected: Prisma prints `The following migration(s) have been created and applied` and creates `prisma/migrations/<timestamp>_add_cages/migration.sql` containing `CREATE TABLE "Cage"`, `ALTER TABLE "Animal" ADD COLUMN "cageId"`, a unique index on `Animal("cageId")`, and a foreign key with `ON DELETE RESTRICT`. The Prisma client is regenerated automatically.

- [ ] **Step 4: Verify types compile against the new client**

Run: `pnpm typecheck`
Expected: PASS (exit 0). The generated client now knows `prisma.cage` and `Animal.cageId`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(cages): add Cage model and unique Animal.cageId

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: RBAC `cage.manage` permission (TDD)

**Files:**
- Modify: `src/lib/rbac.ts`
- Test: `src/lib/__tests__/rbac.test.ts`

- [ ] **Step 1: Add the failing test rows**

In `src/lib/__tests__/rbac.test.ts`, add `'cage.manage'` to the `MATRIX` object (DOCTOR/ADMIN/SUPER_ADMIN allowed; STAFF/VIEWER denied). Add it right after the `'animal.death'` line:

```ts
  'animal.death': [false, true, true, true, false],
  'cage.manage': [false, true, true, true, false],
```

Also add `'cage.manage'` to the `all` array inside the `'ADMIN sees everything'` test (after `'animal.death',`):

```ts
      'animal.death',
      'cage.manage',
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/__tests__/rbac.test.ts`
Expected: FAIL — TypeScript/runtime error that `'cage.manage'` is not assignable to `Action` (the key doesn't exist in `PERMISSIONS` yet).

- [ ] **Step 3: Add the action to `rbac.ts`**

In `src/lib/rbac.ts`, add `'cage.manage'` to the `Action` union (after `| 'animal.death'`):

```ts
  | 'animal.death'
  | 'cage.manage'
```

And add the entry to the `PERMISSIONS` map (after the `'animal.death':` line):

```ts
  'animal.death': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'cage.manage': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/__tests__/rbac.test.ts`
Expected: PASS — includes new rows `STAFF cannot cage.manage`, `DOCTOR CAN cage.manage`, etc.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rbac.ts src/lib/__tests__/rbac.test.ts
git commit -m "feat(cages): add cage.manage RBAC action for DOCTOR+

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `cages` feature — schema, service, queries (TDD)

**Files:**
- Create: `src/features/cages/schema.ts`
- Create: `src/features/cages/service.ts`
- Create: `src/features/cages/queries.ts`
- Modify: `src/lib/__integration__/helpers.ts` (extend `purgeQa` to clean cages)
- Test: `src/features/cages/__integration__/cages.test.ts`

- [ ] **Step 1: Create the Zod schema**

Create `src/features/cages/schema.ts`:

```ts
import { z } from 'zod';

const cageName = z.string().trim().min(1, 'Name is required').max(40);

export const CreateCageSchema = z.object({ name: cageName });
export const RenameCageSchema = z.object({ id: z.string().cuid(), name: cageName });
export const DeleteCageSchema = z.object({ id: z.string().cuid() });

export type CreateCageInput = z.infer<typeof CreateCageSchema>;
export type RenameCageInput = z.infer<typeof RenameCageSchema>;
export type DeleteCageInput = z.infer<typeof DeleteCageSchema>;
```

- [ ] **Step 2: Create the queries**

Create `src/features/cages/queries.ts`:

```ts
import { prisma } from '@/lib/prisma';

export async function listCagesWithOccupancy() {
  return prisma.cage.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      occupant: { select: { id: true, name: true, species: true, status: true } },
    },
  });
}

// Cages a patient can be assigned to right now: every empty cage, plus the
// cage this patient already occupies (so the edit form can show + keep it).
export async function listAssignableCages(animalId?: string): Promise<{ id: string; name: string }[]> {
  const current = animalId
    ? await prisma.animal.findUnique({ where: { id: animalId }, select: { cageId: true } })
    : null;
  return prisma.cage.findMany({
    where: {
      OR: [{ occupant: { is: null } }, ...(current?.cageId ? [{ id: current.cageId }] : [])],
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}
```

- [ ] **Step 3: Create the service**

Create `src/features/cages/service.ts`:

```ts
import { writeAuditLog } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { type Actor, assertCan } from '@/lib/rbac';
import {
  type CreateCageInput,
  CreateCageSchema,
  type DeleteCageInput,
  DeleteCageSchema,
  type RenameCageInput,
  RenameCageSchema,
} from './schema';

async function assertNameFree(name: string, exceptId?: string): Promise<void> {
  const clash = await prisma.cage.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new ValidationError('A cage with that name already exists');
}

export async function createCage(actor: Actor, input: CreateCageInput) {
  assertCan(actor, 'cage.manage');
  const parsed = CreateCageSchema.parse(input);
  await assertNameFree(parsed.name);
  return prisma.$transaction(async (tx) => {
    const cage = await tx.cage.create({ data: { name: parsed.name } });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'create',
      entityType: 'Cage',
      entityId: cage.id,
      after: { name: cage.name },
    });
    return cage;
  });
}

export async function renameCage(actor: Actor, input: RenameCageInput) {
  assertCan(actor, 'cage.manage');
  const parsed = RenameCageSchema.parse(input);
  const before = await prisma.cage.findUnique({ where: { id: parsed.id } });
  if (!before) throw new NotFoundError('Cage', parsed.id);
  await assertNameFree(parsed.name, parsed.id);
  return prisma.$transaction(async (tx) => {
    const cage = await tx.cage.update({ where: { id: parsed.id }, data: { name: parsed.name } });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'update',
      entityType: 'Cage',
      entityId: cage.id,
      before: { name: before.name },
      after: { name: cage.name },
    });
    return cage;
  });
}

export async function deleteCage(actor: Actor, input: DeleteCageInput) {
  assertCan(actor, 'cage.manage');
  const parsed = DeleteCageSchema.parse(input);
  const cage = await prisma.cage.findUnique({
    where: { id: parsed.id },
    select: { id: true, name: true, occupant: { select: { id: true } } },
  });
  if (!cage) throw new NotFoundError('Cage', parsed.id);
  if (cage.occupant) throw new ValidationError('Cage is occupied — free it first');
  return prisma.$transaction(async (tx) => {
    await tx.cage.delete({ where: { id: parsed.id } });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'delete',
      entityType: 'Cage',
      entityId: parsed.id,
      before: { name: cage.name },
    });
    return { id: parsed.id };
  });
}
```

- [ ] **Step 4: Extend `purgeQa` to clean up test cages**

In `src/lib/__integration__/helpers.ts`, inside `purgeQa`, add cage cleanup as the **last** statement (after the `driveFolder.deleteMany` line). Cages must be deleted after animals (the FK lives on `Animal`), and `purgeQa` already deletes `__qa__` animals earlier:

```ts
  await prisma.driveFolder.deleteMany({ where: { key: { contains: QA } } });
  await prisma.cage.deleteMany({ where: { name: { contains: QA } } });
}
```

- [ ] **Step 5: Write the failing integration test**

Create `src/features/cages/__integration__/cages.test.ts`:

```ts
import { createCage, deleteCage, renameCage } from '@/features/cages/service';
import { listAssignableCages, listCagesWithOccupancy } from '@/features/cages/queries';
import { ADMIN_EMAIL, DOCTOR_EMAIL, STAFF_EMAIL, actorByEmail, purgeQa, qaName } from '@/lib/__integration__/helpers';
import { RbacError, ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('cages service — integration vs real DB', () => {
  beforeAll(purgeQa);
  afterAll(purgeQa);

  it('STAFF cannot manage cages', async () => {
    const staff = await actorByEmail(STAFF_EMAIL);
    await expect(createCage(staff, { name: qaName('CageStaff') })).rejects.toBeInstanceOf(RbacError);
  });

  it('DOCTOR can create a cage; duplicate names (case-insensitive) are rejected', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const name = qaName('CageDup');
    const cage = await createCage(doctor, { name });
    expect(cage.name).toBe(name);
    await expect(createCage(doctor, { name: name.toUpperCase() })).rejects.toBeInstanceOf(ValidationError);
  });

  it('rename rejects a colliding name but allows a fresh one', async () => {
    const admin = await actorByEmail(ADMIN_EMAIL);
    const a = await createCage(admin, { name: qaName('CageRenA') });
    const b = await createCage(admin, { name: qaName('CageRenB') });
    await expect(renameCage(admin, { id: b.id, name: a.name })).rejects.toBeInstanceOf(ValidationError);
    const renamed = await renameCage(admin, { id: b.id, name: qaName('CageRenB2') });
    expect(renamed.name).toContain('CageRenB2');
  });

  it('delete is blocked while occupied, allowed when empty', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const cage = await createCage(doctor, { name: qaName('CageDel') });
    const animal = await prisma.animal.create({
      data: { name: qaName('CageDelOccupant'), species: 'Dog', createdById: doctor.id, cageId: cage.id },
    });
    await expect(deleteCage(doctor, { id: cage.id })).rejects.toBeInstanceOf(ValidationError);
    // Free it, then delete succeeds.
    await prisma.animal.update({ where: { id: animal.id }, data: { cageId: null } });
    await deleteCage(doctor, { id: cage.id });
    expect(await prisma.cage.findUnique({ where: { id: cage.id } })).toBeNull();
  });

  it('listAssignableCages excludes occupied cages but keeps the patient’s own', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const cage = await createCage(doctor, { name: qaName('CageAssign') });
    const animal = await prisma.animal.create({
      data: { name: qaName('CageAssignOccupant'), species: 'Dog', createdById: doctor.id, cageId: cage.id },
    });
    const free = await listAssignableCages();
    expect(free.find((c) => c.id === cage.id)).toBeUndefined();
    const forAnimal = await listAssignableCages(animal.id);
    expect(forAnimal.find((c) => c.id === cage.id)).toBeDefined();
    const withOcc = await listCagesWithOccupancy();
    expect(withOcc.find((c) => c.id === cage.id)?.occupant?.id).toBe(animal.id);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm test:integration src/features/cages/__integration__/cages.test.ts`
Expected: FAIL on the first run **before** Steps 1-3 exist; since you wrote them first here, instead confirm it now PASSES. If you prefer strict red-green, temporarily comment out the body of `createCage` and re-run to see failures, then restore.

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm test:integration src/features/cages/__integration__/cages.test.ts`
Expected: PASS (5 tests). Then `pnpm typecheck` → PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/cages src/lib/__integration__/helpers.ts
git commit -m "feat(cages): cage service + queries with single-occupancy + audit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Cages management page, actions, guard, and nav

**Files:**
- Create: `src/features/cages/actions.ts`
- Create: `src/features/cages/components/AddCageForm.tsx`
- Create: `src/features/cages/components/CageList.tsx`
- Create: `src/app/(app)/cages/page.tsx`
- Modify: `src/lib/auth.ts` (add `requireCageManageRole`)
- Modify: `src/components/shell/SideNav.tsx` (add the Cages nav link)

- [ ] **Step 1: Add the server actions**

Create `src/features/cages/actions.ts`:

```ts
'use server';
import { getCurrentUser } from '@/lib/auth';
import { RbacError, ValidationError } from '@/lib/errors';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createCage, deleteCage, renameCage } from './service';

async function requireActor() {
  const user = await getCurrentUser();
  if (!user) throw new RbacError('not authenticated');
  return { id: user.id, role: user.role };
}

export interface CageActionResult {
  ok: boolean;
  error?: string;
}

function mapError(e: unknown): CageActionResult {
  if (e instanceof RbacError) return { ok: false, error: e.message };
  if (e instanceof ValidationError) return { ok: false, error: e.message };
  if (e && typeof e === 'object' && 'issues' in e) {
    const z = e as { issues?: Array<{ message?: string }> };
    return { ok: false, error: z.issues?.[0]?.message ?? 'Invalid input' };
  }
  throw e;
}

function revalidateCages() {
  revalidatePath('/cages');
  // The cage picker on admission/edit reads assignable cages via the
  // `animals` tag-cached search; refresh it too.
  revalidateTag('animals');
}

export async function createCageAction(name: string): Promise<CageActionResult> {
  try {
    const actor = await requireActor();
    await createCage(actor, { name });
    revalidateCages();
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

export async function renameCageAction(id: string, name: string): Promise<CageActionResult> {
  try {
    const actor = await requireActor();
    await renameCage(actor, { id, name });
    revalidateCages();
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

export async function deleteCageAction(id: string): Promise<CageActionResult> {
  try {
    const actor = await requireActor();
    await deleteCage(actor, { id });
    revalidateCages();
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}
```

- [ ] **Step 2: Add the `requireCageManageRole` guard**

In `src/lib/auth.ts`, after `requireAdminRole` (currently ends ~line 99), add:

```ts
// Server-side guard for the /cages page. DOCTOR is included (broader than
// the admin-only pages) because doctors manage cages too.
export async function requireCageManageRole(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'DOCTOR' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') redirect('/');
  return user;
}
```

- [ ] **Step 3: Build the Add-cage form**

Create `src/features/cages/components/AddCageForm.tsx`:

```tsx
'use client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createCageAction } from '../actions';

export function AddCageForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await createCageAction(name.trim());
      if (!result.ok) setError(result.error ?? 'Could not add cage');
      else {
        setName('');
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New cage name (e.g. Cage 1, ICU-2)"
          aria-label="New cage name"
        />
        <Button type="submit" disabled={pending || name.trim().length === 0}>
          {pending ? 'Adding…' : 'Add cage'}
        </Button>
      </div>
      {error && (
        <div role="alert" className="text-sm text-critical">
          {error}
        </div>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Build the cage list with inline rename + delete**

Create `src/features/cages/components/CageList.tsx`:

```tsx
'use client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteCageAction, renameCageAction } from '../actions';

interface Occupant {
  id: string;
  name: string;
  species: string;
  status: string;
}
interface Cage {
  id: string;
  name: string;
  occupant: Occupant | null;
}

export function CageList({ cages }: { cages: Cage[] }) {
  if (cages.length === 0) {
    return <p className="text-sm text-muted">No cages yet. Add your first cage above.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {cages.map((cage) => (
        <CageRow key={cage.id} cage={cage} />
      ))}
    </div>
  );
}

function CageRow({ cage }: { cage: Cage }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cage.name);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    start(async () => {
      const result = await renameCageAction(cage.id, name.trim());
      if (!result.ok) setError(result.error ?? 'Rename failed');
      else {
        setEditing(false);
        router.refresh();
      }
    });
  };

  const remove = () => {
    if (!confirm(`Delete "${cage.name}"? This cannot be undone.`)) return;
    setError(null);
    start(async () => {
      const result = await deleteCageAction(cage.id);
      if (!result.ok) setError(result.error ?? 'Delete failed');
      else router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-paper p-3">
      <div className="flex items-center justify-between gap-3">
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Cage name" />
            <Button size="sm" onClick={save} disabled={pending || name.trim().length === 0}>
              <Check size={14} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setName(cage.name);
                setError(null);
              }}
              disabled={pending}
            >
              <X size={14} />
            </Button>
          </div>
        ) : (
          <>
            <div className="min-w-0">
              <span className="font-medium">{cage.name}</span>
              <span className="ml-2 text-xs text-muted">
                {cage.occupant ? (
                  <Link href={`/patients/${cage.occupant.id}`} className="text-accent hover:underline">
                    {cage.occupant.name} · {cage.occupant.species}
                  </Link>
                ) : (
                  'Empty'
                )}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={pending}>
                <Pencil size={14} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={remove}
                disabled={pending || cage.occupant !== null}
                title={cage.occupant ? 'Free the cage before deleting' : 'Delete cage'}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </>
        )}
      </div>
      {error && (
        <div role="alert" className="text-sm text-critical">
          {error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Build the page**

Create `src/app/(app)/cages/page.tsx`:

```tsx
import { AddCageForm } from '@/features/cages/components/AddCageForm';
import { CageList } from '@/features/cages/components/CageList';
import { listCagesWithOccupancy } from '@/features/cages/queries';
import { requireCageManageRole } from '@/lib/auth';

export default async function CagesPage() {
  await requireCageManageRole();
  const cages = await listCagesWithOccupancy();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Cages</h1>
        <p className="mt-1 text-sm text-muted">
          Add cages and see who’s in each. A cage frees automatically on discharge or death.
        </p>
      </div>
      <AddCageForm />
      <CageList cages={cages} />
    </div>
  );
}
```

- [ ] **Step 6: Add the Cages nav link (covers desktop sidebar + mobile drawer)**

`SideNavDrawer` renders `SideNav` with `forceVisible`, so editing `SideNav` alone covers both. In `src/components/shell/SideNav.tsx`:

Add `LayoutGrid` to the lucide import:

```ts
import { CalendarRange, FileText, History, Home, LayoutGrid, PawPrint, Plus, Trash2, Users } from 'lucide-react';
```

Inside `SideNav`, after the `const canWrite = userRole !== 'VIEWER';` line, add:

```ts
  const canManageCages = userRole === 'DOCTOR' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
```

In the `<nav>`, render a Cages link right after the `{nav.map(...)}` workspace block and before the `{isAdmin && (...)}` admin block:

```tsx
        {nav.map((it) => (
          <NavLink key={it.href} item={it} active={isActive(it.href)} />
        ))}

        {canManageCages && (
          <NavLink item={{ href: '/cages', label: 'Cages', icon: LayoutGrid }} active={isActive('/cages')} />
        )}

        {isAdmin && (
```

- [ ] **Step 7: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. Then manual smoke (optional): `pnpm dev`, sign in as a doctor, open `/cages`, add a cage, rename it, delete it; confirm a STAFF/VIEWER session is redirected away from `/cages` and sees no Cages nav link.

- [ ] **Step 8: Commit**

```bash
git add src/features/cages/actions.ts src/features/cages/components "src/app/(app)/cages" src/lib/auth.ts src/components/shell/SideNav.tsx
git commit -m "feat(cages): /cages management page, actions, guard, and nav link

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Assign a cage on create/update (TDD)

**Files:**
- Modify: `src/features/animals/schema.ts`
- Modify: `src/features/animals/service.ts`
- Test: `src/features/animals/__integration__/cage-assignment.test.ts`

- [ ] **Step 1: Add `cageId` to the animal schemas**

In `src/features/animals/schema.ts`, add to `CreateAnimalSchema` right after the `ward:` line:

```ts
  ward: z.string().max(40).optional().or(z.literal('')),
  cageId: z.string().cuid().optional().or(z.literal('')),
```

And to `UpdateAnimalSchema` right after its `ward: nullableStr(40),` line:

```ts
  ward: nullableStr(40),
  cageId: z.string().cuid().nullable().optional(),
```

- [ ] **Step 2: Write the failing integration test**

Create `src/features/animals/__integration__/cage-assignment.test.ts`:

```ts
import { createAnimal, updateAnimal } from '@/features/animals/service';
import { DOCTOR_EMAIL, actorByEmail, purgeQa, qaName } from '@/lib/__integration__/helpers';
import { ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const base = {
  species: 'Dog' as const,
  vaccination: 'NONE' as const,
  sterilized: false,
  aggressive: false,
  status: 'OBSERVATION' as const,
  contagious: false,
  testsAdvised: [] as const,
  mediaAssetIds: [] as const,
};

describe('cage assignment via animal service — integration', () => {
  beforeAll(purgeQa);
  afterAll(purgeQa);

  it('assigns a cage at admission and frees it via update(null)', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const cage = await prisma.cage.create({ data: { name: qaName('CageAdmit') } });
    const animal = await createAnimal(doctor, { ...base, name: qaName('CageAdmitPatient'), cageId: cage.id });
    expect(animal.cageId).toBe(cage.id);
    await updateAnimal(doctor, animal.id, { cageId: null });
    const after = await prisma.animal.findUnique({ where: { id: animal.id } });
    expect(after?.cageId).toBeNull();
  });

  it('refuses to assign a cage already held by another patient', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const cage = await prisma.cage.create({ data: { name: qaName('CageTaken') } });
    await createAnimal(doctor, { ...base, name: qaName('CageTakenFirst'), cageId: cage.id });
    // Second admission into the same cage → friendly ValidationError.
    await expect(
      createAnimal(doctor, { ...base, name: qaName('CageTakenSecond'), cageId: cage.id }),
    ).rejects.toBeInstanceOf(ValidationError);
    // Same via update of a second patient.
    const other = await createAnimal(doctor, { ...base, name: qaName('CageTakenOther') });
    await expect(updateAnimal(doctor, other.id, { cageId: cage.id })).rejects.toBeInstanceOf(ValidationError);
  });

  it('records cageId in the audit diff on update', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const cage = await prisma.cage.create({ data: { name: qaName('CageAudit') } });
    const animal = await createAnimal(doctor, { ...base, name: qaName('CageAuditPatient') });
    await updateAnimal(doctor, animal.id, { cageId: cage.id });
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'Animal', entityId: animal.id, action: 'update' },
      orderBy: { createdAt: 'desc' },
    });
    expect((audit?.context as { changedFields?: string[] } | null)?.changedFields).toContain('cageId');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test:integration src/features/animals/__integration__/cage-assignment.test.ts`
Expected: FAIL — `createAnimal`/`updateAnimal` ignore `cageId` (animal saved with `cageId === null`), the duplicate case does not throw, and `changedFields` lacks `cageId`.

- [ ] **Step 4: Implement cage handling + error translation in the service**

In `src/features/animals/service.ts`:

(a) Add `ValidationError` to the errors import:

```ts
import { NotFoundError, ValidationError } from '@/lib/errors';
```

(b) Add this helper near the top (after the `nz` function):

```ts
// Animal.cageId is the only unique column on Animal, so a P2002 here always
// means the chosen cage is taken; P2025 means the connected cage is gone.
// Rethrow as ValidationError so the action layer surfaces a friendly message.
function translateCageError(e: unknown): never {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = (e as { code?: string }).code;
    if (code === 'P2002') throw new ValidationError('That cage is already occupied');
    if (code === 'P2025') throw new ValidationError('Selected cage no longer exists');
  }
  throw e;
}
```

(c) In `createAnimal`, add the relation to the `data` object (right after the `ward: nz(parsed.ward),` line):

```ts
    ward: nz(parsed.ward),
    ...(parsed.cageId ? { cage: { connect: { id: parsed.cageId } } } : {}),
```

Then wrap the existing `const created = await prisma.$transaction(...)` call in a try/catch:

```ts
  let created: Awaited<ReturnType<typeof prisma.animal.create>> & {
    media: { asset: { storageKey: string; id: string } }[];
  };
  try {
    created = await prisma.$transaction(async (tx) => {
      const animal = await tx.animal.create({
        data,
        include: { testsAdvised: true, media: { include: { asset: true } } },
      });
      await writeAuditLog(tx, {
        actorId: actor.id,
        action: 'create',
        entityType: 'Animal',
        entityId: animal.id,
        after: { id: animal.id, name: animal.name, species: animal.species, status: animal.status },
      });
      return animal;
    });
  } catch (e) {
    translateCageError(e);
  }
```

(If the explicit type annotation on `created` causes friction, keep the original `const created = await ...` form but wrap it as `let created; try { created = await ... } catch (e) { translateCageError(e); }` — `translateCageError` returns `never`, so `created` is definitely assigned afterward.)

(d) In `updateAnimal`, add cage handling right after the `if (parsed.ward !== undefined) data.ward = parsed.ward;` line:

```ts
  if (parsed.ward !== undefined) data.ward = parsed.ward;
  if (parsed.cageId !== undefined)
    data.cage = parsed.cageId === null ? { disconnect: true } : { connect: { id: parsed.cageId } };
```

Then wrap the `updateAnimal` transaction in try/catch so the connect error is translated:

```ts
  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.animal.update({ where: { id: animalId }, data });
      const diff = diffAnimalFields(before, updated);
      if (diff.changedKeys.length > 0) {
        await writeAuditLog(tx, {
          actorId: actor.id,
          action: 'update',
          entityType: 'Animal',
          entityId: animalId,
          before: diff.before,
          after: diff.after,
          context: { changedFields: diff.changedKeys },
        });
      }
      return updated;
    });
  } catch (e) {
    translateCageError(e);
  }
```

(e) Add `'cageId'` to `AUDITED_ANIMAL_FIELDS` (after `'ward',`):

```ts
  'ward',
  'cageId',
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test:integration src/features/animals/__integration__/cage-assignment.test.ts`
Expected: PASS (3 tests). Then `pnpm typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/animals/schema.ts src/features/animals/service.ts src/features/animals/__integration__/cage-assignment.test.ts
git commit -m "feat(cages): assign/clear cage on animal create+update with audit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Free the cage on discharge, death, and trash (TDD)

**Files:**
- Modify: `src/features/animals/lifecycle/service.ts`
- Modify: `src/features/animals/service.ts` (`softDeleteAnimal`)
- Test: append to `src/features/animals/__integration__/cage-assignment.test.ts`

- [ ] **Step 1: Add failing tests for cage release**

Append these tests inside the `describe` block in `src/features/animals/__integration__/cage-assignment.test.ts`. Add the imports at the top of the file:

```ts
import { dischargeAnimal, recordDeath } from '@/features/animals/lifecycle/service';
import { createAnimal, softDeleteAnimal, updateAnimal } from '@/features/animals/service';
```

Tests:

```ts
  it('discharge frees the cage', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const cage = await prisma.cage.create({ data: { name: qaName('CageDischarge') } });
    const animal = await createAnimal(doctor, { ...base, name: qaName('CageDischargePatient'), cageId: cage.id });
    await dischargeAnimal(doctor, { animalId: animal.id, summary: 'Recovered', documentFileIds: [] });
    const after = await prisma.animal.findUnique({ where: { id: animal.id } });
    expect(after?.cageId).toBeNull();
  });

  it('death frees the cage', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const cage = await prisma.cage.create({ data: { name: qaName('CageDeath') } });
    const animal = await createAnimal(doctor, { ...base, name: qaName('CageDeathPatient'), cageId: cage.id });
    await recordDeath(doctor, { animalId: animal.id, causeOfDeath: 'Sepsis', documentFileIds: [] });
    const after = await prisma.animal.findUnique({ where: { id: animal.id } });
    expect(after?.cageId).toBeNull();
  });

  it('trashing (soft delete) frees the cage', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const admin = await actorByEmail((await import('@/lib/__integration__/helpers')).ADMIN_EMAIL);
    const cage = await prisma.cage.create({ data: { name: qaName('CageTrash') } });
    const animal = await createAnimal(doctor, { ...base, name: qaName('CageTrashPatient'), cageId: cage.id });
    await softDeleteAnimal(admin, animal.id);
    const after = await prisma.animal.findUnique({ where: { id: animal.id } });
    expect(after?.cageId).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:integration src/features/animals/__integration__/cage-assignment.test.ts`
Expected: FAIL on the 3 new tests — `cageId` is still set after discharge/death/trash.

- [ ] **Step 3: Free the cage in `lifecycle/service.ts`**

In `src/features/animals/lifecycle/service.ts`, add `cageId: null` to both `tx.animal.update` data blocks.

In `dischargeAnimal`:

```ts
      data: {
        status: 'DISCHARGED',
        dischargedAt: now,
        cageId: null,
        editedAt: now,
        editedById: actor.id,
      },
```

In `recordDeath`:

```ts
      data: {
        status: 'DECEASED',
        deceasedAt: now,
        cageId: null,
        editedAt: now,
        editedById: actor.id,
      },
```

- [ ] **Step 4: Free the cage in `softDeleteAnimal`**

In `src/features/animals/service.ts`, in `softDeleteAnimal`, add `cageId: null` to the update data:

```ts
      data: { deletedAt: new Date(), cageId: null, editedAt: new Date(), editedById: actor.id },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:integration src/features/animals/__integration__/cage-assignment.test.ts`
Expected: PASS (6 tests total). Then `pnpm typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/animals/lifecycle/service.ts src/features/animals/service.ts src/features/animals/__integration__/cage-assignment.test.ts
git commit -m "feat(cages): free the cage on discharge, death, and trash

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Cage picker on admission + cage on patient cards

**Files:**
- Create: `src/features/animals/components/CageSelect.tsx`
- Modify: `src/features/animals/components/AdmissionWizard/useAdmissionForm.ts`
- Modify: `src/features/animals/components/AdmissionWizard/Step3Medical.tsx`
- Modify: `src/features/animals/components/AdmissionWizard/index.tsx`
- Modify: `src/app/(app)/patients/new/page.tsx`
- Modify: `src/features/animals/queries.ts` (`listAnimals` + `AnimalListItem`)
- Modify: `src/features/animals/components/PatientCard.tsx`

- [ ] **Step 1: Build the reusable presentational picker**

Create `src/features/animals/components/CageSelect.tsx`:

```tsx
'use client';
import { Select } from '@/components/ui/Select';
import { type SelectHTMLAttributes, forwardRef } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { id: string; name: string }[];
}

// Presentational only — spreads its props onto <Select> so it works both with
// react-hook-form's register() (admission) and as a controlled value/onChange
// input (edit form).
export const CageSelect = forwardRef<HTMLSelectElement, Props>(function CageSelect(
  { options, ...rest },
  ref,
) {
  return (
    <Select ref={ref} {...rest}>
      <option value="">Unassigned</option>
      {options.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
});
```

- [ ] **Step 2: Default `cageId` in the admission form**

In `src/features/animals/components/AdmissionWizard/useAdmissionForm.ts`, add `cageId: ''` to `DEFAULTS` right after the `ward: '',` line:

```ts
  ward: '',
  cageId: '',
```

- [ ] **Step 3: Render the picker in Step 3, accept a `cages` prop**

In `src/features/animals/components/AdmissionWizard/Step3Medical.tsx`:

Update imports and props:

```tsx
import { CageSelect } from '../CageSelect';
// ...
interface Props {
  form: UseFormReturn<CreateAnimalInput>;
  cages: { id: string; name: string }[];
}

export function Step3Medical({ form, cages }: Props) {
```

Replace the existing Ward `FormField` (the `<div className="grid grid-cols-2 gap-4">` containing Injury type + Ward) so Ward sits beside a new Cage field:

```tsx
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Injury type" htmlFor="injuryType" hint="Trauma, medical, post-op, etc.">
          <Input id="injuryType" {...register('injuryType')} />
        </FormField>
        <FormField label="Cage" htmlFor="cageId" hint="Assign now or leave unassigned">
          <CageSelect id="cageId" options={cages} {...register('cageId')} />
        </FormField>
      </div>
      <FormField label="Ward (legacy)" htmlFor="ward">
        <Input id="ward" placeholder="ICU-1, Cat ward…" {...register('ward')} />
      </FormField>
```

- [ ] **Step 4: Thread `cages` through the wizard**

In `src/features/animals/components/AdmissionWizard/index.tsx`:

```tsx
export function AdmissionWizard({ cages = [] }: { cages?: { id: string; name: string }[] }) {
```

And pass it to Step 3:

```tsx
        {step === 2 && <Step3Medical form={form} cages={cages} />}
```

- [ ] **Step 5: Fetch assignable cages on the New Patient page**

Replace `src/app/(app)/patients/new/page.tsx` with:

```tsx
import { AdmissionWizard } from '@/features/animals/components/AdmissionWizard';
import { listAssignableCages } from '@/features/cages/queries';
import { requireWriteRole } from '@/lib/auth';

export default async function NewPatientPage() {
  await requireWriteRole();
  const cages = await listAssignableCages();
  return <AdmissionWizard cages={cages} />;
}
```

- [ ] **Step 6: Confirm no other caller breaks**

Run: `grep -rn "AdmissionWizard" src --include=*.tsx`
Expected: the only render sites are `patients/new/page.tsx` (now passes `cages`) and the wizard's own files. Because `cages` defaults to `[]`, any other caller still compiles and simply shows "Unassigned" only.

- [ ] **Step 7: Show the cage on patient cards (query + card)**

In `src/features/animals/queries.ts`:

Add to the `AnimalListItem` interface (after `ward: string | null;`):

```ts
  ward: string | null;
  cage: string | null;
```

Add to the `listAnimals` `select` (after `ward: true,`):

```ts
      ward: true,
      cage: { select: { name: true } },
```

Add to the `.map(...)` return object (after `ward: r.ward,`):

```ts
    ward: r.ward,
    cage: r.cage?.name ?? null,
```

In `src/features/animals/components/PatientCard.tsx`, append the cage to the species/breed/ward line:

```tsx
          {animal.species}
          {animal.breed ? ` · ${animal.breed}` : ''}
          {animal.ward ? ` · ${animal.ward}` : ''}
          {animal.cage ? ` · 🏠 ${animal.cage}` : ''}
```

- [ ] **Step 8: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. Manual smoke (optional): `pnpm dev`, start a new admission, confirm the Cage dropdown lists empty cages + "Unassigned", admit into a cage, and confirm the cage shows on the patient card in the list.

- [ ] **Step 9: Commit**

```bash
git add src/features/animals/components/CageSelect.tsx src/features/animals/components/AdmissionWizard "src/app/(app)/patients/new/page.tsx" src/features/animals/queries.ts src/features/animals/components/PatientCard.tsx
git commit -m "feat(cages): cage picker on admission + cage on patient cards

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Cage picker + display on the patient detail/edit surfaces

**Files:**
- Modify: `src/features/animals/queries.ts` (`getAnimal` include)
- Modify: `src/features/animals/components/AnimalEditForm.tsx`
- Modify: `src/app/(app)/patients/[id]/edit/page.tsx`
- Modify: `src/features/animals/components/AnimalDetail.tsx`
- Modify: `src/features/animals/components/AnimalDetailsTab.tsx`
- Modify: `src/features/animals/components/AnimalHero.tsx`

- [ ] **Step 1: Include the cage in `getAnimal`**

In `src/features/animals/queries.ts`, in `getAnimal`'s `include`, add the cage (after `createdBy: {...}`):

```ts
      createdBy: { select: { id: true, name: true } },
      cage: { select: { name: true } },
```

(`getAnimal` uses `findFirst` with `include`, so the scalar `cageId` is already returned alongside.)

- [ ] **Step 2: Add `cageId` + `cages` to the edit form**

In `src/features/animals/components/AnimalEditForm.tsx`:

(a) Import the picker:

```tsx
import { CageSelect } from './CageSelect';
```

(b) Add `cageId` to the `animal` prop type (after `ward: string | null;`) and add a `cages` prop:

```tsx
    ward: string | null;
    cageId: string | null;
    status: string;
```

```tsx
interface Props {
  animal: { /* ...existing fields... */ };
  cages: { id: string; name: string }[];
  onDone?: () => void;
  onCancel?: () => void;
}

export function AnimalEditForm({ animal, cages, onDone, onCancel }: Props) {
```

(c) Add `cageId` to the `updateAnimalAction` payload (after `ward: form.ward,`):

```ts
        ward: form.ward,
        cageId: form.cageId,
```

(d) Replace the `"Status & ward"` section with a status + cage + ward layout (hide the cage picker for discharged/deceased patients):

```tsx
      <FormSection title="Status, cage & ward">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Status">
            {(id) => (
              <Select id={id} value={form.status} onChange={(e) => onField('status', e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          {animal.status !== 'DISCHARGED' && animal.status !== 'DECEASED' && (
            <FormField label="Cage">
              {(id) => (
                <CageSelect
                  id={id}
                  options={cages}
                  value={form.cageId ?? ''}
                  onChange={(e) => onField('cageId', e.target.value || null)}
                />
              )}
            </FormField>
          )}
        </div>
        <FormField label="Ward (legacy)">
          {(id) => (
            <Input id={id} value={form.ward ?? ''} onChange={(e) => onField('ward', e.target.value)} />
          )}
        </FormField>
      </FormSection>
```

- [ ] **Step 3: Pass `cageId` + `cages` from the edit page**

In `src/app/(app)/patients/[id]/edit/page.tsx`:

```tsx
import { getAnimal, listAssignableCages } from '@/features/animals/queries';
```

Wait — `listAssignableCages` lives in the cages feature. Use:

```tsx
import { getAnimal } from '@/features/animals/queries';
import { listAssignableCages } from '@/features/cages/queries';
```

Fetch the cages and pass both new props:

```tsx
  const animal = await getAnimal(id);
  if (!animal) notFound();
  const cages = await listAssignableCages(id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Edit {animal.name}</h1>
      <AnimalEditForm
        cages={cages}
        animal={{
          id: animal.id,
          // ...existing fields...
          ward: animal.ward,
          cageId: animal.cageId,
          status: animal.status,
          // ...rest unchanged...
        }}
      />
    </div>
  );
```

- [ ] **Step 4: Thread cage data through `AnimalDetail` → tab + hero**

In `src/features/animals/components/AnimalDetail.tsx`:

(a) Import the cages query and fetch assignable cages alongside the existing `Promise.all`:

```tsx
import { listAssignableCages } from '@/features/cages/queries';
// ...
  const [animal, activities, documents] = await Promise.all([
    getAnimal(animalId),
    listActivitiesForAnimal(animalId),
    listDocumentsForAnimal(animalId),
  ]);
  if (!animal) notFound();
  const cages = await listAssignableCages(animalId);
```

(b) In the `<AnimalHero animal={{ ... }}>` prop object, add (after `ward: animal.ward,`):

```tsx
          ward: animal.ward,
          cage: animal.cage,
```

(c) In the `<AnimalDetailsTab animal={{ ... }}>` prop object, add (after `ward: animal.ward,`) and pass the `cages` prop on the component:

```tsx
            <AnimalDetailsTab
              cages={cages}
              animal={{
                // ...existing fields...
                ward: animal.ward,
                cage: animal.cage?.name ?? null,
                cageId: animal.cageId,
                status: animal.status,
                // ...rest unchanged...
              }}
            />
```

- [ ] **Step 5: Update `AnimalDetailsTab` to display cage + forward to the edit form**

In `src/features/animals/components/AnimalDetailsTab.tsx`:

(a) Extend the `Animal` interface (after `ward: string | null;`):

```ts
  ward: string | null;
  cage: string | null;
  cageId: string | null;
  status: string;
```

(b) Add `cages` to `Props` and the function signature:

```tsx
interface Props {
  animal: Animal;
  cages: { id: string; name: string }[];
}

export function AnimalDetailsTab({ animal, cages }: Props) {
```

(c) Pass `cages` + `cageId` into the embedded `<AnimalEditForm>` (add to its `animal={{...}}` object and as a prop):

```tsx
        <AnimalEditForm
          cages={cages}
          animal={{
            // ...existing fields...
            ward: animal.ward,
            cageId: animal.cageId,
            status: animal.status,
            // ...rest unchanged...
          }}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
```

(d) Add a Cage field to the read-only `DetailGrid` (right after the Ward `Field`):

```tsx
          <Field label="Ward" value={animal.ward} />
          <Field label="Cage" value={animal.cage} />
```

- [ ] **Step 6: Show the cage chip on the hero**

In `src/features/animals/components/AnimalHero.tsx`:

(a) Add to the `animal` prop type (after `ward: string | null;`):

```tsx
    ward: string | null;
    cage: { name: string } | null;
```

(b) Render the chip next to the ward chip:

```tsx
            {animal.ward && <Chip>{animal.ward}</Chip>}
            {animal.cage && <Chip>🏠 {animal.cage.name}</Chip>}
```

- [ ] **Step 7: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. Manual smoke (optional): open a patient, confirm the cage chip on the hero and the Cage row in Details; click "Edit details", reassign the cage, save, and confirm it updates. Discharge the patient and confirm the cage picker disappears on edit and the cage is freed on `/cages`.

- [ ] **Step 8: Run the full unit + integration suites**

Run: `pnpm test && pnpm test:integration`
Expected: PASS. (`pnpm test` covers the RBAC matrix; `pnpm test:integration` covers cages + cage-assignment + the existing lifecycle/animals suites, confirming nothing regressed.)

- [ ] **Step 9: Commit**

```bash
git add src/features/animals/queries.ts src/features/animals/components/AnimalEditForm.tsx "src/app/(app)/patients/[id]/edit/page.tsx" src/features/animals/components/AnimalDetail.tsx src/features/animals/components/AnimalDetailsTab.tsx src/features/animals/components/AnimalHero.tsx
git commit -m "feat(cages): cage picker + display on patient detail and edit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (completed during planning)

**Spec coverage:**
- Managed `Cage` entity + add/rename/delete/occupancy → Tasks 1, 3, 4.
- `/cages` page for DOCTOR+ (`cage.manage`, `requireCageManageRole`, nav) → Tasks 2, 4.
- DB-enforced single occupancy (`@unique cageId` + `P2002` translation) → Tasks 1, 5.
- Assignment at admission + edit next to kept Ward → Tasks 5, 7, 8.
- Auto-free on discharge/death/trash → Task 6.
- Display on hero, details tab, and cards → Tasks 7, 8.
- No seeding, Ward retained, no history table → reflected throughout (no seed task; Ward fields untouched/relabelled "legacy").

**Placeholder scan:** No TBD/TODO; every code step shows complete code or an exact old→new edit. The `<generated>`/`<timestamp>` tokens in Task 1 are Prisma-authored filenames, not authoring gaps.

**Type consistency:** `cageId` is `string | null` end-to-end; `cages` is always `{ id: string; name: string }[]`; `CageSelect` accepts `options` + standard select props in both call sites; query field names (`listAssignableCages`, `listCagesWithOccupancy`, `occupant`, `cage`) match across tasks.

**Note vs. spec:** The spec mentioned threading a `canManageCages` flag through `AppShell`/layout; the plan instead computes it locally in `SideNav` from the already-passed `userRole` (and the mobile drawer inherits it), which is strictly simpler and avoids touching `AppShell`/layout/`BottomNav`. The mobile bottom bar is intentionally left at 4 items + FAB; `/cages` is reached via the drawer.
