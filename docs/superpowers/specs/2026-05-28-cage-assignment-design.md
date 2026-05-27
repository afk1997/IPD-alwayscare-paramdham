# Cage assignment — design

**Date:** 2026-05-28
**Status:** Draft, awaiting user review
**Author:** Kaivan + Claude

## Problem

Patients (`Animal`) currently record their physical location as a free-text
`ward String?` field, typed by hand at admission and on edit. The clinic wants
a **managed list of cages** instead: a fixed set of real cages (19 today, with
more added or removed over time) that patients are assigned into, where the
system guarantees **one cage holds at most one patient at a time** and the cage
is **released automatically** when the patient leaves (discharge or death).

The free-text `ward` field will eventually be retired, but **not in this change** —
cages are introduced alongside `ward` during the transition.

## Goals

- A managed `Cage` entity: doctors/admins/super-admins can **add, rename, and
  delete** cages by name on a dedicated **`/cages`** page, and see which patient
  (if any) currently occupies each cage.
- Assign a patient to a cage at **admission** and on the patient **edit** form,
  next to the existing Ward input.
- **Database-enforced** guarantee that a single cage is never assigned to two
  patients simultaneously — race-proof, not just a UI check.
- **Automatic release** of the cage on **discharge**, **death**, and **trashing**
  (soft delete), so freed cages immediately become assignable again.
- Show the assigned cage on the patient **hero**, **details tab**, and the
  patient-list **cards**.
- Keep the existing `ward` field fully working (value, UI, search) throughout.

## Non-goals

- **Occupancy history.** We track only the *current* occupant. The audit log
  records each assignment change; there is no `CageAssignment` history table.
- **Removing the `ward` field.** UI, column, and search for `ward` stay. Its
  removal is a later, separate cleanup once cages are fully adopted.
- **Seeding cages.** The 19 cages are added by staff through the page; no seed
  data and no migration of existing `ward` strings into cages.
- **Assigning a patient from the cages page.** Assignment happens on the
  admission/edit forms only. The cages page links to the occupant's record but
  does not itself reassign.
- **Backfilling or mapping** existing `ward` text to cages.

## Design

### Data model (`prisma/schema.prisma`)

```prisma
model Cage {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  occupant  Animal?  // 0..1 — the patient currently in this cage
}
```

On `Animal`, add a nullable, **unique** back-reference:

```prisma
  // ... existing fields ...
  ward            String?
  cageId          String?  @unique
  cage            Cage?    @relation(fields: [cageId], references: [id], onDelete: Restrict)
```

- `name @unique` — two cages can't share a name (case-insensitive dedupe is
  enforced in the service; the DB unique index guards the stored value).
- `cageId @unique` on `Animal` is the core mechanism (see below).
- `onDelete: Restrict` — the DB refuses to delete a cage that still has an
  occupant, even if an application check is somehow bypassed (defense in depth).
- No `active`/`deletedAt` on `Cage`: removal is a **hard delete** (allowed only
  when empty), per the agreed scope.

### Single-occupancy enforcement & the core invariant

PostgreSQL allows **many `NULL`s** in a unique index. So with `Animal.cageId`
unique:

- Every unassigned or freed patient has `cageId = NULL` → no conflict.
- At most one patient can hold any given `cageId` → enforced by the DB.

Concurrent admits/assignments to the same empty cage resolve to exactly one
winner; the loser's write fails with Prisma error **`P2002`**, which we translate
to a friendly *"That cage is already occupied."*

**Invariant:** *a cage is held only by a patient who is currently admitted and
not trashed.* It is released (`cageId = NULL`) on discharge, death, and soft
delete. Restoring a trashed patient brings them back **without** a cage (it may
have been reused), to be reassigned manually.

### Migration

A single additive migration (`pnpm db:migrate`, name `add_cages`):

1. `CREATE TABLE "Cage"` with `name` unique index.
2. `ALTER TABLE "Animal" ADD COLUMN "cageId" TEXT;`
3. Unique index on `Animal(cageId)` + FK to `Cage(id)` `ON DELETE RESTRICT`.

No backfill, no change to existing rows, `ward` untouched.

### RBAC (`src/lib/rbac.ts`)

Add one action:

```ts
'cage.manage': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
```

`cage.manage` governs create/rename/delete of cages (the `/cages` page).
Note this is **broader** than the admin-only pages (Users/Audit/Trash) — doctors
are included, per requirement.

**Assignment is not a new action.** A cage is just another field of the patient:
it is set at admission under the existing `animal.create` permission (so a STAFF
member admitting a patient can pick a cage, exactly as they set `ward` today) and
changed on edit under `animal.update` (DOCTOR+). This keeps assignment permissions
identical to how `ward` already behaves.

### Auth guard (`src/lib/auth.ts`)

Add `requireCageManageRole()` mirroring `requireAdminRole()`, but allowing
DOCTOR as well:

```ts
export async function requireCageManageRole(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'DOCTOR' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') redirect('/');
  return user;
}
```

### Routing & navigation

- New page **`src/app/(app)/cages/page.tsx`** (server component) — calls
  `requireCageManageRole()`, fetches `listCagesWithOccupancy()`, renders the
  add-form + list. It lives at top level (`/cages`), **not** under `/admin`,
  because doctors must reach it.
- **Nav:** add a "Cages" item (lucide `LayoutGrid` icon) to `SideNav.tsx` and
  `BottomNav.tsx`, shown only to DOCTOR/ADMIN/SUPER_ADMIN. The `(app)/layout.tsx`
  already computes role flags for `AppShell`; add a `canManageCages` flag
  (`role ∈ {DOCTOR, ADMIN, SUPER_ADMIN}`) and thread it to the nav components
  alongside the existing `isAdmin`.

### `cages` feature folder

New `src/features/cages/`, mirroring the `users` feature.

**`schema.ts`**
```ts
const cageName = z.string().trim().min(1, 'Name is required').max(40);
export const CreateCageSchema = z.object({ name: cageName });
export const RenameCageSchema = z.object({ id: z.string().cuid(), name: cageName });
export const DeleteCageSchema = z.object({ id: z.string().cuid() });
```

**`service.ts`** (each asserts `cage.manage`, writes an audit row, runs in a tx)
- `createCage(actor, input)` — reject a name that case-insensitively matches an
  existing cage (`ValidationError('A cage with that name already exists')`).
- `renameCage(actor, input)` — `NotFoundError` if absent; same dup check
  excluding itself.
- `deleteCage(actor, input)` — `NotFoundError` if absent; re-check `occupant`
  is null and throw `ValidationError('Cage is occupied — free it first')` if not;
  then delete. (The `onDelete: Restrict` FK is the backstop.)

**`queries.ts`**
- `listCagesWithOccupancy()` → all cages ordered by `name`, each with
  `occupant: { id, name, species, status } | null`.
- `listAssignableCages(animalId?)` → cages assignable right now: those with no
  occupant, **plus** the cage currently held by `animalId` (so the edit form can
  show and keep the patient's own cage). Returns `{ id, name }[]`.

**`actions.ts`** (`'use server'`) — `createCageAction` / `renameCageAction` /
`deleteCageAction`, each: resolve actor, call the service, on success
`revalidatePath('/cages')` + `revalidateTag('animals')`, and return
`{ ok: boolean; error?: string }` (same shape as `lifecycle/actions.ts`).

**`components/`**
- `AddCageForm.tsx` (client) — name input + Save, calls `createCageAction`,
  shows inline error.
- `CageList.tsx` (client) — one row per cage: name (inline-editable → 
  `renameCageAction`), occupancy (patient name linking to `/patients/[id]`, or
  "Empty"), and a **Delete** button enabled only when `occupant` is null
  (`deleteCageAction`, with confirm).

### Assigning a patient to a cage

**Schemas (`src/features/animals/schema.ts`)**
- `CreateAnimalSchema`: add `cageId: z.string().cuid().optional().or(z.literal(''))`.
- `UpdateAnimalSchema`: add `cageId: z.string().cuid().nullable().optional()`
  (so the picker can clear the assignment with `null`).

**Service (`src/features/animals/service.ts`)**
- `createAnimal`: set `cage: parsed.cageId ? { connect: { id: parsed.cageId } } : undefined`
  in the create data.
- `updateAnimal`: `if (parsed.cageId !== undefined) data.cage = parsed.cageId === null
  ? { disconnect: true } : { connect: { id: parsed.cageId } };`
- Add `'cageId'` to `AUDITED_ANIMAL_FIELDS` so assignment changes appear in the
  per-field audit diff.
- Translate Prisma connect failures **in the service**, rethrowing them as
  `ValidationError` (which `animals/actions.ts` already maps to `{ ok, error }`,
  so no Prisma-specific code leaks into the action layer): `P2002` → *"That cage
  is already occupied."*; `P2025` → *"Selected cage no longer exists."*

**Picker UI**
- New `CageSelect.tsx` — a **presentational** `<select>`
  (`value` / `onChange` / `options: { id, name }[]`) with an "Unassigned" (empty)
  choice. The two forms differ in how they manage state, so the picker stays
  dumb and each form wires it up:
- **Admission** — `patients/new/page.tsx` fetches `listAssignableCages()` and
  passes it to `<AdmissionWizard cages=… />` (currently propless);
  `AdmissionWizard/Step3Medical.tsx` wires `CageSelect` to **react-hook-form**
  (`register('cageId')`, `useAdmissionForm` default `cageId: ''`) next to the
  existing Ward input.
- **Edit** — `patients/[id]/edit/page.tsx` fetches
  `listAssignableCages(animalId)` and passes it in; `AnimalEditForm.tsx`'s
  "Status & ward" section is retitled **"Status, cage & ward"**. The edit form is
  **controlled** (not RHF), so extend its form state with `cageId: string | null`
  and wire `CageSelect` via `form.cageId` / `onField('cageId', …)`, exactly like
  its `ward` input. The `animal` prop type gains `cageId` (and `cage`).
- **Edge rule:** the edit form **hides `CageSelect` for `DISCHARGED`/`DECEASED`
  patients** (those are guaranteed cage-free by the release logic). If such a
  patient is re-admitted by changing status and saving, the picker appears on
  the next load.

### Freeing the cage

Set `cageId: null` inside the existing transactions — no new transactions:
- `dischargeAnimal` and `recordDeath` (`lifecycle/service.ts`): add `cageId: null`
  to the `tx.animal.update` data.
- `softDeleteAnimal` (`animals/service.ts`): add `cageId: null` to its update.
- `ward` text is **left untouched** in every case — only the cage is released.

### Display surfaces

Animal queries that feed the cards/hero/detail must include the cage name:
add `cage: { select: { name: true } }` to the relevant `select`/`include` in
`src/features/animals/queries.ts`.
- `AnimalHero.tsx` — add a cage `<Chip>` beside the ward chip
  (`animal.cage?.name`).
- `AnimalDetailsTab.tsx` — add `<Field label="Cage" value={animal.cage?.name} />`.
- `PatientCard.tsx` — append the cage name next to the existing ward text.

## Edge cases & error handling

| Case | Behavior |
|------|----------|
| Two patients race for one empty cage | DB unique index → second write `P2002` → *"That cage is already occupied."* The form reloads with a fresh available list. |
| Delete an occupied cage | Blocked in service (occupant check) and by `onDelete: Restrict`. *"Cage is occupied — free it first."* |
| Duplicate / rename-collision cage name | Rejected, case-insensitive. *"A cage with that name already exists."* |
| Assign a cage that was just deleted | `connect` → `P2025` → *"Selected cage no longer exists."* |
| Discharged/deceased patient | Released to `cageId = NULL`; picker hidden on edit. |
| Trash then restore a patient | Trash frees the cage; restore returns the patient with no cage (reassign manually). |

## Testing

- **`src/lib/__tests__/rbac.test.ts`** — `cage.manage` allowed for DOCTOR/ADMIN/
  SUPER_ADMIN, denied for STAFF/VIEWER.
- **`src/features/cages/__integration__/cages.test.ts`** — create rejects
  duplicate (case-insensitive) names; `deleteCage` blocked when occupied,
  succeeds when empty; rename collision rejected.
- **Single-occupancy** — assign two different patients to the same cage; the
  second fails with `P2002`. Reassigning frees the first cage.
- **Release** — discharge, death, and soft-delete each set `cageId = NULL`;
  the freed cage is then assignable again.
- **`src/features/animals/__integration__`** — `cageId` round-trips through
  create/update and appears in the audit diff.

## File-by-file change summary

**New**
- `prisma/migrations/<ts>_add_cages/` (generated)
- `src/app/(app)/cages/page.tsx`
- `src/features/cages/{schema,service,queries,actions}.ts`
- `src/features/cages/components/{AddCageForm,CageList}.tsx`
- `src/features/cages/__integration__/cages.test.ts`
- `src/features/animals/components/CageSelect.tsx`

**Edited**
- `prisma/schema.prisma` — `Cage` model, `Animal.cageId` + relation.
- `src/lib/rbac.ts` — `cage.manage` action.
- `src/lib/auth.ts` — `requireCageManageRole()`.
- `src/components/shell/{AppShell,SideNav,BottomNav}.tsx` + `src/app/(app)/layout.tsx`
  — "Cages" nav item + `canManageCages` flag.
- `src/features/animals/schema.ts` — `cageId` on create/update schemas.
- `src/features/animals/service.ts` — connect/disconnect cage; free on soft
  delete; `cageId` in `AUDITED_ANIMAL_FIELDS`.
- `src/features/animals/actions.ts` — map `P2002`/`P2025` to friendly messages.
- `src/features/animals/lifecycle/service.ts` — free cage on discharge/death.
- `src/features/animals/queries.ts` — include `cage.name`.
- `src/features/animals/components/AnimalEditForm.tsx` — cage picker in
  "Status, cage & ward"; hidden for discharged/deceased.
- `src/features/animals/components/AdmissionWizard/Step3Medical.tsx` +
  `useAdmissionForm.ts` — cage picker + default.
- `src/features/animals/components/{AnimalHero,AnimalDetailsTab,PatientCard}.tsx`
  — show cage.
- `src/app/(app)/patients/new/page.tsx` + `patients/[id]/edit/page.tsx` —
  fetch assignable cages and pass to the forms.
- `src/lib/__tests__/rbac.test.ts` — `cage.manage` cases.
