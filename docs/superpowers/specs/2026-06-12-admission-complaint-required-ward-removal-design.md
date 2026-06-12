# Admission: required chief complaint + ward removal — design

**Date:** 2026-06-12
**Status:** Approved

## Goal

Two changes to the patient admission flow and surrounding surfaces:

1. **Chief complaint becomes compulsory at admission.** The wizard blocks Continue on step 3 (Medical) until a non-empty complaint is entered, and the server rejects admissions without one.
2. **Ward disappears from every user-visible surface.** The admission form, edit form, all display surfaces, reports, exports, and search stop referencing ward. The `ward` column in the database and all existing data stay untouched — no migration.

## Decisions made

- **Ward removal scope:** everywhere user-visible — admission form, edit form, display surfaces, reports/PDF/WhatsApp text, and search matching + placeholder copy. Ward becomes invisible legacy data in the DB.
- **Complaint requirement scope:** admission only. `UpdateAnimalSchema` is unchanged so legacy records (admitted before this rule, possibly with an empty complaint) remain editable without forced backfill.
- **Plumbing depth:** ward is stripped end-to-end (Zod schemas, service write paths, audit diff list, queries/selects, types, UI) — not merely hidden in the UI. Only `prisma/schema.prisma`, migrations, existing rows, and historical audit-log JSON keep it. Rejected alternative: UI-only hiding, which would leave dead plumbing (selects fetching data nobody renders, schemas accepting a field no form sends).

## Part 1 — Chief complaint required

- `src/features/animals/schema.ts`: in `CreateAnimalSchema`, `complaint` changes from
  `z.string().max(2000).optional().or(z.literal(''))` to
  `z.string().trim().min(1, 'Chief complaint is required').max(2000)`.
  The wizard resolver (`useAdmissionForm.ts`), the server action (`actions.ts:27`), and the service (`service.ts:35`) all parse this same schema, so client- and server-side enforcement come from this one change. `trim()` blocks whitespace-only input.
- `src/features/animals/components/AdmissionWizard/index.tsx`: step-3 gate in `STEP_VALIDATION` changes from `['status']` to `['status', 'complaint']` so Continue triggers the Zod check and blocks with an inline error.
- `src/features/animals/components/AdmissionWizard/Step3Medical.tsx`: the complaint `FormField` gets `required` (red asterisk) and `error={formState.errors.complaint?.message}`; the `Textarea` gets `invalid={!!formState.errors.complaint}`. Same pattern as the Name field in `Step1Basics.tsx`.
- `service.ts` create mapping keeps `complaint: nz(parsed.complaint)` — harmless now that `''` can no longer reach it.

## Part 2 — Ward removal

By layer (file references as of this design):

**Admission wizard**
- `Step3Medical.tsx:30-32` — remove the "Ward (legacy)" `FormField` + `Input`.
- `useAdmissionForm.ts:28` — remove `ward: ''` from `DEFAULTS`.

**Edit page**
- `AnimalEditForm.tsx` — remove ward from the props type (line 26), the submitted patch (line 72), and the Ward `Input` (line 221); retitle the section "Status, cage & ward" → "Status & cage" (line 193).
- `src/app/(app)/patients/[id]/edit/page.tsx:30` — stop passing `ward`.

**Display surfaces**
- `AnimalHero.tsx` — remove the ward chip (line 103) and prop type (line 20).
- `AnimalDetailsTab.tsx` — remove the `Field label="Ward"` row (line 80) and plumbing (line 45).
- `AnimalDetail.tsx:167,216` — stop passing `ward` down.
- `PatientCard.tsx:35`, `quick-add/PatientPicker.tsx:99`, `reports/components/AnimalPickerList.tsx:79`, `reports/components/PerAnimalReportView.tsx:63` — remove the ` · ward` suffixes.

**Reports & exports**
- `reports/patient-pdf/model.ts` — `wardCage` field (lines 105, 225) becomes `cage` (cage name only); `Report.tsx:365` label "Ward / Cage" → "Cage"; `patient-pdf/data.ts:75` stops selecting/passing ward.
- `reports/dailyReportText.ts` — drop ward from the group header (lines 59, 65, 78-79).
- `activities/shareText.ts` — drop `animalWard` from `ShareTextInput` and the header line (lines 39, 53-54); `activities/actions.ts:213,224` stop selecting/passing it.
- `reports/queries.ts` — remove ward from selects and mappings (lines 193, 204, 238, 247, 272, 288).

**Search**
- `animals/queries.ts` — remove the ward `contains` clauses from both search ORs (lines 115, 197) and ward from row types/selects (lines 20, 43, 77, 177, 206).
- Placeholder/empty-state copy no longer mentions ward: `PatientListFilters.tsx:61`, `quick-add/PatientPicker.tsx:62`, `search/CommandPalette.tsx:156`.

**Schemas & service**
- `schema.ts` — remove `ward` from `CreateAnimalSchema` (line 44) and `UpdateAnimalSchema` (line 100).
- `service.ts` — remove the create mapping (line 64), the update mapping (line 182), `'ward'` from `AUDITED_ANIMAL_FIELDS` (line 238), and `ward: before.ward` from the soft-delete audit snapshot (line 291). Safe: soft delete keeps the full row, so no forensic data is lost.
- `actions.ts` — remove `ward` from `AnimalDetailRow` (line 58) and the mapping (line 106).

**Untouched**
- `prisma/schema.prisma` (`ward String?` stays), all migrations, existing row data, historical audit-log JSON entries that mention ward.
- New admissions get `ward = NULL` simply because nothing writes the column anymore.

## Part 3 — Test updates

- **Integration:** `animals/__integration__/animals.test.ts` and `trash/__integration__/trash.test.ts` create payloads gain a `complaint` value (currently omitted — they would fail the new required rule). The RBAC update test (`animals.test.ts:61-64`) swaps its `{ ward: 'A' }` patch for `{ injuryType: 'A' }` and asserts that instead.
- **Unit:** `activities/__tests__/shareText.test.ts` (drops "omits ward when null" case), `reports/__tests__/dailyReportText.test.ts:66`, `reports/patient-pdf/__tests__/model.test.ts` and `render.test.ts` lose ward expectations / fixtures.
- **E2E:** `tests/e2e/admission.spec.ts:27` drops the Ward fill. All wizard-driving specs already fill Chief complaint, so the required rule breaks none of them. Add one assertion to `admission.spec.ts`: clicking Continue on step 3 with an empty complaint shows "Chief complaint is required" and stays on step 3.

## Part 4 — Validation before "done"

1. Typecheck + lint.
2. Unit tests.
3. Integration tests against the seeded **local** DB — verify the DB target first; `.env.local` points at Neon prod.
4. Full e2e run against the running stack.
5. Then a PR.

## Error handling

- Empty/whitespace complaint at step 3: inline field error, Continue blocked (client). Direct server calls with empty complaint: Zod reject from the shared schema (server).
- Payloads that still send `ward` after removal: Zod strips unknown keys by default (`z.object` non-strict), so stale clients/scripts degrade gracefully — ward is ignored, not an error.
