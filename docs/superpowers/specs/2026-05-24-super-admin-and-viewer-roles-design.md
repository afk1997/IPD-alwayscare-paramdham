# Super-admin and viewer roles — design

**Date:** 2026-05-24
**Status:** Draft, awaiting user review
**Author:** Kaivan + Claude

## Problem

The clinic needs two new roles on top of `STAFF / DOCTOR / ADMIN`:

1. **`SUPER_ADMIN`** — an "owner" tier above ADMIN. Has every ADMIN power plus owner-only powers (assigning SUPER_ADMIN, assigning VIEWER, broader destructive operations). The `kaivan@arham.org` account becomes the bootstrap SUPER_ADMIN.
2. **`VIEWER`** — read-only access to operational data (patients, activities, documents, reports). No write capability anywhere. No access to admin tooling (Users, Audit Log, Trash).

Both new roles must be **excluded from the "Logged by" dropdown** on the activity form, since they don't perform clinical work on patients in person — they observe (VIEWER) or administer (SUPER_ADMIN).

## Goals

- Add `SUPER_ADMIN` and `VIEWER` to the existing role system without breaking the 3 legacy roles.
- Bootstrap `kaivan@arham.org` to `SUPER_ADMIN` in the same migration that introduces the enum value.
- Filter `SUPER_ADMIN` and `VIEWER` out of the "Logged by" activity dropdown via a single source-of-truth change.
- Hide write-action buttons across the UI for `VIEWER`, in addition to the mandatory server-side RBAC enforcement.
- Restrict who can assign the two new roles: only `SUPER_ADMIN` can grant/remove `SUPER_ADMIN` or `VIEWER`.
- Broaden the "last active admin" safeguard so it counts `SUPER_ADMIN` + `ADMIN` together as admin-equivalent.

## Non-goals

- Re-organising the existing RBAC action set or splitting any existing action into finer-grained pieces.
- Adding new audit-log fields (the existing actor/before/after schema covers role changes).
- Adding a separate "owner can wipe data" scripted operation. Wipe scripts remain ad-hoc tooling outside RBAC.
- Localising new role labels.
- Adding visual polish (badge colour) decisions beyond "match the existing palette".

## Design

### Data model

**`prisma/schema.prisma`**:

```prisma
enum Role {
  STAFF
  DOCTOR
  ADMIN
  SUPER_ADMIN
  VIEWER
}
```

**Migration** — Postgres requires `ALTER TYPE … ADD VALUE` to commit before the new value can be referenced by another statement in the same transaction. Two-step migration:

1. `migrations/<ts>_add_super_admin_viewer_roles/migration.sql`:
   ```sql
   ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
   ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VIEWER';
   ```
2. `migrations/<ts+1>_bootstrap_super_admin/migration.sql`:
   ```sql
   UPDATE "User" SET role = 'SUPER_ADMIN' WHERE email = 'kaivan@arham.org';
   ```

Splitting into two files guarantees the enum value is committed before the `UPDATE` runs. Both migrations are idempotent (`IF NOT EXISTS` and email match).

### RBAC

**`src/lib/rbac.ts`**:

```ts
export type Role = 'STAFF' | 'DOCTOR' | 'ADMIN' | 'SUPER_ADMIN' | 'VIEWER';
```

Update `PERMISSIONS`:

| Action | STAFF | DOCTOR | ADMIN | SUPER_ADMIN | VIEWER |
|---|---|---|---|---|---|
| `animal.create` | ✓ | ✓ | ✓ | ✓ | — |
| `animal.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `animal.update` | — | ✓ | ✓ | ✓ | — |
| `animal.delete` | — | — | ✓ | ✓ | — |
| `animal.restore` | — | — | ✓ | ✓ | — |
| `animal.discharge` | — | ✓ | ✓ | ✓ | — |
| `animal.death` | — | ✓ | ✓ | ✓ | — |
| `activity.create` | ✓ | ✓ | ✓ | ✓ | — |
| `activity.create.clinical` | — | ✓ | ✓ | ✓ | — |
| `activity.update.any` | — | ✓ | ✓ | ✓ | — |
| `activity.delete` | — | ✓ | ✓ | ✓ | — |
| `activity.restore` | — | — | ✓ | ✓ | — |
| `document.create` | ✓ | ✓ | ✓ | ✓ | — |
| `document.delete` | — | ✓ | ✓ | ✓ | — |
| `document.restore` | — | — | ✓ | ✓ | — |
| `document.read.all` | — | — | ✓ | ✓ | — |
| `user.manage` | — | — | ✓ | ✓ | — |
| `audit.read.all` | — | — | ✓ | ✓ | — |
| `trash.read` | — | — | ✓ | ✓ | — |

Rule of thumb: every existing `ADMIN` entry also gets `SUPER_ADMIN`. `VIEWER` appears only in `animal.read` (the one read action gated through `can()`). Activity / document reads aren't currently in the PERMISSIONS table — they're page-level reads visible to any authenticated user, which is fine for VIEWER.

### User service guards

**`src/features/users/service.ts`** — three new guard clauses on top of the existing two (`H3-s` self-role-change, `H2-s` last-admin):

```ts
// In inviteUser:
if (
  (parsed.role === 'SUPER_ADMIN' || parsed.role === 'VIEWER') &&
  actor.role !== 'SUPER_ADMIN'
) {
  throw new RbacError(`only SUPER_ADMIN can assign ${parsed.role}`);
}

// In updateUser, after the existing self-role guard:
const touchesRestrictedRole =
  parsed.role !== undefined &&
  (parsed.role !== before.role) &&
  (parsed.role === 'SUPER_ADMIN' ||
   parsed.role === 'VIEWER' ||
   before.role === 'SUPER_ADMIN' ||
   before.role === 'VIEWER');
if (touchesRestrictedRole && actor.role !== 'SUPER_ADMIN') {
  throw new RbacError('only SUPER_ADMIN can change SUPER_ADMIN or VIEWER assignments');
}
```

**Broaden the last-admin guard.** The current rule fires when demoting/deactivating the last `ADMIN`. New rule: count `SUPER_ADMIN` + `ADMIN` together as admin-equivalent.

```ts
const wouldRemoveAdminEquivalent =
  (before.role === 'ADMIN' || before.role === 'SUPER_ADMIN') &&
  ((parsed.role !== undefined && parsed.role !== 'ADMIN' && parsed.role !== 'SUPER_ADMIN') ||
   (parsed.active !== undefined && parsed.active === false));
if (wouldRemoveAdminEquivalent) {
  const others = await prisma.user.count({
    where: {
      role: { in: ['ADMIN', 'SUPER_ADMIN'] },
      active: true,
      id: { not: parsed.id },
    },
  });
  if (others === 0) {
    throw new RbacError('cannot remove the last active admin');
  }
}
```

### Activity "Logged by" dropdown filter

**`src/features/users/queries.ts`**:

```ts
async function _listActiveUsersRaw(): Promise<ActiveUserLite[]> {
  return prisma.user.findMany({
    where: { active: true, role: { in: ['STAFF', 'DOCTOR', 'ADMIN'] } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}
```

Single chokepoint: `listActiveUsers` is consumed only by `(app)/layout.tsx` → `ActiveUsersProvider` → `ActivityForm` + `ActivityEditFields`. The admin user-list page uses the separate `listUsers` query (unfiltered), so SUPER_ADMIN and VIEWER remain visible in user management.

**Historical activities**: `ActivityEditFields` already handles a `byName` referring to an inactive/hidden user via the `__inactive__` placeholder (current line 54). If an activity was logged before its author switched roles, the timeline still shows their name and the edit form preserves it; only the dropdown options exclude restricted roles. No new code needed.

### Role assignment UI

**`src/features/users/schema.ts`**:

```ts
export const ROLES = ['STAFF', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN', 'VIEWER'] as const;
export const ROLE_LABELS: Record<Role, string> = {
  STAFF: 'Floor staff',
  DOCTOR: 'Doctor',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super admin',
  VIEWER: 'Viewer (read-only)',
};
```

**`InviteUserForm.tsx` + `EditUserForm.tsx`** — show only the roles the current actor can assign. Server still enforces; this is UI consistency.

```ts
const assignableRoles: readonly Role[] = currentUserRole === 'SUPER_ADMIN'
  ? ROLES
  : (['STAFF', 'DOCTOR', 'ADMIN'] as const);
```

`currentUserRole` is read off the session/`Actor`; the wrapping page server component passes it down.

**Edge case** — an ADMIN editing a user whose current role is SUPER_ADMIN or VIEWER. The role select's `value` would point at a role not in `assignableRoles`. Handling: when the target user's `role` is outside `assignableRoles`, render the role field as disabled with a helper line "Only Super admin can change this role." The Save button stays enabled so the ADMIN can still edit the name/active fields.

**`RoleBadge.tsx`** gets two new branches:
- `SUPER_ADMIN` — distinct from ADMIN (e.g. violet, or a star icon).
- `VIEWER` — muted/grey to signal read-only.

Exact colours match the existing palette in `RoleBadge.tsx`; the design system already defines the relevant tokens.

### VIEWER UI hides

VIEWER's role is exposed to client components by extending the existing `ActiveUsersProvider` payload:

```ts
interface ActiveUsersContextValue {
  users: ActiveUserLite[];
  currentUserName: string;
  currentUserRole: Role; // NEW
}
```

Helper: `export const isWriteRole = (role: Role) => role !== 'VIEWER';`

**Locations to hide write controls when `currentUserRole === 'VIEWER'`:**

| Surface | File(s) | Element(s) |
|---|---|---|
| Sidebar navigation | `src/components/shell/SideNav.tsx` (or equivalent) | "Admit patient" quick-action; admin section group |
| Today page | `src/app/(app)/today/page.tsx` + Today client component | Quick-action buttons (Log activity / Admit) |
| Patient detail header | `src/features/animals/components/PatientHeader.tsx` (or equivalent toolbar) | Edit / Discharge / Death record / Delete |
| Patient detail timeline | activity tab component | "Log activity" CTA(s) |
| Patient detail documents | documents tab component | Add document / Upload |
| ActivitySheet | `src/features/activities/components/ActivitySheet.tsx` | Edit + Delete actions |

**Server-side defenses for VIEWER (defense in depth):**
- New-admission and new-activity routes (`/patients/new`, `/activity/new`) redirect to `/` when `actor.role === 'VIEWER'`.
- Admin pages (`/admin/users`, `/admin/audit-log`, `/admin/trash`) are already RBAC-gated via `assertCan` for their respective actions — VIEWER fails those naturally. Confirm during implementation that each page's server component calls `assertCan` unconditionally.

The discovery work for the exact file paths above happens in the implementation plan; the design fixes the *what* (which write surfaces to hide) and the *how* (`currentUserRole` from context + `isWriteRole` helper).

### Bootstrap order

The migration promotes `kaivan@arham.org` to `SUPER_ADMIN`. After deploy:
1. `kaivan@arham.org` signs in and sees the SUPER_ADMIN-only role options in InviteUser / EditUser.
2. They can assign SUPER_ADMIN to any additional owners and VIEWER to read-only collaborators.
3. ADMINs can continue day-to-day user management for STAFF/DOCTOR/ADMIN.

## Testing

### Unit / table tests

- **RBAC matrix test** (new): assert the full 5 × 19 `can(actor, action)` table matches the spec table above. Single test, table-driven.

### Integration tests (`src/features/users/__integration__/`)

- ADMIN inviting a SUPER_ADMIN → `RbacError`.
- ADMIN inviting a VIEWER → `RbacError`.
- SUPER_ADMIN inviting a SUPER_ADMIN → succeeds.
- SUPER_ADMIN inviting a VIEWER → succeeds.
- ADMIN attempting to change another user from VIEWER → DOCTOR → `RbacError`.
- SUPER_ADMIN promoting STAFF → SUPER_ADMIN → succeeds.
- Last-active admin guard: with one SUPER_ADMIN + zero ADMINs, deactivating the SUPER_ADMIN throws.
- Last-active admin guard: with one ADMIN + one SUPER_ADMIN, deactivating the ADMIN succeeds (because the SUPER_ADMIN remains).
- `listActiveUsers` returns STAFF + DOCTOR + ADMIN only, excluding SUPER_ADMIN and VIEWER.
- VIEWER cannot edit an activity they previously authored (covers the case where a former DOCTOR is demoted to VIEWER). Asserts server-side RBAC doesn't fall through to an "edit own" path.
- VIEWER cannot soft-delete a patient, create an activity, upload a document, or restore from trash — one assertion per write category.

### QA-deep probe

`scripts/qa-deep/qa-deep-viewer-walkthrough.ts`: signs in as a seeded VIEWER, walks Today → Patients list → a patient detail → Activity sheet → Documents tab → attempts `/admin/users` (expect redirect) → `/patients/new` (expect redirect). Snapshots which write CTAs are visible and asserts none are.

## Rollout

1. Single PR containing: enum migration + bootstrap migration + RBAC changes + schema/labels + queries filter + UI button-hiding + tests.
2. Pre-merge: run integration suite locally against the Neon dev DB (`pnpm test:integration`).
3. Merge → Vercel deploy auto-runs prisma migrate on boot (or via deploy step — verify existing config).
4. Post-deploy: verify `kaivan@arham.org` is now SUPER_ADMIN; create one VIEWER as a smoke test.

## Open questions

None. All design points were settled during brainstorming.
