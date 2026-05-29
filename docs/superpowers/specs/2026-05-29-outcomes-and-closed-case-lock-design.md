# Outcomes (Deaths & Discharges) + Closed-Case Lock — Design

- **Date:** 2026-05-29
- **Status:** Draft (awaiting user review)
- **Author:** brainstorming session

## Problem

The "Today" dashboard shows a **Deaths: 1** tile (and Discharges/Admissions/Surgeries), but the counts are dead-ends: the tiles aren't clickable, and a deceased or discharged animal is hidden from every normal view.

- `listAnimals` filters out `deceasedAt`/`dischargedAt`, so closed cases never appear in the Patients list.
- The death/discharge flow deliberately does **not** create a timeline activity (the `SD-7` change), so a death/discharge never appears in "Today's activities" either.
- Net: after recording a death, staff see "Deaths: 1" with **no way to find who died** short of the admin audit log or a direct URL.

There is also no enforced finality on closed cases: today a DOCTOR/ADMIN can still edit a deceased animal and edit/delete its activities.

## Goals

1. Make the four "Today" tiles act as **today-only filters** for the panel below them.
2. Add a **Deaths & Discharges register** page for browsing closed cases over time.
3. Enforce **closed-case finality**: once an animal is DECEASED or DISCHARGED, only SUPER_ADMIN can mutate it or anything attached to it.
4. Restrict the register and the death/discharge drill-down so **STAFF cannot see them**; VIEWER can (read-only).

## Non-goals

- No "undo death / re-open case" feature (explicitly out of scope; if a death is recorded in error, that's a SUPER_ADMIN correction handled later).
- No schema changes — `Animal.deceasedAt/dischargedAt/status`, `DeathRecord`, and `DischargeRecord` already hold everything needed.
- No change to how deaths/discharges are *recorded* (the existing lifecycle flow stays).

---

## Part 1 — "Today" tile filters

The four dashboard tiles (`TodayDashboard.tsx`) become toggle filters for the panel beneath them, driven by a **URL search param** (`/?show=deaths`). URL-driven (not client state) so it is server-rendered, RBAC-enforced server-side, and shareable/back-button-friendly.

**Behavior**
- Click a tile → it renders in an **active/highlighted** state and the panel below shows **only that category's records for today**:
  - `admissions` → animals with `admittedAt` today.
  - `surgeries` → SURGERY activities today (the existing timeline, filtered to `type = SURGERY`).
  - `discharges` → animals with `dischargedAt` today (name · summary · by whom · time).
  - `deaths` → animals with `deceasedAt` today (name · cause · by whom · time).
- No `show` param (default) → the existing full "Today's activities" timeline, unchanged.
- Clicking the active tile again → link back to default (no param).
- Every row links to the patient detail page (`/patients/[id]`), which already renders for deceased/discharged animals.

**"Today" boundary**
- Uses the **IST midnight** boundary, consistent with `getCachedTodayCounts` (`new Date(); setHours(0,0,0,0)` under `TZ=Asia/Kolkata`). (Note: this is *not* the `toISOString()` path that has the separate H2 off-by-one bug; that bug is tracked separately and not in scope here.)

**RBAC on the dashboard**
- `admissions` / `surgeries`: clickable by **all** logged-in roles.
- `deaths` / `discharges`: clickable only by `outcome.read` holders (VIEWER, DOCTOR, ADMIN, SUPER_ADMIN). For **STAFF** the tile shows the count but is **not interactive** (no link). If STAFF manually hits `/?show=deaths`, the server ignores the param and renders the default timeline (defense-in-depth).

**Data**
- New today-scoped queries (in `features/animals/queries.ts` or `features/reports/queries.ts`):
  - `listTodayAdmissions()`, `listTodayDischarges()`, `listTodayDeaths()` — each returns animal id/name/species + the relevant timestamp + (for discharge/death) summary/cause + recordedBy name, filtered `deletedAt: null`.
  - Surgeries reuse the existing today-activity query filtered to `type: SURGERY`.

---

## Part 2 — Deaths & Discharges register page

- **Route:** `/outcomes` (top-level, **not** under `/admin` — DOCTOR and VIEWER are not admins).
- **Access:** `outcome.read` → VIEWER, DOCTOR, ADMIN, SUPER_ADMIN. STAFF is redirected away (page guard `requireOutcomeReadRole()`).
- **Nav:** a side-nav entry ("Outcomes") shown to everyone **except STAFF**.
- **Layout:** two tabs — **Deaths** | **Discharges** (segmented control, like the Trash page).
  - Each tab lists records **newest-first**, grouped **Today / Earlier**.
  - Capped at a sane page size (100) with "Load more" (cursor) if exceeded.
  - **Death row:** animal name · species · died date/time · cause of death · recorded by → links to patient detail.
  - **Discharge row:** animal name · species · discharged date/time · summary · discharged by → links to patient detail.
- The page is **read-only** for everyone (including SUPER_ADMIN) — it is a discovery/register surface, not an editor. The "only SUPER_ADMIN can edit/delete deaths & discharges" requirement is satisfied by the **closed-case lock (Part 4)**: the records are reached from here, but any edit/delete happens on the patient detail page and is SUPER_ADMIN-gated there.

**Data**
- New queries (new `features/outcomes/queries.ts`, or extend reports): `listDeaths({ cursor, take })` and `listDischarges({ cursor, take })`, joining `DeathRecord`/`DischargeRecord` + `Animal` (filtered `animal.deletedAt: null`), ordered by `diedAt`/`dischargedAt` desc.

---

## Part 3 — RBAC additions

New action in `lib/rbac.ts`:

| Action | Roles |
|---|---|
| `outcome.read` | VIEWER, DOCTOR, ADMIN, SUPER_ADMIN (STAFF excluded) |

- Gates: the `/outcomes` page (`requireOutcomeReadRole()` in `lib/auth.ts`), the dashboard `deaths`/`discharges` drill-down, and the outcome list queries (re-assert internally, like `listAuditLog`).
- VIEWER is intentionally included (the "sees everything, read-only" role); STAFF is intentionally excluded.

No new action is needed for editing/deleting — the closed-case lock (Part 4) reuses the existing actions but raises the bar to SUPER_ADMIN based on the animal's status.

---

## Part 4 — Closed-case lock (finality)

**Rule:** when an animal's `status` is `DECEASED` or `DISCHARGED`, **every create/edit/delete operation on that animal or anything attached to it requires SUPER_ADMIN.** Non-super actors are blocked even if they would normally have the permission.

**Server enforcement** — a shared guard, e.g. `assertCanMutateClosedCase(actor, animalStatus)`:
> if `status ∈ {DECEASED, DISCHARGED}` and `actor.role !== 'SUPER_ADMIN'` → throw `RbacError('closed case — super admin only')`.

Applied in (each already loads or can cheaply join the animal's status):
- `animals/service.ts`: `updateAnimal`, `softDeleteAnimal`.
- `activities/service.ts`: `createActivity`, `updateActivity`, `softDeleteActivity`, `duplicateActivity` (join `animal.status`).
- `documents/service.ts`: `createDocument`, `softDeleteDocument`, `restoreDocument`.
- `media/service.ts`: `initiateUpload` for activity/document contexts targeting a closed animal.

**Not affected:** `restoreAnimal` (operates on a *trashed* animal, an orthogonal axis — stays ADMIN+); reading; the lifecycle record-creation flow itself (an open animal becoming closed).

**UI (defense-in-depth, server is the real gate):**
- `AnimalDetailActions`: for a closed animal, hide Edit / Log-activity / Upload unless the viewer is SUPER_ADMIN (it already hides the discharge/death lifecycle links when closed).
- `ActivitySheet`: hide Edit / Delete / Duplicate on a closed animal's activities unless SUPER_ADMIN.
- `DocumentsPanel`: hide upload on a closed animal unless SUPER_ADMIN.

---

## Edge cases

- STAFF navigating directly to `/outcomes` → redirected to `/` by the guard.
- STAFF forcing `/?show=deaths` → server renders the default timeline (param ignored for non-`outcome.read`).
- A closed animal's detail page remains viewable by all (read), with mutation affordances hidden per role.
- A SUPER_ADMIN editing a closed case still goes through normal validation (e.g., activity type/data rules).
- Empty states: "No deaths recorded" / "No discharges yet" per tab; today-filter panels show "No deaths today" etc.

## Testing

- **Integration (real DB):**
  - `outcome.read`: VIEWER/DOCTOR/ADMIN/SUPER_ADMIN can list deaths/discharges; STAFF is denied.
  - Closed-case lock: DOCTOR/ADMIN cannot `updateAnimal`/`updateActivity`/`softDeleteActivity`/`createActivity` on a DECEASED or DISCHARGED animal; SUPER_ADMIN can.
  - `listTodayDeaths`/`listTodayDischarges` exclude soft-deleted animals and respect the IST day boundary.
- **Unit:** rbac matrix includes `outcome.read` with the right roles; the closed-case guard helper.

## Open questions / decisions to confirm

1. **Create on a closed animal:** the lock currently blocks *creating* new activities/documents on a closed animal for non-super (full freeze). Confirm that's desired vs. only blocking edit/delete. (Recommended: full freeze — a closed case shouldn't gain new entries except by SUPER_ADMIN.)
2. **Nav label / route name:** `/outcomes` with nav label "Outcomes" vs. `/deaths-discharges` labelled "Deaths & Discharges". (Recommended: `/outcomes`.)
3. **Register pagination:** cap at 100 + "Load more" vs. a date-range filter. (Recommended: cap + load-more for v1.)
