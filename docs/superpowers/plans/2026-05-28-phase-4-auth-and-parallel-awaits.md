# Phase 4 — Auth hot path + parallelize sequential awaits

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap `getCurrentUser` with React's `cache()` so the DB user-lookup fires once per request (not once per call site). Parallelize the sequential `listAssignableCages` await on the patient detail page.

**Architecture:** A 1-line change in `src/lib/auth.ts` — wrap the existing async function with `cache` from `'react'`. Zero behavior change, zero security impact (the DB re-check still happens; it just shares the same promise across all callers within a single render pass). The patient-detail parallelization moves `listAssignableCages` into the existing `Promise.all`, dropping ~50–100 ms of serial wait when an animal exists.

**Tech Stack:** React 18.3.1 (`cache` is stable since 18.2), Next.js 15 App Router.

**Spec:** `docs/superpowers/specs/2026-05-28-app-performance-design.md` § Phase 4.

---

## Prerequisites

- Phase 3 in production at `main` `c34ef19` (or later).
- Local: `git checkout main && git pull --ff-only`.
- 180/180 unit tests pass; grep gate clean.

---

## Scope Check

Two narrow concerns: (1) memoize `getCurrentUser`, (2) parallelize one specific sequential await. The spec explicitly **excludes** "cross-feature query merging — only single-file sequential fixes." That keeps this PR small. Single PR.

---

## Test Strategy

- **Unit (Vitest):** No new tests. `getCurrentUser`'s behavior contract doesn't change — it still returns the same shape. The memoization is a perf-only concern that's transparent to consumers.
- **Existing suite:** must keep passing (180/180).
- **Manual verification (post-deploy, optional):** open a patient detail page on a fresh session, look at the Vercel function logs / Server-Timing — `getCurrentUser` calls within one page render coalesce into one DB query in the `pg_stat_statements` view (if you have it).

---

## File Structure

**Modified files:**
- `src/lib/auth.ts` — wrap `getCurrentUser` with `cache()`. ~3 line change.
- `src/features/animals/components/AnimalDetail.tsx` — move `listAssignableCages` into the existing `Promise.all`.

**Untouched:**
- `requireWriteRole`, `requireAdminRole`, `requireCageManageRole` — they call `getCurrentUser` internally, so they get the memoization win transparently without changes.
- All call sites of `getCurrentUser` and the role-guards stay byte-identical.

---

## Branch / commit discipline

Single PR `perf-phase-4-auth-parallel`. Two commits.

---

## Task 4.1: Wrap `getCurrentUser` with React `cache()`

**Files:**
- Modify: `src/lib/auth.ts`

### Step 1: Read the current file shape

```bash
head -80 src/lib/auth.ts
```

Confirm the existing `export async function getCurrentUser()` (around line 63) and its return type `Promise<CurrentUser | null>`.

### Step 2: Add the import + wrap

In `src/lib/auth.ts`, add an import at the top (alongside the other existing imports). React's `cache` is exported from `'react'`:

```ts
import { cache } from 'react';
```

Then replace the existing `getCurrentUser` declaration. Current code:

```ts
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!dbUser || !dbUser.active) return null;
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
  };
}
```

Replace with:

```ts
/**
 * Per-request memoized.  React's `cache()` returns a function that
 * deduplicates calls within a single render pass — so a page that
 * calls getCurrentUser() three times (layout, page, action) only
 * runs the DB lookup once.  No behavior change, no security trade:
 * the same Active+role re-check still happens on every request,
 * just collapsed to one DB round-trip per request graph.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!dbUser || !dbUser.active) return null;
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
  };
});
```

(Function-statement → cache-wrapped-arrow expression. The exported binding is now a `const` but the call signature `getCurrentUser()` is unchanged.)

### Step 3: Verify

```bash
pnpm typecheck && pnpm test
bash scripts/check-no-raw-file-urls.sh
```

Expected: 180/180 tests pass, typecheck clean. (No callers need to change — `const getCurrentUser = cache(async () => ...)` exports the same call signature as before.)

### Step 4: Commit

```bash
git add src/lib/auth.ts
git commit -m "feat(perf): memoize getCurrentUser per-request via React cache()

Wraps getCurrentUser with React's cache().  Within a single render
pass, repeated calls (layout → page → action → /api/files) all
share the same promise — the DB lookup fires once instead of N
times.

No security boundary change: the Active+role re-check still
happens on every request, just collapsed to one DB round-trip per
request graph.  Role-guard helpers (requireWriteRole / requireAdminRole
/ requireCageManageRole) inherit the memoization transparently
because they call getCurrentUser internally.

No behavior change, no call-site updates needed."
```

---

## Task 4.2: Parallelize `AnimalDetail`'s trailing `listAssignableCages` await

**Files:**
- Modify: `src/features/animals/components/AnimalDetail.tsx`

### Step 1: Read the current shape

```bash
grep -n "Promise.all\|listAssignableCages\|notFound" src/features/animals/components/AnimalDetail.tsx | head -10
```

Identify the current block (around lines 22–30):

```tsx
const [animal, activities, documents] = await Promise.all([
  getAnimal(animalId),
  listActivitiesForAnimal(animalId),
  listDocumentsForAnimal(animalId),
]);
if (!animal) notFound();
const cages = await listAssignableCages(animalId);
const lastActivityAt = activities[0]?.occurredAt ?? null;
```

### Step 2: Fold `listAssignableCages` into the `Promise.all`

Replace the block with:

```tsx
const [animal, activities, documents, cages] = await Promise.all([
  getAnimal(animalId),
  listActivitiesForAnimal(animalId),
  listDocumentsForAnimal(animalId),
  listAssignableCages(animalId),
]);
if (!animal) notFound();
const lastActivityAt = activities[0]?.occurredAt ?? null;
```

(`notFound()` runs after the all-resolves.  If `animal` is null, the redundant cage-list fetch already returned — wasted ~30 ms on the rare not-found path, but the common-case win is unambiguous.)

### Step 3: Verify

```bash
pnpm typecheck && pnpm test
bash scripts/check-no-raw-file-urls.sh
```

Expected: 180/180 tests pass, typecheck clean.

### Step 4: Commit

```bash
git add src/features/animals/components/AnimalDetail.tsx
git commit -m "perf(animals): parallelize listAssignableCages with the Promise.all

AnimalDetail used to await listAssignableCages serially after the
existing 3-query Promise.all resolves.  Folded into the same
Promise.all — saves one round-trip's worth of wall-clock latency
(~30–80 ms on Neon sin1) on every patient-detail render.

The trade-off: when an animal is not found (rare), we now also do
a redundant cage-list query before notFound() redirects.  Worth
it for the steady-state win."
```

---

## Task 4.3: Open the PR

- [ ] **Step 1: Push + open PR**

```bash
git push -u origin perf-phase-4-auth-parallel
gh pr create --base main --head perf-phase-4-auth-parallel \
  --title "feat(perf): phase 4 — getCurrentUser memoization + AnimalDetail parallel awaits" \
  --body "Phase 4 of the perf rebuild — smallest phase, single PR.

- **getCurrentUser** is wrapped with React \`cache()\`.  Per-request
  memoization: a page that calls getCurrentUser 3–5 times (layout
  → page → server action → /api/files) now runs the DB lookup once
  per request graph.  Security boundary unchanged — Active+role
  re-check still happens, just deduplicated.  Role-guard helpers
  (requireWriteRole / requireAdminRole / requireCageManageRole)
  inherit the memoization transparently.

- **AnimalDetail** folds listAssignableCages into the existing
  Promise.all instead of awaiting it serially after.  Saves one
  Neon round-trip on every patient detail render.

180/180 unit tests pass.  Typecheck clean.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 2: Wait for CI, merge**

```bash
sleep 30
gh pr merge --squash --delete-branch
```

- [ ] **Step 3: Wait for Vercel deploy**

```bash
for i in 1 2 3 4 5 6 7 8 9; do
  VCL=$(gh api repos/afk1997/IPD-alwayscare-paramdham/commits/main/statuses --jq '[.[] | select(.context=="Vercel")] | sort_by(.created_at) | reverse | .[0].state' 2>/dev/null)
  echo "vercel=$VCL"
  [ "$VCL" = "success" ] && break
  sleep 25
done
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - Phase 4 § React `cache()` on `getCurrentUser` — Task 4.1 ✓
   - Phase 4 § Parallelize `AnimalDetail` awaits — Task 4.2 ✓
   - Phase 4 § Out-of-scope (cross-feature query merging, DB re-check removal) — respected ✓

2. **Placeholder scan:** No `TBD`, no `TODO`. Both code changes have full code shown.

3. **Type consistency:** `getCurrentUser`'s call signature (`(): Promise<CurrentUser | null>`) is unchanged after wrapping. All 26 call sites continue working without edits.

4. **Risk surface:** Tiny. Each task is a localised, well-bounded edit. The memoization is React-stable since 18.2, well-documented, and used internally by Next.js itself. The Promise.all consolidation is a textbook parallelization.

Plan is complete and self-consistent.
