# Admission: Required Chief Complaint + Ward Removal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make chief complaint compulsory at admission (client + server), and remove the legacy `ward` field from every user-visible surface while keeping the DB column and data untouched.

**Architecture:** The admission wizard, the server action, and the service all validate with the same `CreateAnimalSchema` Zod object, so the complaint rule is one schema change plus wizard UI wiring. Ward is stripped top-down — wizard UI → edit form → display surfaces → query/type plumbing → reports → schemas/service — so every commit typechecks green. No Prisma migration: `prisma/schema.prisma` keeps `ward String?`.

**Tech Stack:** Next.js App Router, react-hook-form + zodResolver, zod 3.23.8, Prisma 5, Vitest (unit jsdom + integration node), Playwright, Biome.

**Spec:** `docs/superpowers/specs/2026-06-12-admission-complaint-required-ward-removal-design.md`

**Branch:** `admission-complaint-ward` (already created; spec committed on it).

**⚠️ DB safety (read before Task 9):** `.env.local` points at **Neon production**. Never run `pnpm test:integration`, `pnpm db:seed`, or `pnpm db:migrate` as-is — they load `.env.local`. Task 9 builds a gitignored `.env.e2e.local` pointing at the local docker Postgres and runs everything through it explicitly.

---

### Task 1: `CreateAnimalSchema` — complaint becomes required (TDD)

**Files:**
- Create: `src/features/animals/__tests__/schema.test.ts`
- Modify: `src/features/animals/schema.ts:39`
- Modify: `src/features/animals/__integration__/animals.test.ts` (7 create payloads)
- Modify: `src/features/trash/__integration__/trash.test.ts` (3 create payloads)

- [ ] **Step 1: Write the failing unit test**

Create `src/features/animals/__tests__/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CreateAnimalSchema } from '../schema';

// Minimal valid input minus complaint — every other required field either
// appears here or carries a schema default.
const base = { name: 'Bruno', species: 'Dog' as const };

describe('CreateAnimalSchema — complaint', () => {
  it('rejects a missing complaint', () => {
    const r = CreateAnimalSchema.safeParse(base);
    expect(r.success).toBe(false);
  });

  it('rejects an empty complaint with the field message', () => {
    const r = CreateAnimalSchema.safeParse({ ...base, complaint: '' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path[0] === 'complaint');
      expect(issue?.message).toBe('Chief complaint is required');
    }
  });

  it('rejects a whitespace-only complaint', () => {
    const r = CreateAnimalSchema.safeParse({ ...base, complaint: '   ' });
    expect(r.success).toBe(false);
  });

  it('accepts and trims a real complaint', () => {
    const r = CreateAnimalSchema.safeParse({ ...base, complaint: '  Hit by vehicle ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.complaint).toBe('Hit by vehicle');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/features/animals/__tests__/schema.test.ts`
Expected: FAIL — "rejects a missing complaint", "rejects an empty complaint", and "rejects a whitespace-only complaint" fail because `complaint` is currently optional.

- [ ] **Step 3: Make complaint required in the schema**

In `src/features/animals/schema.ts`, replace line 39:

```ts
  complaint: z.string().max(2000).optional().or(z.literal('')),
```

with:

```ts
  complaint: z.string().trim().min(1, 'Chief complaint is required').max(2000),
```

Leave `UpdateAnimalSchema`'s `complaint: nullableStr(2000)` (line 92) unchanged — edit stays lenient by design.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/features/animals/__tests__/schema.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add `complaint` to every integration-test create payload**

`CreateAnimalInput` now requires `complaint`, so `pnpm typecheck` fails until each `createAnimal(actor, {...})` payload gains one. Find them all:

Run: `grep -rn "createAnimal(" src --include="*.test.ts"`
Expected call sites (10): `src/features/animals/__integration__/animals.test.ts` lines ~22, 50, 70, 105, 124, 164, 187 and `src/features/trash/__integration__/trash.test.ts` lines ~37, 76, 96.

In **each** of those object literals, add one line directly after the `species:` line:

```ts
      complaint: 'QA: test complaint',
```

Example — the first payload in `animals.test.ts` becomes:

```ts
    const created = await createAnimal(staff, {
      name,
      species: 'Dog',
      complaint: 'QA: test complaint',
      breed: 'Indie',
      gender: 'MALE',
      ageText: '~2 yrs',
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'OBSERVATION',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
```

(Same one-line insertion in all 10 payloads, including the overlength-name test at `animals.test.ts:187` — it must fail on `name`, not on a missing complaint.)

- [ ] **Step 6: Typecheck and unit tests**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck clean; all unit tests pass. (Integration tests are NOT run here — they need the local DB; Task 9 runs them.)

- [ ] **Step 7: Commit**

```bash
git add src/features/animals/__tests__/schema.test.ts src/features/animals/schema.ts src/features/animals/__integration__/animals.test.ts src/features/trash/__integration__/trash.test.ts
git commit -m "feat(admission): require non-empty chief complaint in CreateAnimalSchema

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Admission wizard — gate step 3 on complaint, drop the Ward field

**Files:**
- Modify: `src/features/animals/components/AdmissionWizard/Step3Medical.tsx` (full rewrite below)
- Modify: `src/features/animals/components/AdmissionWizard/index.tsx:17`
- Modify: `src/features/animals/components/AdmissionWizard/useAdmissionForm.ts:28`
- Modify: `tests/e2e/admission.spec.ts:25-29`

- [ ] **Step 1: Rewrite `Step3Medical.tsx`**

Replace the entire file content with:

```tsx
'use client';
import { FormField, FormSection } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import type { UseFormReturn } from 'react-hook-form';
import { type CreateAnimalInput, STATUSES } from '../../schema';
import { CageSelect } from '../CageSelect';

interface Props {
  form: UseFormReturn<CreateAnimalInput>;
  cages: { id: string; name: string }[];
}

export function Step3Medical({ form, cages }: Props) {
  const { register, formState } = form;
  return (
    <FormSection title="Medical condition" description="Why is this animal in IPD?">
      <FormField
        label="Chief complaint"
        htmlFor="complaint"
        required
        error={formState.errors.complaint?.message}
      >
        <Textarea
          id="complaint"
          rows={3}
          {...register('complaint')}
          invalid={!!formState.errors.complaint}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Injury type" htmlFor="injuryType" hint="Trauma, medical, post-op, etc.">
          <Input id="injuryType" {...register('injuryType')} />
        </FormField>
        <FormField label="Cage" htmlFor="cageId" hint="Assign now or leave unassigned">
          <CageSelect id="cageId" options={cages} {...register('cageId')} />
        </FormField>
      </div>
      <FormField label="History" htmlFor="history">
        <Textarea id="history" rows={3} {...register('history')} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Status" htmlFor="status">
          <Select id="status" {...register('status')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </FormField>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" {...register('contagious')} className="h-4 w-4 accent-accent" />
          Contagious
        </label>
      </div>
    </FormSection>
  );
}
```

This is the existing file with three changes: the complaint field gains `required` + `error` + `invalid` (same pattern as the Name field in `Step1Basics.tsx`), the `Ward (legacy)` FormField is deleted, and `formState` is destructured.

- [ ] **Step 2: Gate Continue on complaint**

In `src/features/animals/components/AdmissionWizard/index.tsx`, change the `STEP_VALIDATION` entry for step 2 (the third step, 0-indexed):

```ts
  2: ['status'],
```

becomes:

```ts
  2: ['status', 'complaint'],
```

- [ ] **Step 3: Drop ward from form defaults**

In `src/features/animals/components/AdmissionWizard/useAdmissionForm.ts`, delete line 28 from `DEFAULTS`:

```ts
  ward: '',
```

(`CreateAnimalInput` still has `ward` as optional until Task 8, so omitting it compiles.)

- [ ] **Step 4: Update the admission e2e spec**

In `tests/e2e/admission.spec.ts`, replace the Step 3 block (lines 25-29):

```ts
  // Step 3: Medical
  await page.getByLabel('Chief complaint').fill('Hit by vehicle');
  await page.getByLabel('Ward').fill('ICU-2');
  await page.getByLabel('Status').selectOption('CRITICAL');
  await page.getByRole('button', { name: 'Continue' }).click();
```

with:

```ts
  // Step 3: Medical — chief complaint is required, so an empty Continue
  // must block with an inline error and stay on this step.
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Chief complaint is required')).toBeVisible();
  await page.getByLabel('Chief complaint').fill('Hit by vehicle');
  await page.getByLabel('Status').selectOption('CRITICAL');
  await page.getByRole('button', { name: 'Continue' }).click();
```

(The Ward fill is gone — the field no longer exists. `getByLabel` substring-matches, so the new required asterisk in the label doesn't break the locator.)

- [ ] **Step 5: Typecheck + lint + unit tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all clean. (E2E runs in Task 9 against the local stack.)

- [ ] **Step 6: Commit**

```bash
git add src/features/animals/components/AdmissionWizard/Step3Medical.tsx src/features/animals/components/AdmissionWizard/index.tsx src/features/animals/components/AdmissionWizard/useAdmissionForm.ts tests/e2e/admission.spec.ts
git commit -m "feat(admission): gate step 3 on chief complaint; drop Ward field from wizard

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Remove Ward from the edit form and its feeders

**Files:**
- Modify: `src/features/animals/components/AnimalEditForm.tsx` (4 spots)
- Modify: `src/app/(app)/patients/[id]/edit/page.tsx:30`
- Modify: `src/features/animals/components/AnimalDetailsTab.tsx` (2 spots)

- [ ] **Step 1: `AnimalEditForm.tsx` — strip ward**

Four edits:

1. In the `Props` interface's `animal` object (line 26), delete:
```ts
    ward: string | null;
```

2. In the `updateAnimalAction` patch inside `submit` (line 72), delete:
```ts
        ward: form.ward,
```

3. Retitle the section (line 193):
```tsx
      <FormSection title="Status, cage & ward">
```
becomes:
```tsx
      <FormSection title="Status & cage">
```

4. Delete the Ward field block (lines 219-223):
```tsx
        <FormField label="Ward (legacy)">
          {(id) => (
            <Input id={id} value={form.ward ?? ''} onChange={(e) => onField('ward', e.target.value)} />
          )}
        </FormField>
```

- [ ] **Step 2: `edit/page.tsx` — stop passing ward**

In `src/app/(app)/patients/[id]/edit/page.tsx`, delete line 30 from the `animal={{...}}` literal:

```ts
          ward: animal.ward,
```

- [ ] **Step 3: `AnimalDetailsTab.tsx` — stop passing and stop displaying ward**

Two edits:

1. In the `AnimalEditForm` feed inside the `editing` branch (line 45), delete:
```ts
            ward: animal.ward,
```

2. In the Details grid (line 80), delete:
```tsx
          <Field label="Ward" value={animal.ward} />
```

(`AnimalDetailRow` still carries `ward` until Task 5, so the remaining reads compile.)

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. The deleted prop would be an excess-property error if any feeder still passed it — both feeders were just fixed.

- [ ] **Step 5: Commit**

```bash
git add src/features/animals/components/AnimalEditForm.tsx "src/app/(app)/patients/[id]/edit/page.tsx" src/features/animals/components/AnimalDetailsTab.tsx
git commit -m "feat(patients): remove Ward from edit form and details tab

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Remove Ward from display surfaces and search copy

**Files:**
- Modify: `src/features/animals/components/AnimalHero.tsx` (2 spots)
- Modify: `src/features/animals/components/AnimalDetail.tsx:167`
- Modify: `src/features/animals/components/PatientCard.tsx:35`
- Modify: `src/features/quick-add/PatientPicker.tsx` (2 spots)
- Modify: `src/features/reports/components/AnimalPickerList.tsx:79`
- Modify: `src/features/reports/components/PerAnimalReportView.tsx:63`
- Modify: `src/features/animals/components/PatientListFilters.tsx:61`
- Modify: `src/features/search/CommandPalette.tsx:156`

- [ ] **Step 1: `AnimalHero.tsx`**

1. In the `Props.animal` type (line 20), delete:
```ts
    ward: string | null;
```
2. In the chips row (line 103), delete:
```tsx
            {animal.ward && <Chip>{animal.ward}</Chip>}
```

- [ ] **Step 2: `AnimalDetail.tsx` — hero feed only**

In the `<AnimalHero animal={{...}}>` literal (line 167), delete:
```ts
          ward: animal.ward,
```
**Do NOT touch line 216** (the `AnimalDetailsTab` feed) yet — `AnimalDetailRow` still requires `ward` until Task 5.

- [ ] **Step 3: `PatientCard.tsx`**

In the subtitle line (line 35), delete:
```tsx
          {animal.ward ? ` · ${animal.ward}` : ''}
```

- [ ] **Step 4: `PatientPicker.tsx` (quick-add)**

1. Placeholder (line 62):
```tsx
          placeholder="Search by name, species, ward…"
```
becomes:
```tsx
          placeholder="Search by name, species…"
```
2. Row subtitle (line 99), delete:
```tsx
                {a.ward ? ` · ${a.ward}` : ''}
```

- [ ] **Step 5: `AnimalPickerList.tsx` (reports)**

In the row subtitle (line 79), delete:
```tsx
                      {r.ward ? ` · ${r.ward}` : ''}
```

- [ ] **Step 6: `PerAnimalReportView.tsx`**

In the header subtitle (line 63), delete:
```tsx
              {animal.ward ? ` · ${animal.ward}` : ''}
```

- [ ] **Step 7: `PatientListFilters.tsx`**

Placeholder (line 61):
```tsx
          placeholder="Search name, breed, ward…"
```
becomes:
```tsx
          placeholder="Search name, breed…"
```

- [ ] **Step 8: `CommandPalette.tsx`**

Empty-state copy (line 156):
```tsx
                ? 'No matches. Try a name, breed, ward, or activity note.'
```
becomes:
```tsx
                ? 'No matches. Try a name, breed, or activity note.'
```

- [ ] **Step 9: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean — these were all render-level deletions; the types still carry `ward` until the next task.

- [ ] **Step 10: Commit**

```bash
git add src/features/animals/components/AnimalHero.tsx src/features/animals/components/AnimalDetail.tsx src/features/animals/components/PatientCard.tsx src/features/quick-add/PatientPicker.tsx src/features/reports/components/AnimalPickerList.tsx src/features/reports/components/PerAnimalReportView.tsx src/features/animals/components/PatientListFilters.tsx src/features/search/CommandPalette.tsx
git commit -m "feat(ui): stop displaying ward across patient surfaces and search copy

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Remove ward from animal queries, search matching, and row types

**Files:**
- Modify: `src/features/animals/queries.ts` (7 spots)
- Modify: `src/features/animals/actions.ts` (2 spots)
- Modify: `src/features/animals/components/AnimalDetail.tsx:216`

- [ ] **Step 1: `queries.ts`**

Seven deletions:

1. `AnimalListItem` interface (line 20): delete `ward: string | null;`
2. `ANIMAL_CARD_SELECT` (line 43): delete `ward: true,`
3. `toAnimalListItem` (line 77): delete `ward: r.ward,`
4. `listAnimals` search `OR` (line 115): delete
```ts
            { ward: { contains: search, mode: 'insensitive' as const } },
```
5. `ActiveAnimalLite` interface (line 177): delete `ward: string | null;`
6. `_searchActiveAnimalsRaw` `OR` (line 197): delete
```ts
            { ward: { contains: q, mode: 'insensitive' as const } },
```
7. `_searchActiveAnimalsRaw` select (line 206): change
```ts
    select: { id: true, name: true, species: true, ward: true, status: true },
```
to:
```ts
    select: { id: true, name: true, species: true, status: true },
```

(`getAnimal` uses `include` — full row — so it needs no change; consumers already stopped reading `.ward` where it mattered.)

- [ ] **Step 2: `actions.ts`**

1. `AnimalDetailRow` interface (line 58): delete `ward: string | null;`
2. The mapping in `updateAnimalAction` (line 106): delete `ward: updated.ward,`

- [ ] **Step 3: `AnimalDetail.tsx` — details-tab feed**

In the `<AnimalDetailsTab animal={{...}}>` literal (line 216), delete:
```ts
                ward: animal.ward,
```

- [ ] **Step 4: Typecheck + lint + unit tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: clean. If typecheck reports any other `.ward` consumer of these types, delete that read too — Tasks 3-4 should already have covered them all.

- [ ] **Step 5: Commit**

```bash
git add src/features/animals/queries.ts src/features/animals/actions.ts src/features/animals/components/AnimalDetail.tsx
git commit -m "feat(animals): drop ward from list/search queries and row types

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Remove ward from share text + daily report text (tests first)

**Files:**
- Modify: `src/features/activities/__tests__/shareText.test.ts`
- Modify: `src/features/activities/shareText.ts`
- Modify: `src/features/activities/actions.ts` (2 spots)
- Modify: `src/features/reports/__tests__/dailyReportText.test.ts`
- Modify: `src/features/reports/dailyReportText.ts`
- Modify: `src/features/reports/queries.ts` (6 spots)

- [ ] **Step 1: Update `shareText.test.ts` to expect no ward**

1. `baseAnimal` (lines 5-9) becomes:
```ts
const baseAnimal = {
  animalName: 'Buddy',
  animalSpecies: 'Dog',
};
```
2. First test's expected header (line 26): `'🐶 *Buddy* (Dog · A1) · 20 May 2026'` becomes `'🐶 *Buddy* (Dog) · 20 May 2026'`.
3. Delete the entire `it('omits ward when null', …)` test (lines 48-61).
4. In `it('falls back to 🐾 for unknown species', …)`, delete the `animalWard: null,` line.

- [ ] **Step 2: Update `dailyReportText.test.ts` to expect no ward**

1. In the `row()` helper, delete `animalWard: null,` (line 11).
2. Rename the test at line 66 from `'sorts animal groups alphabetically (case-insensitive) and includes ward'` to `'sorts animal groups alphabetically (case-insensitive)'`; delete the `animalWard: 'ISO-A',` and `animalWard: 'Surgery-1',` lines from its two rows; change the expected lines `'🐶 *bruno* (Dog · Surgery-1)'` → `'🐶 *bruno* (Dog)'` and `'🐱 *Milo* (Cat · ISO-A)'` → `'🐱 *Milo* (Cat)'`.

- [ ] **Step 3: Run both test files to verify they fail**

Run: `pnpm exec vitest run src/features/activities/__tests__/shareText.test.ts src/features/reports/__tests__/dailyReportText.test.ts`
Expected: FAIL — the implementations still render the ward part (and the removed `animalWard` property is still required by `ShareTextInput`/`ActivityRow`, which surfaces in Step 6's typecheck).

- [ ] **Step 4: Strip ward from the implementations**

`src/features/activities/shareText.ts`:
1. In `ShareTextInput` (line 39), delete `animalWard: string | null;`
2. Replace (lines 53-54):
```ts
  const wardPart = a.animalWard ? ` · ${a.animalWard}` : '';
  lines.push(`${emoji} *${a.animalName}* (${a.animalSpecies}${wardPart}) · ${shortDate(a.occurredAt)}`);
```
with:
```ts
  lines.push(`${emoji} *${a.animalName}* (${a.animalSpecies}) · ${shortDate(a.occurredAt)}`);
```

`src/features/activities/actions.ts`:
1. Select (line 213): `animal: { select: { name: true, species: true, ward: true } },` → `animal: { select: { name: true, species: true } },`
2. Call site (line 224): delete `animalWard: row.animal.ward,`

`src/features/reports/dailyReportText.ts`:
1. Groups map type (line 59): `{ name: string; species: string; ward: string | null; rows: ActivityRow[] }` → `{ name: string; species: string; rows: ActivityRow[] }`
2. Group init (line 65): delete `ward: r.animalWard,`
3. Replace (lines 78-81):
```ts
    const wardPart = g.ward ? ` · ${g.ward}` : '';
    // Animal name bolded; species + ward stay regular weight so the
    // emphasis lands cleanly on the patient identifier.
    lines.push(`${speciesEmoji(g.species)} *${g.name}* (${g.species}${wardPart})`);
```
with:
```ts
    // Animal name bolded; species stays regular weight so the
    // emphasis lands cleanly on the patient identifier.
    lines.push(`${speciesEmoji(g.species)} *${g.name}* (${g.species})`);
```

`src/features/reports/queries.ts`:
1. `ActivityRow` interface (line 163): delete `animalWard: string | null;`
2. `listActivitiesOnDate` select (line 193): `animal: { select: { name: true, species: true, ward: true } },` → `animal: { select: { name: true, species: true } },`
3. `listActivitiesOnDate` mapping (line 204): delete `animalWard: r.animal.ward,`
4. `listActivitiesOnDateForAnimal` select (line 238): same select change as #2.
5. `listActivitiesOnDateForAnimal` mapping (line 247): delete `animalWard: r.animal.ward,`
6. `PerAnimalReport.animal` type (line 272): delete `ward: string | null;` and in `getPerAnimalReport`'s select (line 288) delete `ward: true,`

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/features/activities/__tests__/shareText.test.ts src/features/reports/__tests__/dailyReportText.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + lint + full unit suite**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: clean. (PDF tests still pass — the PDF pipeline is untouched until Task 7.)

- [ ] **Step 7: Commit**

```bash
git add src/features/activities/__tests__/shareText.test.ts src/features/activities/shareText.ts src/features/activities/actions.ts src/features/reports/__tests__/dailyReportText.test.ts src/features/reports/dailyReportText.ts src/features/reports/queries.ts
git commit -m "feat(reports): drop ward from share text, daily report, and report queries

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Patient PDF — "Ward / Cage" becomes "Cage" (tests first)

**Files:**
- Modify: `src/features/reports/patient-pdf/__tests__/model.test.ts`
- Modify: `src/features/reports/patient-pdf/__tests__/render.test.ts:14`
- Modify: `src/features/reports/patient-pdf/model.ts` (3 spots)
- Modify: `src/features/reports/patient-pdf/Report.tsx:365`
- Modify: `src/features/reports/patient-pdf/data.ts:75`

- [ ] **Step 1: Update the PDF tests**

`model.test.ts`:
1. In the `raw` fixture's `animal`, delete the line `ward: 'ICU',`.
2. Inside the existing `it('computes outcome, stats, meds, day groups', …)` block, add after the `m.patient.name` assertion:
```ts
    expect(m.patient.cage).toBe('C-3');
```

`render.test.ts`:
Line 14: `wardCage: 'ICU · C-3',` becomes `cage: 'C-3',`.

- [ ] **Step 2: Run the PDF tests to verify they fail**

Run: `pnpm exec vitest run src/features/reports/patient-pdf/__tests__/model.test.ts src/features/reports/patient-pdf/__tests__/render.test.ts`
Expected: FAIL — `m.patient.cage` is undefined (the model still builds `wardCage`).

- [ ] **Step 3: Update the implementation**

`src/features/reports/patient-pdf/model.ts`:
1. `RawReportData.animal` (line 58): delete `ward: string | null;`
2. `ReportModel.patient` (line 105): `wardCage: string;` becomes `cage: string;`
3. Builder (line 225): `wardCage: [a.ward, a.cageName].filter(Boolean).join(' · '),` becomes `cage: a.cageName ?? '',`

(`kv()` in `Report.tsx` skips falsy values, so a missing cage hides the row — same behavior as before.)

`src/features/reports/patient-pdf/Report.tsx` (line 365):
```tsx
              {kv('Ward / Cage', p.wardCage)}
```
becomes:
```tsx
              {kv('Cage', p.cage)}
```

`src/features/reports/patient-pdf/data.ts` (line 75): delete `ward: animal.ward,`

- [ ] **Step 4: Run the PDF tests to verify they pass**

Run: `pnpm exec vitest run src/features/reports/patient-pdf/__tests__/model.test.ts src/features/reports/patient-pdf/__tests__/render.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/reports/patient-pdf/__tests__/model.test.ts src/features/reports/patient-pdf/__tests__/render.test.ts src/features/reports/patient-pdf/model.ts src/features/reports/patient-pdf/Report.tsx src/features/reports/patient-pdf/data.ts
git commit -m "feat(pdf): replace Ward / Cage row with Cage in the patient report

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Strip ward from Zod schemas, service write paths, and audit list

**Files:**
- Modify: `src/features/animals/schema.ts` (2 spots)
- Modify: `src/features/animals/service.ts` (5 spots)
- Modify: `src/features/animals/__integration__/animals.test.ts:61-64`

- [ ] **Step 1: `schema.ts`**

1. In `CreateAnimalSchema` (line 44), delete:
```ts
  ward: z.string().max(40).optional().or(z.literal('')),
```
2. In `UpdateAnimalSchema` (line 100), delete:
```ts
  ward: nullableStr(40),
```

- [ ] **Step 2: `service.ts`**

1. Create mapping (line 64): delete `ward: nz(parsed.ward),`
2. Update mapping (line 182): delete `if (parsed.ward !== undefined) data.ward = parsed.ward;`
3. The SD-10 comment (line 195) names ward in its historical field list — update it so a repo-wide ward grep stays clean:
```ts
      // {name, status, ward, complaint} — silently dropping clinical edits
```
becomes:
```ts
      // {name, status, complaint} — silently dropping clinical edits
```
4. `AUDITED_ANIMAL_FIELDS` (line 238): delete the `'ward',` entry.
5. Soft-delete audit snapshot (line 291): delete `ward: before.ward,` (soft delete keeps the full row, so nothing forensic is lost).

- [ ] **Step 3: Swap the RBAC integration test off ward**

In `src/features/animals/__integration__/animals.test.ts` (the `'STAFF cannot edit an animal'` test), replace:

```ts
    await expect(updateAnimal(staff, created.id, { ward: 'A' })).rejects.toBeInstanceOf(RbacError);
    // DOCTOR is allowed
    const updated = await updateAnimal(doctor, created.id, { ward: 'A', diagnosis: 'Probable URI' });
    expect(updated.ward).toBe('A');
    expect(updated.diagnosis).toBe('Probable URI');
```

with:

```ts
    await expect(updateAnimal(staff, created.id, { injuryType: 'Trauma' })).rejects.toBeInstanceOf(
      RbacError,
    );
    // DOCTOR is allowed
    const updated = await updateAnimal(doctor, created.id, {
      injuryType: 'Trauma',
      diagnosis: 'Probable URI',
    });
    expect(updated.injuryType).toBe('Trauma');
    expect(updated.diagnosis).toBe('Probable URI');
```

- [ ] **Step 4: Verify no ward references remain outside Prisma**

Run: `grep -rnw "ward" src tests --include="*.ts" --include="*.tsx" | grep -viE "forward|backward|toward|awkward"`
Expected: **no output**. (Prisma schema/migrations intentionally keep the column and are outside this grep.)

Run: `grep -rn "animalWard\|wardCage" src tests`
Expected: **no output**.

- [ ] **Step 5: Typecheck + lint + unit tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/animals/schema.ts src/features/animals/service.ts src/features/animals/__integration__/animals.test.ts
git commit -m "feat(animals): drop ward from create/update schemas, service writes, and audit diff

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Full-stack validation against the LOCAL database

**⚠️ Never use `pnpm test:integration`, `pnpm db:seed`, or `pnpm db:migrate` here — those npm scripts hardcode `.env.local`, which points at Neon production.**

**Files:**
- Create: `.env.e2e.local` (gitignored via the `.env*.local` pattern — verify with `git status`, it must NOT appear)

- [ ] **Step 1: Start the local Postgres**

Run: `pnpm db:up`
Expected: container `arham_ipd_pg` up (Postgres 16 on port 5433). Verify health: `docker compose ps` shows `healthy`.

- [ ] **Step 2: Create `.env.e2e.local`**

```bash
cat > .env.e2e.local <<EOF
DATABASE_URL="postgresql://arham:arham_dev@localhost:5433/arham_ipd?schema=public"
DIRECT_URL="postgresql://arham:arham_dev@localhost:5433/arham_ipd?schema=public"
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_URL="http://localhost:3000"
STORAGE_DRIVER="local"
EOF
```

Then verify the DB target before ANY write:

Run: `pnpm exec dotenv -e .env.e2e.local -- node -e "console.log(new URL(process.env.DATABASE_URL).host)"`
Expected: exactly `localhost:5433`. **If it prints anything else (especially a `neon.tech` host), STOP.**

Also run `git status --short` and confirm `.env.e2e.local` is not listed (gitignored).

- [ ] **Step 3: Migrate + seed the local DB**

```bash
pnpm exec dotenv -e .env.e2e.local -- pnpm exec prisma migrate deploy
pnpm exec dotenv -e .env.e2e.local -- pnpm exec tsx prisma/seed.ts
```

Expected: migrations applied; output includes `Seeded 6 users.` and the e2e fixture line (`[seed] e2e fixture created: …` or `…already exists, skipping`). Note: `migrate deploy`, not `migrate dev` — dev is interactive and there is no schema change in this work.

- [ ] **Step 4: Integration tests (local DB)**

Run: `pnpm exec dotenv -e .env.e2e.local -- pnpm exec vitest run --config vitest.integration.config.ts`
Expected: all integration suites pass — including the updated `animals.test.ts` (complaint payloads + `injuryType` RBAC swap) and `trash.test.ts`.

- [ ] **Step 5: E2E (local stack)**

```bash
# Nothing else may be serving :3000 (a stray dev server could point at prod):
lsof -ti:3000 && kill $(lsof -ti:3000) || true
# Start the app against the LOCAL env (background):
pnpm exec dotenv -e .env.e2e.local -- pnpm exec next dev --port 3000
# (run in background; wait until "Ready" appears)
```

Then run: `pnpm test:e2e`
Expected: all Playwright specs pass. `playwright.config.ts` has `reuseExistingServer: !CI`, so it reuses the local-env server instead of booting one with `.env.local`. The admission spec now exercises the required-complaint error and no longer fills Ward.

Afterwards stop the background dev server.

- [ ] **Step 6: Manual smoke (optional but recommended)**

With the local server still up: log in as `admin@arham.care` / `admin1234`, open `/patients/new`, walk to step 3, click Continue with an empty complaint (inline error appears, step doesn't advance), fill it, finish admission, and confirm the patient page shows no ward chip and the Details tab has no Ward row.

- [ ] **Step 7: Commit (only if anything changed)**

No source changes are expected from this task. If a fix was needed, commit it with a `fix:` message and re-run the affected suite.

---

### Task 10: Push and open the PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin admission-complaint-ward
```

- [ ] **Step 2: Create the PR**

```bash
gh pr create --title "Admission: require chief complaint; remove ward from UI" --body "$(cat <<'EOF'
## Summary
- Chief complaint is now compulsory at admission: the wizard blocks step 3's Continue with an inline error, and the shared Zod schema rejects empty/whitespace complaints server-side too.
- Ward (legacy) is removed from every user-visible surface: admission wizard, edit form, patient cards/hero/details, quick-add + report pickers, patient search matching + placeholder copy, WhatsApp share/daily text, and the patient PDF ("Ward / Cage" → "Cage").
- The `ward` DB column and all existing data are untouched (no migration). Editing stays lenient: legacy records without a complaint remain editable.

## Validation
- Unit (`pnpm test`), typecheck, lint
- Integration suite against local Postgres (seeded)
- Full Playwright e2e against the local stack, including the new required-complaint assertion

Spec: docs/superpowers/specs/2026-06-12-admission-complaint-required-ward-removal-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.
