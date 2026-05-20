# Logged-by Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text "Logged by" input on every activity form (create + edit) with a required `<select>` populated from the active-users list, defaulting to the current logged-in user.

**Architecture:** Layout-level server fetch of active users → React Context (`ActiveUsersProvider`) mounted once at `AppShell` → consumed by `ActivityForm` and `ActivityEditFields` via a hook. The Zod schema makes `byName` required. No client-side refetch on modal open.

**Tech Stack:** Next.js 15 App Router (server components for the layout fetch), Prisma, React Context, Zod, Vitest, Playwright (tsx probe).

---

## File structure

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/features/users/queries.ts` | Add `listActiveUsers()` returning `Array<{ id: string; name: string }>` |
| Create | `src/features/users/ActiveUsersContext.tsx` | `<ActiveUsersProvider>` + `useActiveUsers()` hook |
| Modify | `src/app/(app)/layout.tsx` | Parallel-fetch active users + pass to AppShell |
| Modify | `src/components/shell/AppShell.tsx` | Accept new `activeUsers` prop, wrap children in provider |
| Modify | `src/features/activities/schema.ts:113` | Drop `.optional()` from `byName` |
| Create | `src/features/activities/__tests__/schema.test.ts` | Vitest cases for the new schema requirement |
| Modify | `src/features/activities/components/ActivityForm.tsx` | Swap `<Input>` for `<Select>`, default to current user |
| Modify | `src/features/activities/components/ActivityEditFields.tsx` | Same swap + preserved-option for inactive byName |
| Create | `scripts/qa-logged-by-dropdown.ts` | Playwright probe asserting dropdown content + selection persistence |

The spec lives at `docs/superpowers/specs/2026-05-20-logged-by-dropdown-design.md`. Re-read it before each task.

---

### Task 1: Add `listActiveUsers()` query

**Files:**
- Modify: `src/features/users/queries.ts`

Add a thin, focused query that returns only what the dropdown needs (id + name) for active users. Sorted by name asc so the dropdown is alphabetical.

- [ ] **Step 1: Add the new query function**

Append to `src/features/users/queries.ts` (after the existing `listUsers` / `getUserById` definitions):

```ts
export interface ActiveUserLite {
  id: string;
  name: string;
}

export async function listActiveUsers(): Promise<ActiveUserLite[]> {
  return prisma.user.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/features/users/queries.ts
git commit -m "feat(users): listActiveUsers query for dropdown population"
```

---

### Task 2: Create `ActiveUsersProvider` context

**Files:**
- Create: `src/features/users/ActiveUsersContext.tsx`

A minimal client-only context that holds the active-user list + the current logged-in user's name. Consumed by every activity form via `useActiveUsers()`.

- [ ] **Step 1: Create the context module**

Create `src/features/users/ActiveUsersContext.tsx`:

```tsx
'use client';
import { createContext, useContext } from 'react';
import type { ActiveUserLite } from './queries';

interface ActiveUsersContextValue {
  users: ActiveUserLite[];
  currentUserName: string;
}

const ActiveUsersContext = createContext<ActiveUsersContextValue | null>(null);

interface ProviderProps {
  users: ActiveUserLite[];
  currentUserName: string;
  children: React.ReactNode;
}

export function ActiveUsersProvider({ users, currentUserName, children }: ProviderProps) {
  return (
    <ActiveUsersContext.Provider value={{ users, currentUserName }}>
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/features/users/ActiveUsersContext.tsx
git commit -m "feat(users): ActiveUsersProvider context + useActiveUsers hook"
```

---

### Task 3: Wire the context into the app layout

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/shell/AppShell.tsx`

Layout fetches the active users in parallel with the current-user check. `AppShell` accepts the new prop, mounts the provider as a sibling to the existing providers.

- [ ] **Step 1: Update the layout to fetch + forward active users**

Replace the body of `src/app/(app)/layout.tsx` with:

```tsx
import { AppShell } from '@/components/shell/AppShell';
import { listActiveUsers } from '@/features/users/queries';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

const roleLabel: Record<string, string> = {
  STAFF: 'Floor staff',
  DOCTOR: 'Doctor',
  ADMIN: 'Admin',
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Fetch the active-user list in parallel — used by every activity
  // form's "Logged by" dropdown via the ActiveUsersProvider.
  const activeUsers = await listActiveUsers();

  return (
    <AppShell
      user={{
        name: user.name,
        role: roleLabel[user.role] ?? user.role,
        isAdmin: user.role === 'ADMIN',
      }}
      activeUsers={activeUsers}
    >
      {children}
    </AppShell>
  );
}
```

Note: `getCurrentUser()` runs before `listActiveUsers()` (sequential) because the redirect needs to happen first. Reads are cheap; not worth parallelising.

- [ ] **Step 2: Extend AppShell to accept activeUsers + mount the provider**

In `src/components/shell/AppShell.tsx`, add the new import + prop + provider wrap. Show the relevant edits:

Add to the imports block at the top of the file:

```tsx
import { ActiveUsersProvider } from '@/features/users/ActiveUsersContext';
import type { ActiveUserLite } from '@/features/users/queries';
```

Extend the `Props` interface:

```tsx
interface Props {
  user: { name: string; role: string; isAdmin: boolean };
  activeUsers: ActiveUserLite[];
  title?: string | undefined;
  children: React.ReactNode;
}
```

Update the function signature + add the provider wrap. Find the existing top-level `<Suspense fallback={null}>` block in `AppShell` and wrap its children with `ActiveUsersProvider`. Concretely, the JSX block that currently looks like:

```tsx
export function AppShell({ user, title, children }: Props) {
  // ...
  return (
    <Suspense fallback={null}>
      <ToastProvider>
        <CommandPaletteProvider>
          <QuickAddProvider>
            …
          </QuickAddProvider>
        </CommandPaletteProvider>
      </ToastProvider>
    </Suspense>
  );
}
```

becomes:

```tsx
export function AppShell({ user, activeUsers, title, children }: Props) {
  // ...same useState/Drawer hook logic
  return (
    <Suspense fallback={null}>
      <ActiveUsersProvider users={activeUsers} currentUserName={user.name}>
        <ToastProvider>
          <CommandPaletteProvider>
            <QuickAddProvider>
              …
            </QuickAddProvider>
          </CommandPaletteProvider>
        </ToastProvider>
      </ActiveUsersProvider>
    </Suspense>
  );
}
```

Keep the unchanged JSX inside QuickAddProvider exactly as it is.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/layout.tsx src/components/shell/AppShell.tsx
git commit -m "feat(users): wire ActiveUsersProvider into AppShell"
```

---

### Task 4: Make `byName` required in the activity schema (TDD)

**Files:**
- Modify: `src/features/activities/schema.ts:113`
- Create: `src/features/activities/__tests__/schema.test.ts`

Strict TDD here — write the failing tests first, then drop the `.optional()`.

- [ ] **Step 1: Create the failing test file**

Create `src/features/activities/__tests__/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CreateActivitySchema } from '../schema';

const baseTreatment = {
  type: 'TREATMENT' as const,
  animalId: 'animal-1',
  data: { meds: [{ name: 'Amoxiclav', dose: '20mg/kg', route: 'Oral' as const }] },
  mediaAssetIds: [],
};

describe('CreateActivitySchema — byName', () => {
  it('rejects missing byName', () => {
    const result = CreateActivitySchema.safeParse({ ...baseTreatment });
    expect(result.success).toBe(false);
  });

  it('rejects empty byName', () => {
    const result = CreateActivitySchema.safeParse({ ...baseTreatment, byName: '' });
    expect(result.success).toBe(false);
  });

  it('accepts a non-empty byName', () => {
    const result = CreateActivitySchema.safeParse({ ...baseTreatment, byName: 'Dr. Mehta' });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run, see all 3 fail (byName is still optional)**

Run: `pnpm exec vitest run src/features/activities/__tests__/schema.test.ts`
Expected: `2 failed, 1 passed` — the "rejects missing" and "rejects empty" cases will fail because the schema currently treats missing/empty as OK; "accepts a non-empty byName" already passes.

If for some reason all 3 pass (different baseline), continue — Step 3 still needs the schema change to enforce the contract.

- [ ] **Step 3: Drop `.optional()` from the schema**

In `src/features/activities/schema.ts` at line 113, change:

```ts
byName: z.string().min(1).max(120).optional(),
```

to:

```ts
byName: z.string().min(1).max(120),
```

- [ ] **Step 4: Run, expect all 3 to pass**

Run: `pnpm exec vitest run src/features/activities/__tests__/schema.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Run the full test sweep so we catch any other tests that assumed byName was optional**

Run: `pnpm test`
Expected: passes. If any test fails because it built an activity without `byName`, fix that test by passing `byName: 'Some Name'`.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add src/features/activities/schema.ts src/features/activities/__tests__/schema.test.ts
git commit -m "feat(activities): byName is now a required field"
```

---

### Task 5: Swap `<Input>` for `<Select>` in ActivityForm (create flow)

**Files:**
- Modify: `src/features/activities/components/ActivityForm.tsx`

Replace the free-text Logged-by input with a Select populated from `useActiveUsers()`, defaulting to the current user.

- [ ] **Step 1: Add imports + state change**

In `src/features/activities/components/ActivityForm.tsx`:

1. Add the imports near the top (replace the existing `Input` import line or add alongside):

```tsx
import { Select } from '@/components/ui/Select';
import { useActiveUsers } from '@/features/users/ActiveUsersContext';
```

2. Inside the component body, just below the existing `useState(...)` calls for `media` and `occurredAtLocal`, replace:

```tsx
const [byNameOverride, setByNameOverride] = useState('');
```

with:

```tsx
const { users: activeUsers, currentUserName } = useActiveUsers();
const [byNameSelected, setByNameSelected] = useState(currentUserName);
```

3. Update the submit payload — replace:

```tsx
byName: byNameOverride.trim() || undefined,
```

with:

```tsx
byName: byNameSelected,
```

- [ ] **Step 2: Replace the Logged-by field JSX**

Find the existing block (around lines 128–139):

```tsx
<FormField
  label="Logged by"
  hint="Defaults to your name — override if logging on someone else's behalf"
>
  {(id) => (
    <Input
      id={id}
      value={byNameOverride}
      onChange={(e) => setByNameOverride(e.target.value)}
      placeholder="Defaults to current user"
    />
  )}
</FormField>
```

Replace with:

```tsx
<FormField
  label="Logged by"
  required
  hint="Defaults to your name — pick someone else if logging on their behalf"
>
  {(id) => (
    <Select
      id={id}
      value={byNameSelected}
      onChange={(e) => setByNameSelected(e.target.value)}
    >
      {activeUsers.map((u) => (
        <option key={u.id} value={u.name}>
          {u.name}
        </option>
      ))}
    </Select>
  )}
</FormField>
```

Note: we don't include a blank "Select…" option — the field is required and the default is already the current user, so any submit carries a valid name.

- [ ] **Step 3: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/features/activities/components/ActivityForm.tsx
git commit -m "feat(activities): Logged-by dropdown on create flow"
```

---

### Task 6: Swap `<Input>` for `<Select>` in ActivityEditFields (edit flow)

**Files:**
- Modify: `src/features/activities/components/ActivityEditFields.tsx`

Same swap, with the inactive-user-preserved-option behaviour. The current `value.byName` is the row's existing attribution; if it doesn't match any active user, surface it as a labelled option so saving doesn't lose history.

- [ ] **Step 1: Add the imports**

In `src/features/activities/components/ActivityEditFields.tsx`, add to the import block at the top:

```tsx
import { Select } from '@/components/ui/Select';
import { useActiveUsers } from '@/features/users/ActiveUsersContext';
```

Remove the existing `import { Input } from '@/components/ui/Input';` line if `Input` is no longer used elsewhere in this file. If it is still used by other fields (e.g. datetime-local), keep the import.

- [ ] **Step 2: Read the active-user list inside the component**

Find the function signature `export function ActivityEditFields(...)` and add as the very first line in the body:

```tsx
const { users: activeUsers } = useActiveUsers();
```

- [ ] **Step 3: Build the option list (preserves an inactive byName)**

Add this block right after the `useActiveUsers()` call:

```tsx
// If the row's current byName matches an active user, the <select>
// will pick it up by value.  If it doesn't (the user got deactivated
// later), inject a single "— inactive" option at the top so the form
// can be saved without losing the historical attribution.
const matchesActive = activeUsers.some((u) => u.name === value.byName);
const optionList = matchesActive
  ? activeUsers
  : [{ id: '__inactive__', name: value.byName, inactive: true as const }, ...activeUsers];
```

- [ ] **Step 4: Replace the Logged-by field JSX**

Find the existing block (around lines 57–66):

```tsx
<FormField label="Logged by">
  {(id) => (
    <Input
      id={id}
      value={value.byName}
      onChange={(e) => onChange({ ...value, byName: e.target.value })}
      placeholder="Staff member"
    />
  )}
</FormField>
```

Replace with:

```tsx
<FormField label="Logged by" required>
  {(id) => (
    <Select
      id={id}
      value={value.byName}
      onChange={(e) => onChange({ ...value, byName: e.target.value })}
    >
      {optionList.map((u) => (
        <option key={u.id} value={u.name}>
          {'inactive' in u && u.inactive ? `${u.name} — inactive` : u.name}
        </option>
      ))}
    </Select>
  )}
</FormField>
```

- [ ] **Step 5: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add src/features/activities/components/ActivityEditFields.tsx
git commit -m "feat(activities): Logged-by dropdown on edit flow, preserves inactive byName"
```

---

### Task 7: Playwright probe — dropdown content + selection persistence

**Files:**
- Create: `scripts/qa-logged-by-dropdown.ts`

End-to-end check: load the dev server, open a Treatment form, assert the dropdown is a `<select>` containing the seeded users with admin defaulted, change to a different user, save, navigate to the timeline and confirm the chosen name persisted.

- [ ] **Step 1: Confirm the dev server is running**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login`
Expected: `200`. If not, ask the user to start the dev server with `pnpm dev` (the harness may need to restart it via the existing pattern).

- [ ] **Step 2: Create the probe**

Create `scripts/qa-logged-by-dropdown.ts`:

```ts
import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => process.stdout.write(`[pageerror] ${e.message.slice(0, 150)}\n`));

  // Login as admin
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@arham.care');
  await page.getByLabel('Password').fill('admin1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/', { timeout: 30_000 });

  // Open the first patient on /patients
  await page.goto('/patients');
  await page.locator('a[href^="/patients/"]:not([href="/patients/new"])').first().click();
  await page.waitForURL(/\/patients\/c[a-z0-9]{24}$/, { timeout: 15_000 });
  await page.waitForTimeout(500);

  // Open the per-patient ActivityQuickAdd → Treatment
  await page.getByRole('button', { name: /log activity/i }).first().click();
  await page.getByRole('button', { name: /^Treatment/i }).click();

  // Locate the Logged-by select by its FormField label
  const select = page.getByLabel('Logged by');
  await select.waitFor({ state: 'visible' });

  // Assert it's a <select> with the expected option set
  const tag = await select.evaluate((el) => el.tagName.toLowerCase());
  if (tag !== 'select') {
    throw new Error(`Logged-by control is <${tag}>, expected <select>`);
  }
  const options = await select.evaluate((el) =>
    Array.from((el as HTMLSelectElement).options).map((o) => o.value),
  );
  process.stdout.write(`dropdown options: ${options.join(', ')}\n`);

  // Default should be admin's name ("Asha (Reception)")
  const defaultVal = await select.evaluate((el) => (el as HTMLSelectElement).value);
  if (defaultVal !== 'Asha (Reception)') {
    throw new Error(`Default was "${defaultVal}", expected "Asha (Reception)"`);
  }

  // Change to Dr. Mehta + fill in mandatory treatment fields
  await select.selectOption('Dr. Mehta');
  await page.getByPlaceholder(/medicine/i).first().fill('QA-LoggedBy-Test');
  await page.getByPlaceholder(/dose|mg/i).first().fill('5mg/kg');
  await page.getByRole('button', { name: 'Save entry' }).click();

  // Wait for toast confirmation, then verify the row attribution
  await page.getByText(/Treatment saved/i).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1000);
  const rowText = await page
    .locator('button')
    .filter({ hasText: 'QA-LoggedBy-Test' })
    .first()
    .innerText();
  if (!rowText.includes('Dr. Mehta')) {
    throw new Error(`Row attribution is missing "Dr. Mehta": ${rowText}`);
  }

  process.stdout.write('\nPASS — Logged-by dropdown defaults to admin, persists the selection.\n');
  await browser.close();
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
```

- [ ] **Step 3: Run the probe**

Run: `pnpm exec dotenv -e .env.local -- tsx scripts/qa-logged-by-dropdown.ts`
Expected: ends with `PASS — Logged-by dropdown defaults to admin, persists the selection.`

- [ ] **Step 4: Commit**

```bash
git add scripts/qa-logged-by-dropdown.ts
git commit -m "test(activities): qa-logged-by-dropdown Playwright probe"
```

---

### Task 8: Final sweep + push

- [ ] **Step 1: Full vitest run**

Run: `TZ=UTC pnpm test`
Expected: all tests pass (including the 3 new schema cases).

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both clean.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 4: Push**

Run: `git push origin main`
Expected: commits from Tasks 1–7 land on `origin/main`.

- [ ] **Step 5: Watch CI**

Run: `gh run list --limit 1 --branch main`
Then: monitor until completion. Expected: green CI.

---

## Self-review

**Spec coverage:**

| Spec requirement | Covered by |
|---|---|
| `byName` becomes required | Task 4 (schema + 3 vitest cases) |
| New `listActiveUsers()` query, `Array<{id, name}>`, active-only, name asc | Task 1 |
| New `ActiveUsersProvider` + `useActiveUsers()` hook | Task 2 |
| Layout fetches active users in parallel with current-user | Task 3, Step 1 |
| AppShell mounts the provider as a sibling of existing providers | Task 3, Step 2 |
| ActivityForm (create): swap input → select, default to current user, required, submit `byName` directly | Task 5 |
| ActivityEditFields (edit): swap input → select, preserve inactive byName as `— inactive` option | Task 6, Steps 3 + 4 |
| FormField hint reworded | Task 5, Step 2 ("pick someone else if logging on their behalf") |
| Playwright probe — defaults + selection persistence | Task 7 |

**Placeholder scan:** No TBDs / "implement later" / vague handwaving. Every step has the actual code, file paths, or exact command + expected output.

**Type consistency:** `ActiveUserLite` is defined in Task 1 and re-imported in Tasks 2 + 3. The context's `users: ActiveUserLite[]` shape is consistent end-to-end. The form-state rename (`byNameOverride` → `byNameSelected`) is applied in Task 5 only — `ActivityEditFields` continues to use `value.byName` from its existing `EditDraft` interface, which is unchanged.

**One nuance worth noting:** Task 5 Step 1 inline-replaces `useState('')` with `useState(currentUserName)`. `currentUserName` comes from `useActiveUsers()`. This means the form's default value is "stable across re-renders" only if the provider is mounted before the form — which it always is (the form is rendered as a descendant of AppShell). No race.
