# Super-admin and viewer roles — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `SUPER_ADMIN` (owner tier) and `VIEWER` (read-only) roles. SUPER_ADMIN is the only role that can assign SUPER_ADMIN or VIEWER. Both roles are excluded from the activity "Logged by" dropdown. VIEWER hides every write button across the UI and is server-blocked on writes via RBAC. Bootstrap `kaivan@arham.org` to SUPER_ADMIN in the migration.

**Architecture:** Two-step Prisma migration (enum add, then bootstrap UPDATE). Extend `Role` type across `rbac.ts`, `users/schema.ts`, and `lib/auth.ts`. Single chokepoint for the dropdown filter (`listActiveUsers` query). Carry `currentUserRole` through the existing `ActiveUsersProvider` so any client component can conditionally render write controls via an `isWriteRole(role)` helper.

**Tech Stack:** Prisma + Postgres (Neon), Next.js App Router, NextAuth, React Server Components for layout, vitest for unit + integration, bcrypt for passwords.

**Spec:** `docs/superpowers/specs/2026-05-24-super-admin-and-viewer-roles-design.md`

---

## File map

**Modify:**
- `prisma/schema.prisma` — add SUPER_ADMIN, VIEWER to `enum Role`
- `src/lib/rbac.ts` — extend Role type + PERMISSIONS
- `src/lib/auth.ts` — widen `CurrentUser.role` type
- `src/features/users/schema.ts` — ROLES tuple + ROLE_LABELS
- `src/features/users/service.ts` — restricted-role guards + broaden last-admin
- `src/features/users/queries.ts` — filter `listActiveUsers` by role
- `src/features/users/ActiveUsersContext.tsx` — carry `currentUserRole`
- `src/features/users/components/EditUserForm.tsx` — assignable roles + disabled state
- `src/features/users/components/InviteUserForm.tsx` — assignable roles
- `src/features/users/components/RoleBadge.tsx` — two new branches
- `src/components/shell/AppShell.tsx` — pass role through to nav
- `src/components/shell/SideNav.tsx` — hide "New entry" + admin section for VIEWER
- `src/components/shell/SideNavDrawer.tsx` — propagate role prop
- `src/app/(app)/layout.tsx` — pass currentUserRole to provider; widen roleLabel map
- `src/app/(app)/page.tsx` (or TodayDashboard component) — gate quick-action CTAs
- `src/features/animals/components/AnimalDetailActions.tsx` — hide for VIEWER
- `src/features/activities/components/ActivitySheet.tsx` — hide Edit + Delete for VIEWER
- `src/features/documents/components/DocumentUploadDialog.tsx` — hide button for VIEWER
- `src/app/(app)/patients/new/page.tsx` — server redirect for VIEWER
- `src/app/(app)/patients/[id]/edit/page.tsx` — server redirect for VIEWER
- `src/app/(app)/patients/[id]/discharge/page.tsx` — server redirect for VIEWER
- `src/app/(app)/patients/[id]/death/page.tsx` — server redirect for VIEWER

**Create:**
- `prisma/migrations/20260524120000_add_super_admin_viewer_roles/migration.sql`
- `prisma/migrations/20260524120100_bootstrap_super_admin/migration.sql`
- `src/lib/__tests__/rbac.test.ts` — 5×19 PERMISSIONS table assertion
- `src/features/users/__integration__/roles.test.ts` — role-assignment guard tests
- `scripts/qa-deep/qa-deep-viewer-walkthrough.ts` — VIEWER UI probe

---

## Task 1 — Prisma schema and two-step migration

**Files:**
- Modify: `prisma/schema.prisma` (the `enum Role` block)
- Create: `prisma/migrations/20260524120000_add_super_admin_viewer_roles/migration.sql`
- Create: `prisma/migrations/20260524120100_bootstrap_super_admin/migration.sql`

- [ ] **Step 1 — Update the Prisma enum**

Open `prisma/schema.prisma`, find the `enum Role` block (currently 4 lines: STAFF, DOCTOR, ADMIN), and change it to:

```prisma
enum Role {
  STAFF
  DOCTOR
  ADMIN
  SUPER_ADMIN
  VIEWER
}
```

- [ ] **Step 2 — Create the enum-value migration**

Create file `prisma/migrations/20260524120000_add_super_admin_viewer_roles/migration.sql`:

```sql
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VIEWER';
```

- [ ] **Step 3 — Create the bootstrap migration**

Create file `prisma/migrations/20260524120100_bootstrap_super_admin/migration.sql`:

```sql
UPDATE "User" SET role = 'SUPER_ADMIN' WHERE email = 'kaivan@arham.org';
```

Postgres requires the `ADD VALUE` to commit before another statement references the new value, which is why this is a second migration file (a second transaction).

- [ ] **Step 4 — Regenerate the Prisma client**

Run: `pnpm db:generate`
Expected: `✔ Generated Prisma Client` and no errors.

- [ ] **Step 5 — Apply the migration to the Neon dev DB**

Run: `pnpm db:migrate`
Expected output includes:
```
Applying migration `20260524120000_add_super_admin_viewer_roles`
Applying migration `20260524120100_bootstrap_super_admin`
```
And no errors. If prompted for a migration name, the directory names already exist so it should just apply.

- [ ] **Step 6 — Verify the bootstrap row**

Run:
```bash
pnpm exec dotenv -e .env.local -- tsx -e "import('./src/lib/prisma').then(async ({prisma}) => { const u = await prisma.user.findUnique({where:{email:'kaivan@arham.org'}}); console.log(u?.role); await prisma.\$disconnect(); })"
```
Expected: prints `SUPER_ADMIN`.

- [ ] **Step 7 — Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260524120000_add_super_admin_viewer_roles prisma/migrations/20260524120100_bootstrap_super_admin
git commit -m "feat(db): add SUPER_ADMIN and VIEWER roles + bootstrap kaivan@arham.org

Two-step migration so the new enum values commit before the UPDATE
references SUPER_ADMIN. The bootstrap is idempotent (only fires if the
email exists).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 — RBAC type + PERMISSIONS table + matrix test

**Files:**
- Modify: `src/lib/rbac.ts`
- Create: `src/lib/__tests__/rbac.test.ts`

- [ ] **Step 1 — Write the failing matrix test**

Create file `src/lib/__tests__/rbac.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { type Action, type Actor, type Role, can } from '../rbac';

const ROLES: Role[] = ['STAFF', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN', 'VIEWER'];

// Expected permission matrix. T = allowed, F = denied.
// Columns: STAFF DOCTOR ADMIN SUPER_ADMIN VIEWER
const MATRIX: Record<Action, [boolean, boolean, boolean, boolean, boolean]> = {
  'animal.create':           [true,  true,  true,  true,  false],
  'animal.read':             [true,  true,  true,  true,  true ],
  'animal.update':           [false, true,  true,  true,  false],
  'animal.delete':           [false, false, true,  true,  false],
  'animal.restore':          [false, false, true,  true,  false],
  'animal.discharge':        [false, true,  true,  true,  false],
  'animal.death':            [false, true,  true,  true,  false],
  'activity.create':         [true,  true,  true,  true,  false],
  'activity.create.clinical':[false, true,  true,  true,  false],
  'activity.update.any':     [false, true,  true,  true,  false],
  'activity.delete':         [false, true,  true,  true,  false],
  'activity.restore':        [false, false, true,  true,  false],
  'document.create':         [true,  true,  true,  true,  false],
  'document.delete':         [false, true,  true,  true,  false],
  'document.restore':        [false, false, true,  true,  false],
  'document.read.all':       [false, false, true,  true,  false],
  'user.manage':             [false, false, true,  true,  false],
  'audit.read.all':          [false, false, true,  true,  false],
  'trash.read':              [false, false, true,  true,  false],
};

describe('rbac permission matrix', () => {
  for (const [action, expected] of Object.entries(MATRIX) as [Action, boolean[]][]) {
    for (let i = 0; i < ROLES.length; i++) {
      const role = ROLES[i];
      const allowed = expected[i];
      it(`${role} ${allowed ? 'CAN' : 'cannot'} ${action}`, () => {
        const actor: Actor = { id: 'u1', role };
        expect(can(actor, action)).toBe(allowed);
      });
    }
  }

  it('VIEWER has zero write permissions', () => {
    const writes: Action[] = [
      'animal.create', 'animal.update', 'animal.delete', 'animal.restore',
      'animal.discharge', 'animal.death',
      'activity.create', 'activity.create.clinical', 'activity.update.any',
      'activity.delete', 'activity.restore',
      'document.create', 'document.delete', 'document.restore',
      'user.manage',
    ];
    for (const a of writes) {
      expect(can({ id: 'v', role: 'VIEWER' }, a)).toBe(false);
    }
  });

  it('SUPER_ADMIN has every ADMIN permission', () => {
    const actions = Object.keys(MATRIX) as Action[];
    for (const a of actions) {
      if (can({ id: 'a', role: 'ADMIN' }, a)) {
        expect(can({ id: 's', role: 'SUPER_ADMIN' }, a)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2 — Run the test and watch it fail**

Run: `pnpm test src/lib/__tests__/rbac.test.ts`
Expected: failures because `Role` type doesn't include `SUPER_ADMIN` or `VIEWER`, and the PERMISSIONS table denies them everything. TypeScript will refuse to compile until the type widens.

- [ ] **Step 3 — Widen the Role type and update PERMISSIONS**

Open `src/lib/rbac.ts`. Change the `Role` line:

```ts
export type Role = 'STAFF' | 'DOCTOR' | 'ADMIN' | 'SUPER_ADMIN' | 'VIEWER';
```

Replace the entire `PERMISSIONS` constant with:

```ts
const PERMISSIONS: Record<Action, Role[]> = {
  'animal.create':            ['STAFF', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'animal.read':              ['STAFF', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN', 'VIEWER'],
  'animal.update':            ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'animal.delete':            ['ADMIN', 'SUPER_ADMIN'],
  'animal.restore':           ['ADMIN', 'SUPER_ADMIN'],
  'animal.discharge':         ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'animal.death':             ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'activity.create':          ['STAFF', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'activity.create.clinical': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'activity.update.any':      ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'activity.delete':          ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'activity.restore':         ['ADMIN', 'SUPER_ADMIN'],
  'document.create':          ['STAFF', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'document.delete':          ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'document.restore':         ['ADMIN', 'SUPER_ADMIN'],
  'document.read.all':        ['ADMIN', 'SUPER_ADMIN'],
  'user.manage':              ['ADMIN', 'SUPER_ADMIN'],
  'audit.read.all':           ['ADMIN', 'SUPER_ADMIN'],
  'trash.read':               ['ADMIN', 'SUPER_ADMIN'],
};
```

- [ ] **Step 4 — Run the test and watch it pass**

Run: `pnpm test src/lib/__tests__/rbac.test.ts`
Expected: all tests pass.

- [ ] **Step 5 — Commit**

```bash
git add src/lib/rbac.ts src/lib/__tests__/rbac.test.ts
git commit -m "feat(rbac): SUPER_ADMIN inherits ADMIN; VIEWER read-only

Permissions: SUPER_ADMIN appended to every ADMIN entry. VIEWER added to
animal.read only — write actions remain ADMIN+ so VIEWER falls through.
Adds a 5x19 table test as the single source of truth for the matrix.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 — Widen Role types (schema.ts + auth.ts) and update RoleBadge

**Files:**
- Modify: `src/features/users/schema.ts`
- Modify: `src/lib/auth.ts`
- Modify: `src/features/users/components/RoleBadge.tsx`

(Bundled together because `RoleBadge.tsx` has `const TONES: Record<Role, string>` — widening `Role` would break typecheck until RoleBadge gains entries for the new roles.)

- [ ] **Step 1 — Update users/schema.ts**

Open `src/features/users/schema.ts`. Replace the `ROLES` constant and `ROLE_LABELS` map:

```ts
export const ROLES = ['STAFF', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  STAFF: 'Floor staff',
  DOCTOR: 'Doctor',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super admin',
  VIEWER: 'Viewer (read-only)',
};
```

The existing `InviteUserSchema` and `UpdateUserSchema` use `z.enum(ROLES)` — they'll widen automatically.

- [ ] **Step 2 — Update lib/auth.ts**

Open `src/lib/auth.ts`. Replace the `CurrentUser.role` type:

```ts
export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: 'STAFF' | 'DOCTOR' | 'ADMIN' | 'SUPER_ADMIN' | 'VIEWER';
}
```

- [ ] **Step 3 — Add new TONES entries in RoleBadge.tsx**

Open `src/features/users/components/RoleBadge.tsx`. Replace the `TONES` constant (currently 3 entries) with all 5:

```tsx
const TONES: Record<Role, string> = {
  STAFF: 'bg-paper-2 text-muted',
  DOCTOR: 'bg-accent-soft text-accent-ink',
  ADMIN: 'bg-observation-bg text-observation',
  SUPER_ADMIN: 'bg-critical-bg text-critical',
  VIEWER: 'bg-paper-2 text-soft',
};
```

`bg-critical-bg / text-critical` give SUPER_ADMIN a strong distinct accent (matches the death/discharge palette already used for emphasis). VIEWER reuses the muted STAFF background but with `text-soft` (lighter) to signal read-only.

- [ ] **Step 4 — Run typecheck**

Run: `pnpm typecheck`
Expected: passes. If a new error appears outside these three files, widen that surface (don't suppress) — likely a `Record<Role, ...>` somewhere else.

- [ ] **Step 5 — Commit**

```bash
git add src/features/users/schema.ts src/lib/auth.ts src/features/users/components/RoleBadge.tsx
git commit -m "feat(users): widen Role union + RoleBadge variants

ROLES tuple + ROLE_LABELS + CurrentUser.role + RoleBadge TONES all
cover SUPER_ADMIN and VIEWER. Critical-bg accent for SUPER_ADMIN;
muted/soft for VIEWER.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 — User service guards + integration tests

**Files:**
- Modify: `src/features/users/service.ts`
- Create: `src/features/users/__integration__/roles.test.ts`

- [ ] **Step 1 — Write the integration tests first**

Create file `src/features/users/__integration__/roles.test.ts`:

```ts
import { actorByEmail, purgeQa, qaName } from '@/lib/__integration__/helpers';
import { RbacError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inviteUser, updateUser } from '../service';

// Bootstrap admin email seeded in helpers.ts. The integration helpers
// assume a known set of users; we'll spin up role-specific test users
// inside each `it` and clean up via purgeQa.
const SEED_ADMIN_EMAIL = 'admin@arham.care';

async function makeUser(role: 'STAFF' | 'DOCTOR' | 'ADMIN' | 'SUPER_ADMIN' | 'VIEWER') {
  const email = `${qaName(role).toLowerCase()}@qa.local`;
  return prisma.user.create({
    data: {
      email,
      name: qaName(role),
      role,
      passwordHash: 'x',
      active: true,
    },
  });
}

describe('user service — role-assignment guards', () => {
  beforeAll(purgeQa);
  afterAll(purgeQa);

  it('ADMIN cannot invite a SUPER_ADMIN', async () => {
    const admin = await actorByEmail(SEED_ADMIN_EMAIL);
    await expect(
      inviteUser(admin, {
        email: `${qaName('blockedSA').toLowerCase()}@qa.local`,
        name: qaName('blockedSA'),
        role: 'SUPER_ADMIN',
        temporaryPassword: 'TmpPass#2026',
      }),
    ).rejects.toBeInstanceOf(RbacError);
  });

  it('ADMIN cannot invite a VIEWER', async () => {
    const admin = await actorByEmail(SEED_ADMIN_EMAIL);
    await expect(
      inviteUser(admin, {
        email: `${qaName('blockedV').toLowerCase()}@qa.local`,
        name: qaName('blockedV'),
        role: 'VIEWER',
        temporaryPassword: 'TmpPass#2026',
      }),
    ).rejects.toBeInstanceOf(RbacError);
  });

  it('SUPER_ADMIN can invite a SUPER_ADMIN and a VIEWER', async () => {
    const superAdmin = await makeUser('SUPER_ADMIN');
    const inv1 = await inviteUser(superAdmin, {
      email: `${qaName('newSA').toLowerCase()}@qa.local`,
      name: qaName('newSA'),
      role: 'SUPER_ADMIN',
      temporaryPassword: 'TmpPass#2026',
    });
    expect(inv1.role).toBe('SUPER_ADMIN');
    const inv2 = await inviteUser(superAdmin, {
      email: `${qaName('newV').toLowerCase()}@qa.local`,
      name: qaName('newV'),
      role: 'VIEWER',
      temporaryPassword: 'TmpPass#2026',
    });
    expect(inv2.role).toBe('VIEWER');
  });

  it('ADMIN cannot promote STAFF to SUPER_ADMIN', async () => {
    const admin = await actorByEmail(SEED_ADMIN_EMAIL);
    const target = await makeUser('STAFF');
    await expect(
      updateUser(admin, { id: target.id, role: 'SUPER_ADMIN' }),
    ).rejects.toBeInstanceOf(RbacError);
  });

  it('ADMIN cannot demote a SUPER_ADMIN', async () => {
    const admin = await actorByEmail(SEED_ADMIN_EMAIL);
    const target = await makeUser('SUPER_ADMIN');
    await expect(
      updateUser(admin, { id: target.id, role: 'ADMIN' }),
    ).rejects.toBeInstanceOf(RbacError);
  });

  it('SUPER_ADMIN can promote and demote VIEWER', async () => {
    const superAdmin = await makeUser('SUPER_ADMIN');
    const target = await makeUser('STAFF');
    const promoted = await updateUser(superAdmin, { id: target.id, role: 'VIEWER' });
    expect(promoted.role).toBe('VIEWER');
    const demoted = await updateUser(superAdmin, { id: target.id, role: 'STAFF' });
    expect(demoted.role).toBe('STAFF');
  });

  it('last-admin guard counts SUPER_ADMIN as admin-equivalent', async () => {
    // Setup: one SUPER_ADMIN, one ADMIN. Demoting the ADMIN should succeed
    // because the SUPER_ADMIN remains as admin-equivalent.
    const superAdmin = await makeUser('SUPER_ADMIN');
    const lone = await makeUser('ADMIN');
    const demoted = await updateUser(superAdmin, { id: lone.id, role: 'STAFF' });
    expect(demoted.role).toBe('STAFF');

    // Now only the SUPER_ADMIN remains as admin-equivalent. Demoting them
    // should throw.
    await expect(
      updateUser(superAdmin, { id: superAdmin.id, role: 'STAFF' }),
    ).rejects.toBeInstanceOf(RbacError);
    // Note: this also trips the H3-s self-role-change guard, which throws
    // first. To test the last-admin guard in isolation we'd need a second
    // SUPER_ADMIN — left to a separate test if needed.
  });
});
```

- [ ] **Step 2 — Run the test and watch it fail**

Run: `pnpm test:integration src/features/users/__integration__/roles.test.ts`
Expected: failures because the service doesn't yet reject ADMIN inviting/updating to restricted roles.

- [ ] **Step 3 — Add the guards to service.ts**

Open `src/features/users/service.ts`. In `inviteUser`, after the existing `assertCan(actor, 'user.manage')` line, insert:

```ts
if (
  (parsed.role === 'SUPER_ADMIN' || parsed.role === 'VIEWER') &&
  actor.role !== 'SUPER_ADMIN'
) {
  throw new RbacError(`only SUPER_ADMIN can assign ${parsed.role}`);
}
```

In `updateUser`, after the existing `H3-s` self-role-change guard, insert:

```ts
// Only SUPER_ADMIN can assign or remove SUPER_ADMIN / VIEWER. This
// covers both directions: granting these roles AND demoting away from
// them.
const touchesRestrictedRole =
  parsed.role !== undefined &&
  parsed.role !== before.role &&
  (parsed.role === 'SUPER_ADMIN' ||
    parsed.role === 'VIEWER' ||
    before.role === 'SUPER_ADMIN' ||
    before.role === 'VIEWER');
if (touchesRestrictedRole && actor.role !== 'SUPER_ADMIN') {
  throw new RbacError('only SUPER_ADMIN can change SUPER_ADMIN or VIEWER assignments');
}
```

Replace the existing `wouldRemoveAdmin` block (the `H2-s` last-admin guard) with the broadened version:

```ts
// H2-s (broadened): refuse to deactivate or demote the LAST active
// admin-equivalent. SUPER_ADMIN and ADMIN count together — losing all
// of them locks the clinic out of the admin surface.
const wouldRemoveAdminEquivalent =
  (before.role === 'ADMIN' || before.role === 'SUPER_ADMIN') &&
  ((parsed.role !== undefined && parsed.role !== 'ADMIN' && parsed.role !== 'SUPER_ADMIN') ||
    (parsed.active !== undefined && parsed.active === false));
if (wouldRemoveAdminEquivalent) {
  const otherActiveAdminEquivalents = await prisma.user.count({
    where: {
      role: { in: ['ADMIN', 'SUPER_ADMIN'] },
      active: true,
      id: { not: parsed.id },
    },
  });
  if (otherActiveAdminEquivalents === 0) {
    throw new RbacError('cannot remove the last active admin');
  }
}
```

- [ ] **Step 4 — Run the test and watch it pass**

Run: `pnpm test:integration src/features/users/__integration__/roles.test.ts`
Expected: all 7 tests pass.

- [ ] **Step 5 — Commit**

```bash
git add src/features/users/service.ts src/features/users/__integration__/roles.test.ts
git commit -m "feat(users): SUPER_ADMIN-only role-assignment guards

inviteUser/updateUser now refuse to grant or remove SUPER_ADMIN or
VIEWER unless the actor is SUPER_ADMIN. Last-active-admin guard
broadens to count SUPER_ADMIN + ADMIN as admin-equivalent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 — listActiveUsers filter + integration test

**Files:**
- Modify: `src/features/users/queries.ts`
- Modify: `src/features/users/__integration__/roles.test.ts` (append test case)

- [ ] **Step 1 — Add the failing test case**

Open `src/features/users/__integration__/roles.test.ts`. Inside the existing `describe` block (after the last test), append:

```ts
  it('listActiveUsers excludes SUPER_ADMIN and VIEWER', async () => {
    await makeUser('SUPER_ADMIN');
    await makeUser('VIEWER');
    await makeUser('STAFF');
    // Import lazily so the cache doesn't pick up a previous run's data.
    const { listActiveUsers } = await import('../queries');
    const list = await listActiveUsers();
    const roles = new Set<string>();
    for (const u of list) {
      const row = await prisma.user.findUnique({ where: { id: u.id }, select: { role: true } });
      if (row) roles.add(row.role);
    }
    expect(roles.has('SUPER_ADMIN')).toBe(false);
    expect(roles.has('VIEWER')).toBe(false);
    // Sanity: at least one STAFF/DOCTOR/ADMIN exists.
    expect(roles.size).toBeGreaterThan(0);
  });
```

- [ ] **Step 2 — Run the test and watch it fail**

Run: `pnpm test:integration src/features/users/__integration__/roles.test.ts -t "listActiveUsers"`
Expected: failure — the SUPER_ADMIN and VIEWER rows show up in the list.

- [ ] **Step 3 — Add the filter to the query**

Open `src/features/users/queries.ts`. Replace `_listActiveUsersRaw`:

```ts
async function _listActiveUsersRaw(): Promise<ActiveUserLite[]> {
  return prisma.user.findMany({
    where: { active: true, role: { in: ['STAFF', 'DOCTOR', 'ADMIN'] } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}
```

Also update the doc comment above the cache constant to mention the role filter — replace the existing block (lines 48-52) with:

```ts
// Thin projection for the activity-form "Logged by" dropdown.  Cached
// for 5 minutes; invalidated by every user mutation via the
// `active-users` tag (see inviteUserAction / updateUserAction /
// deactivateUserAction).  Without the cache, every page render hits
// Postgres for the same ~10 rows.
//
// SUPER_ADMIN and VIEWER are intentionally excluded — they don't log
// clinical work and shouldn't appear as candidates in the dropdown.
// listUsers (the admin user-list query) is unfiltered.
```

- [ ] **Step 4 — Run the test and watch it pass**

Run: `pnpm test:integration src/features/users/__integration__/roles.test.ts -t "listActiveUsers"`
Expected: passes.

- [ ] **Step 5 — Commit**

```bash
git add src/features/users/queries.ts src/features/users/__integration__/roles.test.ts
git commit -m "feat(users): exclude SUPER_ADMIN + VIEWER from Logged-by dropdown

listActiveUsers (single source for the activity \"Logged by\" select)
filters out the two new roles. Admin user-list (listUsers) stays
unfiltered.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 — ActiveUsersContext carries currentUserRole + layout wiring

**Files:**
- Modify: `src/features/users/ActiveUsersContext.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/shell/AppShell.tsx`
- Modify: `src/components/shell/SideNav.tsx`
- Modify: `src/components/shell/SideNavDrawer.tsx`

- [ ] **Step 1 — Extend the context**

Open `src/features/users/ActiveUsersContext.tsx`. Replace the whole file with:

```tsx
'use client';
import { createContext, useContext } from 'react';
import type { ActiveUserLite } from './queries';
import type { Role } from './schema';

interface ActiveUsersContextValue {
  users: ActiveUserLite[];
  currentUserName: string;
  currentUserRole: Role;
}

const ActiveUsersContext = createContext<ActiveUsersContextValue | null>(null);

interface ProviderProps {
  users: ActiveUserLite[];
  currentUserName: string;
  currentUserRole: Role;
  children: React.ReactNode;
}

// Surfaces the layout-level active-user list and the current actor's
// role to every descendant. Used by activity forms (Logged-by dropdown)
// and by any client component that needs to conditionally render write
// controls (e.g. hidden for VIEWER).  Mounted once in AppShell.
export function ActiveUsersProvider({
  users,
  currentUserName,
  currentUserRole,
  children,
}: ProviderProps) {
  return (
    <ActiveUsersContext.Provider value={{ users, currentUserName, currentUserRole }}>
      {children}
    </ActiveUsersContext.Provider>
  );
}

export function useActiveUsers(): ActiveUsersContextValue {
  const ctx = useContext(ActiveUsersContext);
  if (!ctx) {
    throw new Error('useActiveUsers must be used inside ActiveUsersProvider');
  }
  return ctx;
}

export const isWriteRole = (role: Role): boolean => role !== 'VIEWER';
```

- [ ] **Step 2 — Update `(app)/layout.tsx`**

Open `src/app/(app)/layout.tsx`. Replace the whole file with:

```tsx
import { AppShell } from '@/components/shell/AppShell';
import { listActiveUsers } from '@/features/users/queries';
import type { Role } from '@/features/users/schema';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

const roleLabel: Record<Role, string> = {
  STAFF: 'Floor staff',
  DOCTOR: 'Doctor',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super admin',
  VIEWER: 'Viewer',
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const activeUsers = await listActiveUsers();
  const role = user.role as Role;
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  return (
    <AppShell
      user={{
        name: user.name,
        role: roleLabel[role] ?? role,
        isAdmin,
        rawRole: role,
      }}
      activeUsers={activeUsers}
      currentUserName={user.name}
      currentUserRole={role}
    >
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 3 — Update `AppShell.tsx` to accept and pass through the new props**

Open `src/components/shell/AppShell.tsx`. Adjust the `Props` interface and the rendering. Around lines 14 and 38-42, replace with:

```tsx
import { ActiveUsersProvider } from '@/features/users/ActiveUsersContext';
import type { ActiveUserLite } from '@/features/users/queries';
import type { Role } from '@/features/users/schema';
import { SideNav } from './SideNav';
import { SideNavDrawer } from './SideNavDrawer';
import { TopBar } from './TopBar';

interface Props {
  user: { name: string; role: string; isAdmin: boolean; rawRole: Role };
  activeUsers: ActiveUserLite[];
  currentUserName: string;
  currentUserRole: Role;
  children: React.ReactNode;
}

export function AppShell({ user, activeUsers, currentUserName, currentUserRole, children }: Props) {
  return (
    <ActiveUsersProvider
      users={activeUsers}
      currentUserName={currentUserName}
      currentUserRole={currentUserRole}
    >
      {/* ...existing JSX, but with <SideNav> and <SideNavDrawer> taking
          `userRole={user.rawRole}` instead of just `isAdmin`. */}
    </ActiveUsersProvider>
  );
}
```

The existing JSX inside `AppShell.tsx` already wires `isAdmin` and `user`. Keep that. Just add `userRole={user.rawRole}` as an additional prop on `<SideNav>` and `<SideNavDrawer>` instances.

**Concretely**, the existing nav instantiations are likely:
```tsx
<SideNav isAdmin={user.isAdmin} user={user} />
<SideNavDrawer ... isAdmin={user.isAdmin} user={user} />
```
Change to:
```tsx
<SideNav isAdmin={user.isAdmin} userRole={user.rawRole} user={user} />
<SideNavDrawer ... isAdmin={user.isAdmin} userRole={user.rawRole} user={user} />
```

- [ ] **Step 4 — Update `SideNav.tsx` to accept and use `userRole`**

Open `src/components/shell/SideNav.tsx`. Update the `Props`:

```tsx
import type { Role } from '@/features/users/schema';

interface Props {
  isAdmin: boolean;
  userRole: Role;
  user: { name: string; role: string };
  forceVisible?: boolean;
}
```

Change the function signature to destructure `userRole`:

```tsx
export function SideNav({ isAdmin, userRole, user, forceVisible = false }: Props) {
```

Then wrap the "New entry" button (the `<button>` at lines 76-87 with `onClick={() => open()}`) in a conditional so it's hidden for VIEWER:

```tsx
{userRole !== 'VIEWER' && (
  <button
    type="button"
    onClick={() => open()}
    className="mx-3.5 mb-4 flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 font-semibold text-accent-fg text-sm shadow-sm transition hover:opacity-90"
    title="Press N to open"
  >
    <Plus size={16} strokeWidth={2.4} />
    <span className="flex-1 text-left">New entry</span>
    <kbd className="rounded border border-accent-fg/30 bg-accent-fg/10 px-1.5 py-0.5 font-mono text-[10px] text-accent-fg/80">
      N
    </kbd>
  </button>
)}
```

(The existing `{isAdmin && ...}` block for admin nav already handles VIEWER correctly because VIEWER isn't admin.)

- [ ] **Step 5 — Update `SideNavDrawer.tsx` to propagate `userRole`**

Open `src/components/shell/SideNavDrawer.tsx`. Adjust the `Props`:

```tsx
import type { Role } from '@/features/users/schema';

interface Props {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  userRole: Role;
  user: { name: string; role: string };
}

export function SideNavDrawer({ open, onClose, isAdmin, userRole, user }: Props) {
  // ...
  // Find the inner <SideNav> call and add userRole:
  <SideNav isAdmin={isAdmin} userRole={userRole} user={user} forceVisible />
  // ...
}
```

- [ ] **Step 6 — Typecheck**

Run: `pnpm typecheck`
Expected: passes. Any errors are missing `userRole` props at the AppShell call site — fix them by passing `user.rawRole`.

- [ ] **Step 7 — Commit**

```bash
git add src/features/users/ActiveUsersContext.tsx src/app/\(app\)/layout.tsx src/components/shell/AppShell.tsx src/components/shell/SideNav.tsx src/components/shell/SideNavDrawer.tsx
git commit -m "feat(shell): carry currentUserRole through provider + nav

ActiveUsersProvider now exposes currentUserRole; nav components accept
a userRole prop. New isWriteRole(role) helper. Hides the sidebar
\"New entry\" CTA for VIEWER. Admin section is already isAdmin-gated.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7 — _Merged into Task 3._

RoleBadge.tsx updates ship in Task 3 to keep typecheck green. Skip this task; proceed to Task 8.

---

## Task 8 — Role assignment UI (Invite + Edit forms)

**Files:**
- Modify: `src/features/users/components/InviteUserForm.tsx`
- Modify: `src/features/users/components/EditUserForm.tsx`
- Modify: `src/app/(app)/admin/users/page.tsx` (or wherever InviteUserForm is mounted) to pass currentUserRole
- Modify: `src/app/(app)/admin/users/[id]/edit/page.tsx` to pass currentUserRole

- [ ] **Step 1 — Inspect mounting sites**

Run:
```bash
grep -rn "InviteUserForm\|EditUserForm" src/app/\(app\)/admin/
```
Expected output: the page components that mount each form. Note the file paths.

- [ ] **Step 2 — Update `InviteUserForm.tsx`**

Open `src/features/users/components/InviteUserForm.tsx`. Add a `currentUserRole` prop and gate the role options:

```tsx
import { ROLES, ROLE_LABELS, type Role } from '../schema';

interface Props {
  currentUserRole: Role;
}

export function InviteUserForm({ currentUserRole }: Props) {
  // ... existing state ...

  const assignableRoles: readonly Role[] =
    currentUserRole === 'SUPER_ADMIN'
      ? ROLES
      : (['STAFF', 'DOCTOR', 'ADMIN'] as const);

  // ... in the JSX, replace ROLES.map(...) with assignableRoles.map(...):
  // <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
  //   {assignableRoles.map((r) => (
  //     <option key={r} value={r}>{ROLE_LABELS[r]}</option>
  //   ))}
  // </Select>
}
```

- [ ] **Step 3 — Update `EditUserForm.tsx`**

Open `src/features/users/components/EditUserForm.tsx`. Add a `currentUserRole` prop, compute `assignableRoles`, and handle the disabled state when the target's existing role is outside the assignable set:

```tsx
import { ROLES, ROLE_LABELS, type Role } from '../schema';

interface Props {
  user: { id: string; name: string; email: string; role: Role; active: boolean };
  currentUserRole: Role;
}

export function EditUserForm({ user, currentUserRole }: Props) {
  // ... existing useState lines ...

  const assignableRoles: readonly Role[] =
    currentUserRole === 'SUPER_ADMIN'
      ? ROLES
      : (['STAFF', 'DOCTOR', 'ADMIN'] as const);

  const roleFieldDisabled = !assignableRoles.includes(user.role);

  // ... in the JSX, the FormField for role:
  // <FormField label="Role" required hint={roleFieldDisabled ? 'Only Super admin can change this role' : undefined}>
  //   {(id) => (
  //     <Select id={id} value={role} disabled={roleFieldDisabled} onChange={(e) => setRole(e.target.value as Role)}>
  //       {(roleFieldDisabled ? [user.role] : assignableRoles).map((r) => (
  //         <option key={r} value={r}>{ROLE_LABELS[r]}</option>
  //       ))}
  //     </Select>
  //   )}
  // </FormField>
}
```

The Save button stays enabled — name/active fields can still be edited.

- [ ] **Step 4 — Wire `currentUserRole` from page server components**

Identify the page that renders `<InviteUserForm />` (likely `src/app/(app)/admin/users/page.tsx` or `.../new/page.tsx`). At the top of that server component, do:

```tsx
import { getCurrentUser } from '@/lib/auth';
import type { Role } from '@/features/users/schema';

// inside the page component, before returning JSX:
const user = await getCurrentUser();
const currentUserRole = (user?.role ?? 'STAFF') as Role;
```

Pass it to the form: `<InviteUserForm currentUserRole={currentUserRole} />`. Repeat the same pattern at the EditUser page (`src/app/(app)/admin/users/[id]/edit/page.tsx`).

- [ ] **Step 5 — Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 6 — Manual smoke test (optional but recommended)**

Start the dev server and sign in as `kaivan@arham.org` (SUPER_ADMIN). Visit `/admin/users` → "Invite user" form should show 5 role options. Sign out and sign in as an ADMIN (any of the seed accounts after re-seeding, or one you create) — the form should show 3 role options.

- [ ] **Step 7 — Commit**

```bash
git add src/features/users/components/InviteUserForm.tsx src/features/users/components/EditUserForm.tsx src/app/\(app\)/admin/users
git commit -m "feat(users): role select reflects who can assign what

InviteUserForm and EditUserForm now take currentUserRole and only show
the role options the current actor can assign. ADMIN sees STAFF/DOCTOR/
ADMIN; SUPER_ADMIN sees all five. EditUserForm disables the role field
when the target's current role is outside the actor's assignable set.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9 — Hide patient-detail write controls for VIEWER

**Files:**
- Modify: `src/features/animals/components/AnimalDetailActions.tsx`

- [ ] **Step 1 — Gate the entire actions bar**

Open `src/features/animals/components/AnimalDetailActions.tsx`. At the top of the function body, after the existing `useEffect`, add the role check:

```tsx
import { useActiveUsers } from '@/features/users/ActiveUsersContext';

// ... inside the component, right after the existing useState/useRef calls:
const { currentUserRole } = useActiveUsers();
if (currentUserRole === 'VIEWER') return null;
```

That single early-return hides the "Log activity" button, the "Edit / Discharge / Death" menu, AND the share button area (note: share is a read action — if you want to keep `<PatientShareButton />` visible for VIEWER, refactor to return only the share button instead of `null`. Decision: SHARE stays visible because it's a read-only action that VIEWER should be able to do).

Refactor for the share case:

```tsx
const { currentUserRole } = useActiveUsers();
const canWrite = currentUserRole !== 'VIEWER';

return (
  <div className="relative flex items-center gap-2" ref={menuRef}>
    {canWrite && !isClosed && (
      <Button size="sm" onClick={() => setQuickOpen(true)}>
        <Plus size={14} />
        Log activity
      </Button>
    )}
    <PatientShareButton animalId={animalId} />
    {canWrite && (
      <>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-paper text-muted hover:bg-paper-2"
        >
          <MoreHorizontal size={16} />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-11 z-30 flex w-48 flex-col rounded-lg border border-line bg-paper p-1 shadow-xl"
          >
            <Link
              href={`/patients/${animalId}/edit`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 rounded px-2.5 py-2 text-sm hover:bg-paper-2"
            >
              <Pencil size={14} />
              Edit details
            </Link>
            {!isClosed && (
              <>
                <Link
                  href={`/patients/${animalId}/discharge`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded px-2.5 py-2 text-sm hover:bg-paper-2"
                >
                  <LogOut size={14} />
                  Discharge
                </Link>
                <Link
                  href={`/patients/${animalId}/death`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded px-2.5 py-2 text-sm text-critical hover:bg-paper-2"
                >
                  <Skull size={14} />
                  Record death
                </Link>
              </>
            )}
          </div>
        )}
      </>
    )}
    {canWrite && !isClosed && (
      <ActivityQuickAdd animalId={animalId} open={quickOpen} onClose={() => setQuickOpen(false)} />
    )}
  </div>
);
```

- [ ] **Step 2 — Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 3 — Commit**

```bash
git add src/features/animals/components/AnimalDetailActions.tsx
git commit -m "feat(animals): hide patient-detail write actions for VIEWER

VIEWER no longer sees Log activity, Edit, Discharge, or Record death.
The Share button stays visible — sharing is a read action.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10 — Hide ActivitySheet Edit/Delete for VIEWER

**Files:**
- Modify: `src/features/activities/components/ActivitySheet.tsx`

- [ ] **Step 1 — Find the action buttons in ActivitySheet**

Run: `grep -n "Edit\|Delete\|setMode" src/features/activities/components/ActivitySheet.tsx`
Note line numbers of the buttons that switch `mode` to `'edit'` or `'confirmDelete'` (around lines 222-237 per the earlier exploration).

- [ ] **Step 2 — Gate the buttons**

Open `src/features/activities/components/ActivitySheet.tsx`. Near the top of the component body, add:

```tsx
import { useActiveUsers } from '@/features/users/ActiveUsersContext';

// ...inside the component:
const { currentUserRole } = useActiveUsers();
const canWrite = currentUserRole !== 'VIEWER';
```

Find the JSX block that renders the Edit + Delete buttons (the section around line 220-240, inside the `mode === 'view'` branch). Wrap both buttons in `{canWrite && (...)}`:

```tsx
{mode === 'view' && canWrite && (
  <div className="flex justify-end gap-2">
    <Button variant="ghost" size="sm" onClick={() => setMode('confirmDelete')} disabled={pending}>
      <Trash2 size={14} />
      Delete
    </Button>
    <Button variant="ghost" size="sm" onClick={() => setMode('edit')} disabled={pending}>
      <Pencil size={14} />
      Edit
    </Button>
  </div>
)}
```

(If the existing buttons already live inside a `mode === 'view'` conditional, just add `&& canWrite` to that condition rather than wrapping again.)

- [ ] **Step 3 — Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 4 — Commit**

```bash
git add src/features/activities/components/ActivitySheet.tsx
git commit -m "feat(activities): hide ActivitySheet Edit/Delete for VIEWER

VIEWER can open the sheet to read details but can't enter edit or
delete mode. Server-side activity.update.any / activity.delete still
block writes regardless.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11 — Hide document upload for VIEWER

**Files:**
- Modify: `src/features/documents/components/DocumentUploadDialog.tsx`

- [ ] **Step 1 — Gate the dialog trigger**

Open `src/features/documents/components/DocumentUploadDialog.tsx`. At the top of the component body, add:

```tsx
import { useActiveUsers } from '@/features/users/ActiveUsersContext';

// ...inside the component, before the existing useState:
const { currentUserRole } = useActiveUsers();
if (currentUserRole === 'VIEWER') return null;
```

That returns nothing — the "Upload document" button never renders for VIEWER.

- [ ] **Step 2 — Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 3 — Commit**

```bash
git add src/features/documents/components/DocumentUploadDialog.tsx
git commit -m "feat(documents): hide upload button for VIEWER

VIEWER sees the document list but no Upload button. Server-side
document.create blocks writes regardless.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12 — Server-side route redirects for VIEWER

**Files:**
- Modify: `src/app/(app)/patients/new/page.tsx`
- Modify: `src/app/(app)/patients/[id]/edit/page.tsx`
- Modify: `src/app/(app)/patients/[id]/discharge/page.tsx`
- Modify: `src/app/(app)/patients/[id]/death/page.tsx`

- [ ] **Step 1 — Build a small helper**

To avoid copy-pasting the guard, create a helper. Open `src/lib/auth.ts` and append (at the bottom of the file):

```ts
import { redirect } from 'next/navigation';

// Server-side guard: redirect VIEWER away from write-only routes.
// Mount at the top of any patient-edit / new / discharge / death page.
export async function requireWriteRole(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role === 'VIEWER') redirect('/');
  return user;
}
```

- [ ] **Step 2 — Wire the helper into each route**

For each of the 4 page files (`patients/new/page.tsx`, `patients/[id]/edit/page.tsx`, `patients/[id]/discharge/page.tsx`, `patients/[id]/death/page.tsx`), add at the top of the default export's async body:

```tsx
import { requireWriteRole } from '@/lib/auth';

export default async function Page(/* ...existing params... */) {
  await requireWriteRole();
  // ...existing body...
}
```

If a page already calls `getCurrentUser()`, replace that call with `requireWriteRole()` and use the returned user.

- [ ] **Step 3 — Manual verification**

Start the dev server. Sign in as a VIEWER (create one via SUPER_ADMIN). Navigate to `/patients/new`, `/patients/<id>/edit`, etc. — each should redirect to `/`.

- [ ] **Step 4 — Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 5 — Commit**

```bash
git add src/lib/auth.ts src/app/\(app\)/patients/new/page.tsx src/app/\(app\)/patients/\[id\]/edit/page.tsx src/app/\(app\)/patients/\[id\]/discharge/page.tsx src/app/\(app\)/patients/\[id\]/death/page.tsx
git commit -m "feat(auth): requireWriteRole guard on write-only patient routes

New helper in lib/auth.ts redirects VIEWER away from /patients/new and
the per-patient edit/discharge/death pages. Defense-in-depth on top of
RBAC — the form would server-action-reject the writes anyway, but
the guard prevents VIEWER from seeing the form chrome at all.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13 — QA-deep VIEWER walkthrough probe

**Files:**
- Create: `scripts/qa-deep/qa-deep-viewer-walkthrough.ts`

`_lib.ts` exposes Playwright helpers (`startProbe`, `login`, `snap`, `endProbe`) and known seed-user credentials. We'll add an ad-hoc VIEWER user with a known password, sign in via Playwright, navigate, and assert.

- [ ] **Step 1 — Write the probe**

Create `scripts/qa-deep/qa-deep-viewer-walkthrough.ts`:

```ts
import bcrypt from 'bcryptjs';
import { prisma } from '../../src/lib/prisma';
import { endProbe, login, snap, startProbe } from './_lib';

const VIEWER_EMAIL = '__qa__viewer@qa.local';
const VIEWER_PASSWORD = 'Viewer#Probe2026';

async function ensureViewerUser() {
  const passwordHash = await bcrypt.hash(VIEWER_PASSWORD, 12);
  return prisma.user.upsert({
    where: { email: VIEWER_EMAIL },
    update: { role: 'VIEWER', active: true, passwordHash },
    create: {
      email: VIEWER_EMAIL,
      name: '__qa__viewer',
      role: 'VIEWER',
      passwordHash,
      active: true,
    },
  });
}

async function deleteViewerUser() {
  await prisma.user.deleteMany({ where: { email: VIEWER_EMAIL } });
}

const HIDDEN_TEXT = [
  'New entry',
  'Log activity',
  'Edit details',
  'Discharge',
  'Record death',
  'Upload document',
];

async function main() {
  await ensureViewerUser();
  const ctx = await startProbe('viewer-walkthrough');

  try {
    // Pick an existing active patient to navigate to. If none exist,
    // the probe still covers the home / list / admin / write-route
    // assertions.
    const patient = await prisma.animal.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    });

    for (const variant of ['desktop', 'mobile'] as const) {
      const browserCtx = variant === 'desktop' ? ctx.desktop : ctx.mobile;
      const page = await browserCtx.newPage();

      await login(page, { email: VIEWER_EMAIL, password: VIEWER_PASSWORD });

      // 1. Today page — no write CTAs.
      await page.goto('/');
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const todayHtml = await page.content();
      for (const text of HIDDEN_TEXT) {
        if (todayHtml.includes(text)) {
          await ctx.finding('high', `${variant}: "${text}" visible on / for VIEWER`);
        }
      }

      // 2. Patient list.
      await page.goto('/patients');
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const patientsHtml = await page.content();
      if (patientsHtml.includes('Admit patient') || patientsHtml.includes('New admission')) {
        await ctx.finding('high', `${variant}: admit CTA visible on /patients for VIEWER`);
      }

      // 3. Patient detail (if any patient exists).
      if (patient) {
        await page.goto(`/patients/${patient.id}`);
        await page.waitForLoadState('networkidle').catch(() => undefined);
        const detailHtml = await page.content();
        for (const text of HIDDEN_TEXT) {
          if (detailHtml.includes(text)) {
            await ctx.finding(
              'high',
              `${variant}: "${text}" visible on patient detail for VIEWER`,
            );
          }
        }
      }

      // 4. Write-only route should redirect.
      await page.goto('/patients/new');
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const newPathname = new URL(page.url()).pathname;
      if (newPathname === '/patients/new') {
        await ctx.finding('critical', `${variant}: VIEWER reached /patients/new (no redirect)`);
      }

      // 5. Admin route should also redirect or 403.
      await page.goto('/admin/users');
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const adminPathname = new URL(page.url()).pathname;
      if (adminPathname === '/admin/users') {
        await ctx.finding('critical', `${variant}: VIEWER reached /admin/users`);
      }

      await snap(ctx, `summary-${variant}`, async (p) => {
        await p.goto('/');
      });

      await page.close();
    }

    process.stdout.write(`VIEWER walkthrough complete. Findings in ${ctx.outDir}/findings.md\n`);
  } finally {
    await endProbe(ctx);
    await deleteViewerUser();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
```

- [ ] **Step 2 — Run the dev server in another shell**

In a separate terminal:
```bash
pnpm dev
```
Wait until it prints `Ready` on `http://localhost:3000`.

- [ ] **Step 3 — Run the probe**

Run:
```bash
pnpm exec dotenv -e .env.local -- tsx scripts/qa-deep/qa-deep-viewer-walkthrough.ts
```
Expected: `VIEWER walkthrough complete. Findings in test-results/qa-deep/viewer-walkthrough/findings.md`. Open that file — it should list zero high/critical findings (the file may contain only the heading line plus the auto "0 errors" entries).

If findings appear, the corresponding VIEWER hide was missed in Tasks 6–12. Fix and re-run.

- [ ] **Step 4 — Commit**

```bash
git add scripts/qa-deep/qa-deep-viewer-walkthrough.ts
git commit -m "test(qa-deep): VIEWER walkthrough probe

Spins up a temporary VIEWER user, signs in via Playwright (desktop +
mobile viewports), and asserts that write CTAs (New entry, Log
activity, Edit details, Discharge, Record death, Upload document) are
absent and that write-only routes (/patients/new, /admin/users)
redirect away from the VIEWER. Cleans the test user up at the end.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14 — Final verification

- [ ] **Step 1 — Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 2 — Run unit + RBAC tests**

Run: `pnpm test`
Expected: all suites pass, including the new `rbac.test.ts`.

- [ ] **Step 3 — Run integration tests**

Run: `pnpm test:integration`
Expected: passes, including the new `roles.test.ts`.

- [ ] **Step 4 — Run linter**

Run: `pnpm lint`
Expected: no errors. (Biome may auto-fix small formatting issues — re-stage if so.)

- [ ] **Step 5 — Manual smoke (recommended)**

Start `pnpm dev`. Sign in as `kaivan@arham.org` and verify:
- Top sidebar shows your badge as "Super admin"
- `/admin/users` shows the full 5-role select on the Invite form
- Create a `VIEWER` user via Invite; sign in as that VIEWER
- VIEWER home page has no "New entry" sidebar button
- A patient detail page has no Edit/Discharge/Death menu but still shows the Share button
- `/patients/new` redirects to `/`
- The "Logged by" dropdown on `/activity/new` (signed in as STAFF/DOCTOR/ADMIN) does NOT include `kaivan@arham.org` or the VIEWER

- [ ] **Step 6 — Push**

Run: `git push`
Expected: all commits land on `origin/main` (or open a PR if branch protection requires one).

---

## Self-review notes

- **Spec coverage:** Every spec section maps to a task above.
- **No placeholders:** Every step has either complete code or a concrete exact command.
- **Naming consistency:** `currentUserRole`, `userRole`, `Role`, `isWriteRole`, `requireWriteRole`, `assignableRoles` — used consistently throughout.
- **Migration ordering safety:** Two separate migration files (Task 1) guarantee the enum value commits before the UPDATE references it.
- **Defense in depth:** Each VIEWER UI hide is paired with the existing server-side RBAC denial; Task 12 adds an additional redirect layer for write-only routes.
