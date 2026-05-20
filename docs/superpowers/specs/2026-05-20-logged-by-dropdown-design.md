# "Logged by" → dropdown of active users

**Status:** approved
**Date:** 2026-05-20
**Surface:** every activity-logging form (create + edit) across the app.

## Goal

Today the "Logged by" field on activity forms is a free-text input
defaulted to the current user's name. Doctors have to type a teammate's
name when logging on someone else's behalf — error-prone (typos),
inconsistent (Dr. Mehta vs Dr Mehta vs Dr. Suresh Mehta), and slow.

Convert it to a required dropdown populated with all active users.
Default to the current logged-in user. Same UI on create and edit.

## User decisions captured during brainstorming

| Decision | Choice |
|---|---|
| Field requirement | Required, app-wide on every activity form |
| Population | All `active: true` users |
| Default value | Current logged-in user, pre-selected |
| Inactive-user edge case (edit) | Show as a preserved option labelled `— inactive`; do not force re-selection |
| Discharge / death / admission forms | Out of scope (no "logged by" UI) |
| Type-to-search combobox | Out of scope (clinic has ≤20 users) |

## Architecture

### Data flow

```
src/app/(app)/layout.tsx  (server component, runs per request)
  ├─ listCurrentUser()          (existing)
  └─ listActiveUsers()           (new)
        │
        ▼
src/components/shell/AppShell.tsx
  └─ <ActiveUsersProvider users={…} currentUserName={…}>
        │
        ▼  via context
ActivityForm  +  ActivityEditFields
  └─ <Select> populated from `useActiveUsers().users`
```

The layout already fetches `getCurrentUser()` on every page render.
Adding `listActiveUsers()` in parallel costs ~5 ms on Postgres for
~10 rows. The data lives in React context for the lifetime of the
page so opening a QuickAdd modal is instant — no client fetch, no
loading state, no re-fetch on re-open.

Cache invalidation is implicit: when an admin invites or deactivates a
user, the next navigation re-renders the layout and the new list is
served to context. No `revalidateTag` calls needed.

### Schema change

`src/features/activities/schema.ts`:

```ts
// before
byName: z.string().min(1).max(120).optional(),

// after
byName: z.string().min(1).max(120),
```

The server-side fallback in `createActivity` (`parsed.byName ?? actor.name`)
stays as defense-in-depth — if any caller somehow ships an empty
string past the schema, the audit row still has a name. But the
wire contract becomes "required".

### New units

| Path | Responsibility |
|---|---|
| `src/features/users/queries.ts` | Add `listActiveUsers()` returning `Array<{ id: string; name: string }>`, filtered to `active: true`, ordered by `name asc`. Re-uses the existing `prisma.user.findMany` infrastructure. |
| `src/features/users/ActiveUsersContext.tsx` | New `'use client'` module exporting `<ActiveUsersProvider users currentUserName>` + `useActiveUsers()` hook. Provider wraps `AppShell` children. |
| `src/app/(app)/layout.tsx` | Adds the `listActiveUsers()` call in parallel with the current-user fetch (Promise.all), forwards both to `AppShell`. |
| `src/components/shell/AppShell.tsx` | Wraps children in `<ActiveUsersProvider>` (sibling to `ToastProvider` / `QuickAddProvider`). |

### Components modified

- `src/features/activities/components/ActivityForm.tsx` — replace the
  `<Input>` with a `<Select>` driven by `useActiveUsers()`. Default
  `byNameSelected = currentUserName`. Submitted as `byName: byNameSelected`
  (no `?? undefined`, since required).

- `src/features/activities/components/ActivityEditFields.tsx` — same
  swap. When the form opens the existing `value.byName` is used as the
  initial selection. If that name isn't in the active-users list,
  inject a single preserved option `${byName} — inactive` at the top
  of the list, pre-selected. The user can leave it as-is (keeps history)
  or pick someone active.

### Removed UI affordances

- The `Defaults to current user` placeholder + helper text disappear
  (the field is always populated by default).
- The "override if logging on someone else's behalf" hint stays as
  the FormField hint, slightly reworded: `Pick someone else if logging
  on their behalf` — same meaning, matches the new control.

## Testing

### Unit (vitest)

**Schema change** — `src/features/activities/__tests__/schema.test.ts`
(new file):

- Rejects when `byName` is missing.
- Rejects when `byName` is an empty string.
- Accepts when `byName` is a non-empty string ≤120 chars.

### Manual / Playwright probe

`scripts/qa-logged-by-dropdown.ts` (kept in `scripts/`, not in `tests/e2e`):

1. Login as admin (`admin@arham.care`).
2. Navigate to a patient detail page.
3. Click "+ Log activity", pick Treatment.
4. Assert `Logged by` is a `<select>` (`role="combobox"` doesn't apply
   to native `<select>` — assert by tagname).
5. Assert it has ≥ 6 options (the 6 seed users).
6. Assert the default selected option's text equals `Asha (Reception)`
   (admin's name).
7. Change selection to `Dr. Mehta`, fill required treatment fields, save.
8. Navigate to the patient's timeline, assert the just-logged row's
   `by` text is `Dr. Mehta`.

### What doesn't need a test

- The context wiring is mechanical and exercised by every page render.
- The "inactive user preserved as option" edge case is hard to trigger
  in seed data without manually flipping a user to `active: false`
  mid-test. The unit case will be added if/when it becomes a real
  scenario.

## Files touched

| Action | Path |
|---|---|
| Modify | `src/features/activities/schema.ts` (make `byName` required) |
| Create | `src/features/activities/__tests__/schema.test.ts` |
| Modify | `src/features/users/queries.ts` (add `listActiveUsers`) |
| Create | `src/features/users/ActiveUsersContext.tsx` |
| Modify | `src/app/(app)/layout.tsx` (parallel-fetch active users) |
| Modify | `src/components/shell/AppShell.tsx` (mount provider) |
| Modify | `src/features/activities/components/ActivityForm.tsx` |
| Modify | `src/features/activities/components/ActivityEditFields.tsx` |
| Create | `scripts/qa-logged-by-dropdown.ts` |

## Out of scope (intentionally)

- Combobox / type-to-search — pure native `<select>` is enough.
- A separate `byUserId` foreign-key for "logged on behalf of" — the
  `byName` string is the source of truth; the existing `byUserId`
  column tracks the actor (audit), not the override.
- Inactive users appearing in the dropdown options — only active.
- Discharge / death / admission forms — no "logged by" field on those.
- Hiding the dropdown when only one active user exists — irrelevant for
  a multi-user clinic.
