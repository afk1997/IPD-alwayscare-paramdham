# Patient Report v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the patient PDF onto Arham Always Care stationery (real logo, red/gold), render every image complete (never cropped), pull Surgery/Diagnostics into dedicated sections, add a recovery photo strip and a closing Outcome & sign-off block with signature lines.

**Architecture:** The existing `data → model → images → render` pipeline stays. `images.ts` starts returning dimensions; a pure `fit.ts` does aspect-ratio math; `model.ts` gains outcome detail, recovery-pair and section extraction; the 485-line `Report.tsx` splits into `styles.ts` + `components.tsx` + `sections.tsx` + a thin assembly. The Pages-API route only adds the generating user's name.

**Tech Stack:** @react-pdf/renderer 4.5.1 (bookmarks + fixed/render props), sharp, Prisma, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-12-patient-report-v2-design.md`
**Branch:** `patient-report-v2` (already created; spec committed).

**⚠️ DB safety (applies to every task):** `.env.local` points at Neon **production**. NEVER run `pnpm test:integration`, `pnpm db:seed`, `pnpm db:migrate`, `pnpm db:push`, or `pnpm test:e2e` against it. Integration/e2e run only in Task 7 through `.env.e2e.local` (local docker Postgres, host-checked). Per-task verification is `pnpm typecheck && pnpm lint && pnpm test` (unit only).

---

### Task 1: Image dimensions — `fit.ts`, dimensioned `images.ts`, type ripple

**Files:**
- Create: `src/features/reports/patient-pdf/fit.ts`
- Create: `src/features/reports/patient-pdf/__tests__/fit.test.ts`
- Modify: `src/features/reports/patient-pdf/images.ts`
- Modify: `src/features/reports/patient-pdf/__tests__/images.test.ts`
- Modify: `src/features/reports/patient-pdf/render.tsx` (signature type)
- Modify: `src/features/reports/patient-pdf/Report.tsx` (map type + `.data` reads only — layout unchanged in this task)
- Modify: `src/features/reports/patient-pdf/__tests__/render.test.ts` (fixture map shape)

- [ ] **Step 1: Write the failing fit test**

Create `src/features/reports/patient-pdf/__tests__/fit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fitWithin } from '../fit';

describe('fitWithin', () => {
  it('scales a landscape image to the width cap', () => {
    expect(fitWithin(1000, 750, 150, 220)).toEqual({ w: 150, h: 112.5 });
  });
  it('scales a tall X-ray to the height cap (no crop)', () => {
    expect(fitWithin(600, 1000, 150, 220)).toEqual({ w: 132, h: 220 });
  });
  it('never upscales a small image', () => {
    expect(fitWithin(80, 60, 150, 220)).toEqual({ w: 80, h: 60 });
  });
  it('falls back to the box for degenerate dimensions', () => {
    expect(fitWithin(0, 0, 150, 220)).toEqual({ w: 150, h: 220 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/features/reports/patient-pdf/__tests__/fit.test.ts`
Expected: FAIL — `Cannot find module '../fit'`.

- [ ] **Step 3: Create `src/features/reports/patient-pdf/fit.ts`**

```ts
// Pure geometry for aspect-ratio-preserving image layout (no deps, no I/O).

export interface ReportImage {
  data: Buffer;
  width: number;
  height: number;
}

// Largest w×h that fits inside maxW×maxH while preserving aspect ratio.
// Never upscales beyond the source dimensions; degenerate input → the box.
export function fitWithin(
  w: number,
  h: number,
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: maxW, h: maxH };
  const scale = Math.min(maxW / w, maxH / h, 1);
  return { w: Math.round(w * scale * 100) / 100, h: Math.round(h * scale * 100) / 100 };
}
```

- [ ] **Step 4: Run the fit test to verify it passes**

Run: `pnpm exec vitest run src/features/reports/patient-pdf/__tests__/fit.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Update the images test to demand dimensions (failing)**

Replace the body of `src/features/reports/patient-pdf/__tests__/images.test.ts` with:

```ts
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { downscaleImage } from '../images';

describe('downscaleImage', () => {
  it('fits within 1000px, outputs JPEG, and reports the output dimensions', async () => {
    const src = await sharp({
      create: { width: 2000, height: 1500, channels: 3, background: { r: 14, g: 124, b: 123 } },
    })
      .png()
      .toBuffer();
    const out = await downscaleImage(src);
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe('jpeg');
    expect(out.width).toBe(meta.width);
    expect(out.height).toBe(meta.height);
    expect(out.width).toBeLessThanOrEqual(1000);
    expect(out.height).toBeLessThanOrEqual(1000);
    expect(out.data.length).toBeLessThan(src.length);
  });
});
```

Run: `pnpm exec vitest run src/features/reports/patient-pdf/__tests__/images.test.ts`
Expected: FAIL — `downscaleImage` still returns a bare Buffer (no `.data`).

- [ ] **Step 6: Make `images.ts` return `ReportImage`**

In `src/features/reports/patient-pdf/images.ts`:

1. Add the import: `import type { ReportImage } from './fit';`
2. Replace `downscaleImage`:

```ts
// Downscale + normalise orientation; JPEG keeps the PDF small.
// Returns the bytes plus output dimensions so the renderer can lay the
// COMPLETE image out at its own aspect ratio (never cropped).
export async function downscaleImage(buf: Buffer): Promise<ReportImage> {
  const { data, info } = await sharp(buf)
    .rotate() // honour EXIF orientation
    .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
```

3. Change `loadReportImages`'s signature and map type (body otherwise unchanged):

```ts
export async function loadReportImages(
  assets: { assetId: string; storageKey: string }[],
): Promise<Map<string, ReportImage>> {
  const out = new Map<string, ReportImage>();
  ...
```

- [ ] **Step 7: Ripple the type through the renderer (no layout change yet)**

1. `src/features/reports/patient-pdf/render.tsx`: change the import and parameter:

```tsx
import type { ReportImage } from './fit';
...
export async function renderPatientReportPdf(
  model: ReportModel,
  images: Map<string, ReportImage>,
): Promise<Buffer> {
```

2. `src/features/reports/patient-pdf/Report.tsx`:
   - Add `import type { ReportImage } from './fit';`
   - Change every `images: Map<string, Buffer>` prop type (in `ImgOrPlaceholder`, `ActivityBlock`, and `Report`) to `images: Map<string, ReportImage>`.
   - In `ImgOrPlaceholder`, change:

```tsx
  const buf = images.get(id);
  if (buf)
    return (
      <Image
        src={{ data: buf, format: 'jpg' }}
```

to:

```tsx
  const img = images.get(id);
  if (img)
    return (
      <Image
        src={{ data: img.data, format: 'jpg' }}
```

3. `src/features/reports/patient-pdf/__tests__/render.test.ts`: change the map construction at the end:

```ts
    const buf = await renderPatientReportPdf(model, new Map([['a1', { data: img, width: 400, height: 300 }]]));
```

- [ ] **Step 8: Verify everything**

Run: `pnpm exec vitest run src/features/reports/patient-pdf/__tests__/images.test.ts src/features/reports/patient-pdf/__tests__/render.test.ts && pnpm typecheck && pnpm lint && pnpm test`
Expected: all green (the route compiles unchanged — it just passes the map through).

- [ ] **Step 9: Commit**

```bash
git add src/features/reports/patient-pdf/fit.ts src/features/reports/patient-pdf/__tests__/fit.test.ts src/features/reports/patient-pdf/images.ts src/features/reports/patient-pdf/__tests__/images.test.ts src/features/reports/patient-pdf/render.tsx src/features/reports/patient-pdf/Report.tsx src/features/reports/patient-pdf/__tests__/render.test.ts
git commit -m "feat(pdf): carry image dimensions through the report pipeline

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Outcome detail + generated-by — model, data, route, integration test

**Files:**
- Modify: `src/features/reports/patient-pdf/model.ts` (Raw types, `buildOutcome`, `buildReportModel` return, `ReportModel`)
- Modify: `src/features/reports/patient-pdf/data.ts` (selects, mapping, signature)
- Modify: `src/pages/api/patients/[id]/report.ts` (select `name`, pass it)
- Modify: `src/features/reports/patient-pdf/__tests__/model.test.ts`
- Modify: `src/features/reports/patient-pdf/__tests__/render.test.ts` (fixture gains new model fields)
- Create: `src/features/reports/__integration__/patient-pdf-data.test.ts`

- [ ] **Step 1: Extend the model test (failing)**

In `src/features/reports/patient-pdf/__tests__/model.test.ts`:

1. In the `raw` fixture, replace `discharge: { dischargedAt: '2026-05-29T10:00:00.000Z' },` with:

```ts
    discharge: {
      dischargedAt: '2026-05-29T10:00:00.000Z',
      summary: 'Recovered well, weight-bearing on all limbs',
      instructions: 'Cone for 5 days; review after 2 weeks',
      dischargedByName: 'Dr. Mehta',
    },
```

2. Add `generatedByName: 'Asha (Reception)',` to the top level of `raw` (next to `generatedAt`).
3. Add assertions inside the existing `it` block, after the outcome assertion:

```ts
    expect(m.outcome.summary).toBe('Recovered well, weight-bearing on all limbs');
    expect(m.outcome.instructions).toBe('Cone for 5 days; review after 2 weeks');
    expect(m.outcome.byName).toBe('Dr. Mehta');
    expect(m.generatedByName).toBe('Asha (Reception)');
```

Run: `pnpm exec vitest run src/features/reports/patient-pdf/__tests__/model.test.ts`
Expected: FAIL (type/shape mismatch — `summary` not on discharge; assertions undefined).

- [ ] **Step 2: Update `model.ts`**

1. `RawReportData.animal.death` becomes:

```ts
    death: { causeOfDeath: string; diedAt: string; recordedByName: string | null } | null;
```

2. `RawReportData.animal.discharge` becomes:

```ts
    discharge: {
      dischargedAt: string;
      summary: string;
      instructions: string | null;
      dischargedByName: string | null;
    } | null;
```

3. `RawReportData` gains (next to `generatedAt`): `generatedByName: string;`
4. `ReportModel.outcome` becomes:

```ts
  outcome: {
    kind: 'in-care' | 'discharged' | 'deceased';
    label: string;
    causeOfDeath: string | null;
    summary: string | null;
    instructions: string | null;
    byName: string | null;
  };
```

5. `ReportModel` gains: `generatedByName: string;`
6. Replace `buildOutcome` with:

```ts
function buildOutcome(a: RawReportData['animal']): ReportModel['outcome'] {
  if (a.death)
    return {
      kind: 'deceased',
      label: `Deceased · ${shortDate(a.death.diedAt)}`,
      causeOfDeath: a.death.causeOfDeath,
      summary: null,
      instructions: null,
      byName: a.death.recordedByName,
    };
  if (a.discharge)
    return {
      kind: 'discharged',
      label: `Discharged · ${shortDate(a.discharge.dischargedAt)}`,
      causeOfDeath: null,
      summary: a.discharge.summary,
      instructions: a.discharge.instructions,
      byName: a.discharge.dischargedByName,
    };
  return {
    kind: 'in-care',
    label: 'In care',
    causeOfDeath: null,
    summary: null,
    instructions: null,
    byName: null,
  };
}
```

7. In `buildReportModel`'s returned object add: `generatedByName: raw.generatedByName,`

- [ ] **Step 3: Update `data.ts`**

1. Selects in the animal query:

```ts
      deathRecord: {
        select: {
          causeOfDeath: true,
          diedAt: true,
          invalidatedAt: true,
          recordedBy: { select: { name: true } },
        },
      },
      dischargeRecord: {
        select: {
          dischargedAt: true,
          summary: true,
          instructions: true,
          invalidatedAt: true,
          dischargedBy: { select: { name: true } },
        },
      },
```

2. The mapped records:

```ts
  const death =
    animal.deathRecord && !animal.deathRecord.invalidatedAt
      ? {
          causeOfDeath: animal.deathRecord.causeOfDeath,
          diedAt: animal.deathRecord.diedAt.toISOString(),
          recordedByName: animal.deathRecord.recordedBy?.name ?? null,
        }
      : null;
  const discharge =
    animal.dischargeRecord && !animal.dischargeRecord.invalidatedAt
      ? {
          dischargedAt: animal.dischargeRecord.dischargedAt.toISOString(),
          summary: animal.dischargeRecord.summary,
          instructions: animal.dischargeRecord.instructions,
          dischargedByName: animal.dischargeRecord.dischargedBy?.name ?? null,
        }
      : null;
```

3. Signature + raw:

```ts
export async function getPatientReportData(
  animalId: string,
  generatedByName: string,
  range?: { from: string; to: string },
): Promise<ReportModel | null> {
```

and in `raw`: `generatedByName,` next to `generatedAt`.

- [ ] **Step 4: Update the route**

In `src/pages/api/patients/[id]/report.ts`:
1. `select: { id: true, role: true, active: true, name: true },`
2. `const model = await getPatientReportData(id, dbUser.name, range);`

- [ ] **Step 5: Update the render-test fixture (typecheck)**

In `src/features/reports/patient-pdf/__tests__/render.test.ts`, the `model` literal:
- `outcome:` becomes `{ kind: 'in-care', label: 'In care', causeOfDeath: null, summary: null, instructions: null, byName: null },`
- add `generatedByName: 'Asha (Reception)',` next to `generatedAt`.

- [ ] **Step 6: Write the integration test (NOT run in this task)**

Create `src/features/reports/__integration__/patient-pdf-data.test.ts`:

```ts
import { getPatientReportData } from '@/features/reports/patient-pdf/data';
import { ADMIN_EMAIL, DOCTOR_EMAIL, actorByEmail, purgeQa, qaName } from '@/lib/__integration__/helpers';
import { prisma } from '@/lib/prisma';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('getPatientReportData — integration vs real DB', () => {
  beforeAll(purgeQa);
  afterAll(purgeQa);

  it('returns discharge summary, instructions, by-name and generatedByName', async () => {
    const admin = await actorByEmail(ADMIN_EMAIL);
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await prisma.animal.create({
      data: {
        name: qaName('ReportV2'),
        species: 'Dog',
        complaint: 'QA: report v2',
        vaccination: 'NONE',
        status: 'DISCHARGED',
        dischargedAt: new Date('2026-06-10T10:00:00Z'),
        createdById: admin.id,
        dischargeRecord: {
          create: {
            summary: 'Recovered well',
            instructions: 'Cone for 5 days',
            dischargedAt: new Date('2026-06-10T10:00:00Z'),
            dischargedById: doctor.id,
          },
        },
      },
    });
    const model = await getPatientReportData(animal.id, 'QA Generator');
    expect(model).not.toBeNull();
    expect(model?.outcome.kind).toBe('discharged');
    expect(model?.outcome.summary).toBe('Recovered well');
    expect(model?.outcome.instructions).toBe('Cone for 5 days');
    expect(model?.outcome.byName).toBeTruthy();
    expect(model?.generatedByName).toBe('QA Generator');
  });
});
```

Do NOT execute it here (needs the local DB) — Task 7 runs it. Typecheck covers compilation.

- [ ] **Step 7: Verify**

Run: `pnpm exec vitest run src/features/reports/patient-pdf/__tests__/model.test.ts && pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/features/reports/patient-pdf/model.ts src/features/reports/patient-pdf/data.ts "src/pages/api/patients/[id]/report.ts" src/features/reports/patient-pdf/__tests__/model.test.ts src/features/reports/patient-pdf/__tests__/render.test.ts src/features/reports/__integration__/patient-pdf-data.test.ts
git commit -m "feat(pdf): outcome detail (summary/instructions/by) + generated-by in the report model

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Recovery pair + Surgery/Diagnostics extraction (model + collect)

**Files:**
- Modify: `src/features/reports/patient-pdf/model.ts`
- Modify: `src/features/reports/patient-pdf/data.ts` (`collectImageAssets`)
- Modify: `src/features/reports/patient-pdf/__tests__/model.test.ts`
- Modify: `src/features/reports/patient-pdf/__tests__/collect.test.ts`
- Modify: `src/features/reports/patient-pdf/__tests__/render.test.ts` (fixture gains the new fields)

- [ ] **Step 1: Extend the model test (failing)**

Append to `src/features/reports/patient-pdf/__tests__/model.test.ts` (inside the existing `describe`, after the first `it`); these reuse the file's `raw` fixture via structured clones:

```ts
  const photo = (assetId: string): (typeof raw.animal.media)[number] => ({
    assetId,
    kind: 'PHOTO',
    label: null,
    filename: `${assetId}.jpg`,
    storageKey: `local:x/${assetId}.jpg`,
  });

  it('extracts surgeries into a section and compacts their log rows', () => {
    const withSurgery: typeof raw = structuredClone(raw);
    withSurgery.activities.push({
      type: 'SURGERY',
      occurredAt: '2026-05-26T11:30:00.000Z',
      byName: 'Dr. Iyer',
      editedAt: null,
      remarks: null,
      data: { surgeryName: 'Fracture repair', surgeon: 'Dr. Iyer', anesthesia: 'Iso' },
      media: [photo('sx1')],
    });
    const m = buildReportModel(withSurgery);
    expect(m.surgeries).toHaveLength(1);
    expect(m.surgeries[0]?.stills.map((s) => s.assetId)).toEqual(['sx1']);
    expect(m.surgeries[0]?.dayLabel).toContain('26 May 2026');
    const logRow = m.days.flatMap((d) => d.entries).find((e) => e.type === 'SURGERY');
    expect(logRow?.crossRef).toBe('surgery');
    expect(logRow?.stills).toEqual([]);
    // the surgery photo is counted exactly once
    expect(m.stats.photos).toBe(2);
  });

  it('builds the recovery pair from admission photo → last activity photo on different days', () => {
    const r: typeof raw = structuredClone(raw);
    r.animal.media = [photo('adm1')];
    r.activities.push({
      type: 'FOOD',
      occurredAt: '2026-05-28T12:00:00.000Z',
      byName: 'Pooja',
      editedAt: null,
      remarks: null,
      data: { foodType: 'Rice', intake: 'Fully', vomiting: false },
      media: [photo('late1')],
    });
    const m = buildReportModel(r);
    expect(m.recovery).toEqual({
      first: { assetId: 'adm1', label: 'DAY 1 · at admission' },
      last: { assetId: 'late1', label: `DAY ${m.stats.days} · at discharge` },
    });
  });

  it('omits the recovery pair when photos fall on the same day or only one exists', () => {
    const sameDay: typeof raw = structuredClone(raw);
    sameDay.animal.media = [];
    // raw already has exactly one FOOD activity photo (p1) — single photo → null
    expect(buildReportModel(sameDay).recovery).toBeNull();
  });

  it('ignores X-rays for the recovery pair', () => {
    const xr: typeof raw = structuredClone(raw);
    xr.animal.media = [{ ...photo('adm1'), kind: 'XRAY' as const }];
    expect(buildReportModel(xr).recovery?.first.assetId).not.toBe('adm1');
  });
```

Notes for the implementer: the `raw` fixture is discharged, so the last-photo label says `at discharge`; the fixture's FOOD activity (`p1`, 26 May) is its only activity photo. In the last test the admission media is an X-ray, so the Day-1 candidate falls back to the first activity photo (`p1`) — and since `p1` is also the last photo, `recovery` is `null`; the assertion passes via optional chaining on `null`.

Run: `pnpm exec vitest run src/features/reports/patient-pdf/__tests__/model.test.ts`
Expected: FAIL — `surgeries`/`recovery` don't exist yet.

- [ ] **Step 2: Implement in `model.ts`**

1. `ReportEntry` gains an optional field:

```ts
  // Set on SURGERY / DIAGNOSTIC day-log rows: the full card (with stills)
  // lives in the dedicated section; the log shows a compact cross-ref row.
  crossRef?: 'surgery' | 'diagnostics';
```

2. After `ReportEntry`, add:

```ts
export interface SectionEntry extends ReportEntry {
  dayLabel: string;
}
```

3. `ReportModel` gains:

```ts
  recovery: { first: { assetId: string; label: string }; last: { assetId: string; label: string } } | null;
  surgeries: SectionEntry[];
  diagnostics: SectionEntry[];
```

4. In `buildReportModel`, hoist the outcome (it is needed for the recovery label). Replace `const perTypeMap = ...` block start with:

```ts
  const outcome = buildOutcome(a);
  const perTypeMap = new Map<ActivityType, number>();
  let photos = 0;
  const medMap = new Map<string, MedEntry>();
  const grouped = new Map<string, ReportEntry[]>();
  const surgeries: SectionEntry[] = [];
  const diagnostics: SectionEntry[] = [];
  // Recovery-pair candidates: PHOTO kind only, never X-rays.
  let firstActivityPhoto: { assetId: string; day: string } | null = null;
  let lastActivityPhoto: { assetId: string; day: string } | null = null;
```

5. Inside the activity loop, after `const entry: ReportEntry = {...};` replace `groupedPush(grouped, dayKey(act.occurredAt), entry);` with:

```ts
    for (const m of stills) {
      if (m.kind !== 'PHOTO') continue;
      const cand = { assetId: m.assetId, day: dayKey(act.occurredAt) };
      if (!firstActivityPhoto) firstActivityPhoto = cand;
      lastActivityPhoto = cand;
    }
    if (act.type === 'SURGERY' || act.type === 'DIAGNOSTIC') {
      const isSurgery = act.type === 'SURGERY';
      (isSurgery ? surgeries : diagnostics).push({ ...entry, dayLabel: dayLabel(act.occurredAt) });
      groupedPush(grouped, dayKey(act.occurredAt), {
        ...entry,
        stills: [],
        crossRef: isSurgery ? 'surgery' : 'diagnostics',
      });
    } else {
      groupedPush(grouped, dayKey(act.occurredAt), entry);
    }
```

6. After the `daysArr`/`meds` computations, add the recovery pair (note `days` — the day count — is computed at the top of the function):

```ts
  const admissionPhoto = a.media.find((m) => m.kind === 'PHOTO') ?? null;
  const first = admissionPhoto
    ? { assetId: admissionPhoto.assetId, day: dayKey(a.admittedAt) }
    : firstActivityPhoto;
  const last = lastActivityPhoto;
  const recovery =
    first && last && first.assetId !== last.assetId && first.day !== last.day
      ? {
          first: { assetId: first.assetId, label: 'DAY 1 · at admission' },
          last: {
            assetId: last.assetId,
            label: `DAY ${days} · ${outcome.kind === 'discharged' ? 'at discharge' : 'latest'}`,
          },
        }
      : null;
```

7. In the returned object: use the hoisted `outcome` (replace `outcome: buildOutcome(a),` with `outcome,`) and add `recovery,`, `surgeries,`, `diagnostics,`.

- [ ] **Step 3: Run the model tests**

Run: `pnpm exec vitest run src/features/reports/patient-pdf/__tests__/model.test.ts`
Expected: PASS.

- [ ] **Step 4: Collect section images + update collect test**

1. In `src/features/reports/patient-pdf/data.ts` `collectImageAssets`, after the days loop add:

```ts
  for (const e of [...model.surgeries, ...model.diagnostics])
    for (const m of e.stills) out.set(m.assetId, m.storageKey);
```

2. In `src/features/reports/patient-pdf/__tests__/collect.test.ts`, extend the casted `model` literal with (top level, after `days`):

```ts
  surgeries: [
    {
      stills: [{ assetId: 'sx1', storageKey: 'k-sx1', kind: 'XRAY', label: null, filename: 's' }],
      type: 'SURGERY',
      time: '11:30',
      byName: 'x',
      edited: false,
      summary: '',
      details: [],
      links: [],
      dayLabel: 'Tue 26 May 2026',
    },
  ],
  diagnostics: [],
  recovery: null,
```

and the expected ids become `['adm1', 'doc1', 'p1', 'sx1']`.

3. In `src/features/reports/patient-pdf/__tests__/render.test.ts`, the `model` literal gains (typecheck): `recovery: null,`, `surgeries: [],`, `diagnostics: [],`.

- [ ] **Step 5: Verify**

Run: `pnpm exec vitest run src/features/reports/patient-pdf/__tests__ && pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/features/reports/patient-pdf/model.ts src/features/reports/patient-pdf/data.ts src/features/reports/patient-pdf/__tests__/model.test.ts src/features/reports/patient-pdf/__tests__/collect.test.ts src/features/reports/patient-pdf/__tests__/render.test.ts
git commit -m "feat(pdf): recovery photo pair + surgery/diagnostics section extraction

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Brand assets — committed logo, `assets.ts`, `styles.ts`, `components.tsx`

**Files:**
- Create: `src/features/reports/patient-pdf/assets/logo.png` (generated, committed)
- Create: `src/features/reports/patient-pdf/assets.ts`
- Create: `src/features/reports/patient-pdf/styles.ts`
- Create: `src/features/reports/patient-pdf/components.tsx`

- [ ] **Step 1: Generate the committed logo asset**

The source `Arham Always Care cc.png` sits untracked at the repo root (2789×1561 RGBA). Downscale it into the feature (alpha preserved):

```bash
mkdir -p src/features/reports/patient-pdf/assets
pnpm exec node -e "const sharp=require('sharp'); sharp('Arham Always Care cc.png').resize({width:600}).png({compressionLevel:9}).toFile('src/features/reports/patient-pdf/assets/logo.png').then(i=>console.log(i.width+'x'+i.height+' '+i.size+'B'))"
```

Expected: `600x336 …B` (well under 150 KB). The root file stays untracked; only `assets/logo.png` is committed.

- [ ] **Step 2: Create `src/features/reports/patient-pdf/assets.ts`**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Same packaging mechanism as fonts.ts: a static file inside the feature,
// resolved from the project root so Vercel's file tracing bundles it.
const LOGO_PATH = join(process.cwd(), 'src/features/reports/patient-pdf/assets/logo.png');

// 600×336 PNG with alpha. Cached after first read; null when unreadable —
// the report renders a text fallback instead (the logo must never break
// generation).
let cached: Buffer | null | undefined;
export function loadLogo(): Buffer | null {
  if (cached !== undefined) return cached;
  try {
    cached = readFileSync(LOGO_PATH);
  } catch {
    cached = null;
  }
  return cached;
}

// Intrinsic aspect ratio of assets/logo.png (600×336) — react-pdf needs
// explicit width AND height for predictable layout.
export const LOGO_AR = 336 / 600;
```

- [ ] **Step 3: Create `src/features/reports/patient-pdf/styles.ts`**

```ts
import { StyleSheet } from '@react-pdf/renderer';

// Brand tokens from the Arham Always Care logo (deep red + gold on cream).
export const BRAND = {
  red: '#8B1A12',
  gold: '#C9A55C',
  goldSoft: '#E8E0D0',
  cream: '#FDFBF6',
  mat: '#F1ECE2',
  ink: '#221A14',
  muted: '#5D5347',
  soft: '#9A8D76',
};

// Activity-type rails match the app (unchanged from v1).
export const TYPE_COLOR: Record<string, string> = {
  ADMISSION: '#0E7C7B',
  TREATMENT: '#2563EB',
  ROUND: '#7C3AED',
  DIAGNOSTIC: '#0891B2',
  SURGERY: '#B5471A',
  FOOD: '#15803D',
  BATH: '#0EA5E9',
  WALK: '#A16207',
};

export const OUTCOME_BG = { 'in-care': '#93370D', discharged: '#15803D', deceased: '#B42318' } as const;

export const PAGE_PAD_TOP = 44; // room for the fixed compact header on pages 2+
export const PAGE_PAD_X = 30;

export const s = StyleSheet.create({
  page: {
    paddingTop: PAGE_PAD_TOP,
    paddingBottom: 46,
    paddingHorizontal: PAGE_PAD_X,
    fontFamily: 'Noto Sans',
    fontSize: 9,
    color: BRAND.ink,
  },
  // Page-1 masthead (in flow, fills the padding zone)
  masthead: {
    backgroundColor: BRAND.cream,
    marginHorizontal: -PAGE_PAD_X,
    marginTop: -PAGE_PAD_TOP,
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: PAGE_PAD_X,
    marginBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: BRAND.gold,
    alignItems: 'center',
  },
  mastBrandFallback: { fontFamily: 'Noto Serif', fontWeight: 700, fontSize: 20, color: BRAND.red },
  mastKicker: { fontSize: 7, letterSpacing: 2, color: BRAND.soft, marginTop: 8 },
  // Fixed compact header, pages 2+
  pgHead: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: BRAND.cream,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.gold,
    paddingHorizontal: PAGE_PAD_X,
    paddingVertical: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pgHeadMeta: { fontSize: 6.5, color: BRAND.soft, letterSpacing: 0.5 },
  hero: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  heroName: { fontFamily: 'Noto Serif', fontWeight: 700, fontSize: 18, color: BRAND.red },
  pill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    fontSize: 8,
    fontWeight: 700,
  },
  kv: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  kvItem: { width: '50%', flexDirection: 'row', marginBottom: 3, paddingRight: 10 },
  k: { color: BRAND.soft, width: 64 },
  v: { color: BRAND.ink, fontWeight: 700, flex: 1 },
  sec: {
    fontSize: 9,
    fontWeight: 700,
    color: BRAND.red,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.gold,
    paddingBottom: 2,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  tile: {
    borderWidth: 1,
    borderColor: BRAND.goldSoft,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 9,
    backgroundColor: BRAND.cream,
    minWidth: 78,
  },
  tileN: { fontSize: 15, fontWeight: 700, color: BRAND.red },
  tileL: { fontSize: 7, color: BRAND.soft, marginTop: 3, textTransform: 'uppercase' },
  table: { borderWidth: 1, borderColor: BRAND.goldSoft, borderRadius: 6 },
  trH: { flexDirection: 'row', backgroundColor: BRAND.cream },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BRAND.goldSoft },
  th: { fontSize: 7, color: BRAND.muted, textTransform: 'uppercase', padding: 5, flex: 1 },
  td: { fontSize: 8, padding: 5, flex: 1 },
  recoveryRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 4 },
  recoveryArrow: { fontSize: 14, color: BRAND.red, fontWeight: 700, paddingBottom: 28 },
  dayBand: {
    flexDirection: 'row',
    backgroundColor: BRAND.cream,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: BRAND.goldSoft,
    paddingVertical: 5,
    paddingHorizontal: 9,
    marginTop: 14,
    marginBottom: 8,
  },
  dayLabel: { fontSize: 9, fontWeight: 700, flex: 1 },
  dayCnt: { fontSize: 8, color: BRAND.soft },
  card: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: BRAND.goldSoft,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 9,
    marginBottom: 7,
  },
  crow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: BRAND.goldSoft,
    borderLeftWidth: 3,
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 9,
    marginBottom: 5,
  },
  chip: { fontSize: 8, fontWeight: 700, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 8 },
  time: { fontSize: 8, color: BRAND.muted, fontWeight: 700 },
  summary: { fontSize: 10, fontWeight: 700, marginTop: 5 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  dpill: {
    fontSize: 8,
    color: BRAND.muted,
    backgroundColor: BRAND.cream,
    borderWidth: 1,
    borderColor: BRAND.goldSoft,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  dline: { fontSize: 8.5, color: BRAND.muted, marginTop: 3 },
  by: { fontSize: 7.5, color: BRAND.soft, marginTop: 6 },
  crossRef: { fontSize: 7.5, color: BRAND.red, fontWeight: 700 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7, alignItems: 'flex-end' },
  gcap: { fontSize: 6.5, color: BRAND.soft, marginTop: 2 },
  imgMat: {
    backgroundColor: BRAND.mat,
    borderWidth: 1,
    borderColor: `${BRAND.gold}66`,
    borderRadius: 5,
    padding: 3,
    alignSelf: 'flex-start',
  },
  imgPh: {
    borderRadius: 5,
    backgroundColor: BRAND.mat,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${BRAND.gold}66`,
  },
  link: { fontSize: 8, color: BRAND.red, marginTop: 4 },
  sectionCard: {
    borderWidth: 1,
    borderColor: BRAND.goldSoft,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 9,
    marginBottom: 7,
  },
  outcomeBox: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 18 },
  outcomeTitle: { fontSize: 10, fontWeight: 800 },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, paddingHorizontal: 10 },
  signCell: { alignItems: 'center' },
  signRule: { width: 150, borderTopWidth: 1, borderTopColor: BRAND.ink, marginBottom: 4 },
  signLabel: { fontSize: 7.5, color: BRAND.muted },
  provenance: { fontSize: 7, color: BRAND.soft, textAlign: 'center', marginTop: 22 },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: PAGE_PAD_X,
    right: PAGE_PAD_X,
    borderTopWidth: 1,
    borderTopColor: BRAND.gold,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footText: { fontSize: 7.5, color: BRAND.soft },
});
```

- [ ] **Step 4: Create `src/features/reports/patient-pdf/components.tsx`**

```tsx
import { Image, Text, View } from '@react-pdf/renderer';
import { type ReportImage, fitWithin } from './fit';
import { pickFont } from './fonts';
import { BRAND, s } from './styles';

export type PdfStyle = NonNullable<React.ComponentProps<typeof View>['style']>;

// Text that switches to a Devanagari/Gujarati-capable font when needed.
export function T({ children, style, dyn }: { children: React.ReactNode; style?: PdfStyle; dyn?: string | null }) {
  const family = dyn ? pickFont(dyn) : undefined;
  return (
    <Text
      style={[...(Array.isArray(style) ? style : style ? [style] : []), family ? { fontFamily: family } : {}]}
    >
      {children}
    </Text>
  );
}

// Renders the COMPLETE image (no crop) at its own aspect ratio inside a
// gold-matted frame no larger than maxW×maxH; placeholder when missing.
export function FitImage({
  id,
  images,
  maxW,
  maxH,
}: { id: string; images: Map<string, ReportImage>; maxW: number; maxH: number }) {
  const img = images.get(id);
  if (!img) {
    return (
      <View style={[s.imgPh, { width: maxW, height: Math.min(maxH, 80) }]}>
        <Text style={{ fontSize: 7, color: BRAND.soft }}>image unavailable</Text>
      </View>
    );
  }
  const { w, h } = fitWithin(img.width, img.height, maxW, maxH);
  return (
    <View style={s.imgMat}>
      <Image src={{ data: img.data, format: 'jpg' }} style={{ width: w, height: h, borderRadius: 3 }} />
    </View>
  );
}

// Key-value row for the hero facts grid; hidden when the value is empty.
export function KV({ label, val }: { label: string; val: string | null }) {
  if (!val) return null;
  return (
    <View style={s.kvItem}>
      <Text style={s.k}>{label}</Text>
      <T style={s.v} dyn={val}>
        {val}
      </T>
    </View>
  );
}
```

- [ ] **Step 5: Verify (nothing consumes these yet — compile + suite only)**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: green (Task 5 wires everything in).

- [ ] **Step 6: Commit**

```bash
git add src/features/reports/patient-pdf/assets/logo.png src/features/reports/patient-pdf/assets.ts src/features/reports/patient-pdf/styles.ts src/features/reports/patient-pdf/components.tsx
git commit -m "feat(pdf): clinic brand assets — committed logo, brand tokens, fit-image primitives

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Sections + Report assembly (the rebrand)

**Files:**
- Create: `src/features/reports/patient-pdf/sections.tsx`
- Rewrite: `src/features/reports/patient-pdf/Report.tsx`
- Modify: `src/features/reports/patient-pdf/__tests__/render.test.ts`

- [ ] **Step 1: Extend the render test to exercise the new document (failing)**

Replace `src/features/reports/patient-pdf/__tests__/render.test.ts` with:

```ts
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import type { ReportModel } from '../model';
import { renderPatientReportPdf } from '../render';

const still = (assetId: string) => ({
  assetId,
  kind: 'PHOTO' as const,
  label: null,
  filename: `${assetId}.jpg`,
  storageKey: `k-${assetId}`,
});

const model: ReportModel = {
  generatedAt: '2026-05-31T06:30:00.000Z',
  generatedByName: 'Asha (Reception)',
  rangeLabel: null,
  patient: {
    name: 'रॉकी',
    species: 'Dog',
    breedAge: 'Dog · Indie',
    sexAge: 'MALE · ~2y',
    cage: 'C-3',
    status: 'DISCHARGED',
    admittedAt: '2026-05-25T10:00:00.000Z',
    complaint: 'Hit by vehicle',
    diagnosis: 'Fracture',
    rescuer: 'Asha',
    broughtBy: 'NGO',
    avatarAssetId: 'a1',
  },
  outcome: {
    kind: 'discharged',
    label: 'Discharged · 29 May',
    causeOfDeath: null,
    summary: 'Recovered well, weight-bearing on all limbs',
    instructions: 'Cone for 5 days',
    byName: 'Dr. Mehta',
  },
  recovery: {
    first: { assetId: 'a1', label: 'DAY 1 · at admission' },
    last: { assetId: 'a2', label: 'DAY 5 · at discharge' },
  },
  stats: { days: 5, perType: [{ type: 'FOOD', label: 'Food & water', count: 1 }], photos: 2 },
  meds: [
    { name: 'Amoxiclav', doses: ['20mg/kg'], routes: ['Oral'], times: 2, days: 2, span: '26 May – 27 May' },
  ],
  surgeries: [
    {
      type: 'SURGERY',
      time: '11:30',
      byName: 'Dr. Iyer',
      edited: false,
      summary: 'Fracture repair (45 min) — Dr. Iyer',
      details: ['Anesthesia: Iso', 'Findings: clean break'],
      stills: [still('a2')],
      links: [],
      dayLabel: 'Tue 26 May 2026',
    },
  ],
  diagnostics: [],
  admissionMedia: [still('a1')],
  days: [
    {
      key: '2026-05-26',
      label: 'Tue 26 May 2026',
      entries: [
        {
          type: 'FOOD',
          time: '12:00',
          byName: 'કૂતરો',
          edited: false,
          summary: 'Khichdi · 50g · Fully',
          details: ['Vomiting: no'],
          stills: [still('a1')],
          links: [],
        },
        {
          type: 'SURGERY',
          time: '11:30',
          byName: 'Dr. Iyer',
          edited: false,
          summary: 'Fracture repair (45 min) — Dr. Iyer',
          details: [],
          stills: [],
          links: [],
          crossRef: 'surgery',
        },
      ],
    },
  ],
  documents: [],
};

describe('renderPatientReportPdf', () => {
  it('renders the v2 document (brand, sections, recovery, sign-off, mixed scripts)', async () => {
    const mk = (rgb: { r: number; g: number; b: number }, w: number, h: number) =>
      sharp({ create: { width: w, height: h, channels: 3 as const, background: rgb } })
        .jpeg()
        .toBuffer();
    const [imgA, imgB] = await Promise.all([mk({ r: 21, g: 128, b: 61 }, 400, 300), mk({ r: 14, g: 124, b: 123 }, 300, 500)]);
    const buf = await renderPatientReportPdf(
      model,
      new Map([
        ['a1', { data: imgA, width: 400, height: 300 }],
        ['a2', { data: imgB, width: 300, height: 500 }],
      ]),
    );
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(4000);
  });
});
```

Run: `pnpm exec vitest run src/features/reports/patient-pdf/__tests__/render.test.ts`
Expected: FAIL — type errors / old layout (Report doesn't know the new fields yet; the fixture's `crossRef`/`surgeries` compile only after Task 3, which is done — the failure here is the old `Report.tsx` rendering without the new sections is fine for `%PDF` but the test compiles against the NEW model; if it happens to pass, that's acceptable — the real gate is Step 4's review of the rewritten document. Continue.)

- [ ] **Step 2: Create `src/features/reports/patient-pdf/sections.tsx`**

```tsx
import { Image, Text, View } from '@react-pdf/renderer';
import { LOGO_AR } from './assets';
import { FitImage, KV, T } from './components';
import type { ReportImage } from './fit';
import type { RawMedia, ReportEntry, ReportModel, SectionEntry } from './model';
import { BRAND, OUTCOME_BG, TYPE_COLOR, s } from './styles';

const istDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
const istDateTime = (iso: string) =>
  `${istDate(iso)}, ${new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  })} IST`;

// ── Chrome ────────────────────────────────────────────────────────────────

export function Masthead({ model, logo }: { model: ReportModel; logo: Buffer | null }) {
  return (
    <View style={s.masthead}>
      {logo ? (
        <Image src={logo} style={{ width: 200, height: 200 * LOGO_AR }} />
      ) : (
        <Text style={s.mastBrandFallback}>Arham Always Care</Text>
      )}
      <Text style={s.mastKicker}>
        PATIENT REPORT · {(model.rangeLabel ?? 'WHOLE STAY').toUpperCase()} · GENERATED{' '}
        {istDate(model.generatedAt).toUpperCase()}
      </Text>
    </View>
  );
}

// Fixed compact header — renders on pages 2+ only. The OUTER fixed View
// carries no style (an empty styled bar would otherwise paint over the
// page-1 masthead); the styled bar lives inside the render prop.
export function PageHeader({ model, logo }: { model: ReportModel; logo: Buffer | null }) {
  return (
    <View
      fixed
      render={({ pageNumber }) =>
        pageNumber === 1 ? null : (
          <View style={s.pgHead}>
            {logo ? (
              <Image src={logo} style={{ width: 56, height: 56 * LOGO_AR }} />
            ) : (
              <Text style={{ fontFamily: 'Noto Serif', fontWeight: 700, fontSize: 9, color: BRAND.red }}>
                Arham Always Care
              </Text>
            )}
            <T style={s.pgHeadMeta} dyn={model.patient.name}>
              {model.patient.name.toUpperCase()} · PATIENT REPORT · {istDate(model.generatedAt).toUpperCase()}
            </T>
          </View>
        )
      }
    />
  );
}

export function Footer({ model }: { model: ReportModel }) {
  return (
    <View style={s.footer} fixed>
      <T style={s.footText} dyn={model.patient.name}>
        {model.patient.name} ({model.patient.species}) · Confidential clinical record
      </T>
      <Text
        style={s.footText}
        render={({ pageNumber, totalPages }) => `Arham Always Care · Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

// ── Page-1 content ────────────────────────────────────────────────────────

export function Hero({ model, images }: { model: ReportModel; images: Map<string, ReportImage> }) {
  const p = model.patient;
  return (
    <View style={s.hero}>
      {p.avatarAssetId ? (
        <FitImage id={p.avatarAssetId} images={images} maxW={110} maxH={110} />
      ) : (
        <View style={[s.imgPh, { width: 96, height: 96 }]}>
          <Text style={{ fontSize: 9, color: BRAND.soft }}>No photo</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T style={s.heroName} dyn={p.name}>
          {p.name}
        </T>
        <Text
          style={[
            s.pill,
            { backgroundColor: `${OUTCOME_BG[model.outcome.kind]}22`, color: OUTCOME_BG[model.outcome.kind] },
          ]}
        >
          {model.outcome.label}
        </Text>
        <View style={s.kv}>
          <KV label="Species" val={p.breedAge} />
          <KV label="Sex / Age" val={p.sexAge} />
          <KV label="Cage" val={p.cage} />
          <KV label="Admitted" val={istDate(p.admittedAt)} />
          <KV label="Complaint" val={p.complaint} />
          <KV label="Diagnosis" val={p.diagnosis} />
          <KV label="Rescuer" val={p.rescuer} />
          <KV label="Brought by" val={p.broughtBy} />
        </View>
      </View>
    </View>
  );
}

export function RecoveryStrip({ model, images }: { model: ReportModel; images: Map<string, ReportImage> }) {
  if (!model.recovery) return null;
  return (
    <>
      <Text style={s.sec}>Recovery</Text>
      <View style={s.recoveryRow}>
        <View>
          <FitImage id={model.recovery.first.assetId} images={images} maxW={160} maxH={120} />
          <Text style={s.gcap}>{model.recovery.first.label}</Text>
        </View>
        <Text style={s.recoveryArrow}>→</Text>
        <View>
          <FitImage id={model.recovery.last.assetId} images={images} maxW={160} maxH={120} />
          <Text style={s.gcap}>{model.recovery.last.label}</Text>
        </View>
      </View>
    </>
  );
}

export function StatTiles({ model }: { model: ReportModel }) {
  return (
    <View bookmark={{ title: 'Stay at a glance' }}>
      <Text style={s.sec}>Stay at a glance</Text>
      <View style={s.stats}>
        <View style={s.tile}>
          <Text style={s.tileN}>{model.stats.days}</Text>
          <Text style={s.tileL}>Days admitted</Text>
        </View>
        {model.stats.perType.map((t) => (
          <View key={t.type} style={s.tile}>
            <Text style={s.tileN}>{t.count}</Text>
            <Text style={s.tileL}>{t.label}</Text>
          </View>
        ))}
        <View style={s.tile}>
          <Text style={s.tileN}>{model.stats.photos}</Text>
          <Text style={s.tileL}>Photos</Text>
        </View>
      </View>
      {model.outcome.causeOfDeath && (
        <T style={s.dline} dyn={model.outcome.causeOfDeath}>
          Cause of death: {model.outcome.causeOfDeath}
        </T>
      )}
    </View>
  );
}

export function MedsTable({ model }: { model: ReportModel }) {
  if (model.meds.length === 0) return null;
  return (
    <View bookmark={{ title: 'Medications' }}>
      <Text style={s.sec}>Medications given</Text>
      <View style={s.table}>
        <View style={s.trH}>
          <Text style={s.th}>Drug</Text>
          <Text style={s.th}>Dose</Text>
          <Text style={s.th}>Route</Text>
          <Text style={s.th}>Times</Text>
          <Text style={s.th}>Span</Text>
        </View>
        {model.meds.map((m) => (
          <View key={m.name} style={s.tr}>
            <T style={[s.td, { fontWeight: 700 }]} dyn={m.name}>
              {m.name}
            </T>
            <Text style={s.td}>{m.doses.join(', ') || '—'}</Text>
            <Text style={s.td}>{m.routes.join(', ') || '—'}</Text>
            <Text style={s.td}>{m.times}×</Text>
            <Text style={s.td}>{m.span}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Pull-out clinical sections ────────────────────────────────────────────

function SectionCard({ e, images }: { e: SectionEntry; images: Map<string, ReportImage> }) {
  const color = TYPE_COLOR[e.type] ?? BRAND.muted;
  return (
    <View style={[s.sectionCard, { borderLeftColor: color }]} wrap={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T style={{ fontSize: 10, fontWeight: 700 }} dyn={e.summary}>
          {e.summary}
        </T>
        <Text style={s.time}>
          {e.dayLabel} · {e.time}
        </Text>
      </View>
      {e.details.map((l) => (
        <T key={l} style={s.dline} dyn={l}>
          {l}
        </T>
      ))}
      {e.links.map((m) => (
        <T key={m.assetId} style={s.link} dyn={m.filename}>
          {m.kind === 'VIDEO' ? 'Video: ' : 'Doc: '}
          {m.filename}
        </T>
      ))}
      {e.stills.length > 0 && (
        <View style={s.grid}>
          {e.stills.map((m) => (
            <View key={m.assetId}>
              <FitImage id={m.assetId} images={images} maxW={150} maxH={220} />
              <Text style={s.gcap}>
                {e.time} · {m.label || (m.kind === 'XRAY' ? 'X-ray' : 'Photo')}
              </Text>
            </View>
          ))}
        </View>
      )}
      <T style={s.by} dyn={e.byName}>
        by {e.byName}
        {e.edited ? ' · edited' : ''}
      </T>
    </View>
  );
}

export function SurgerySection({ model, images }: { model: ReportModel; images: Map<string, ReportImage> }) {
  if (model.surgeries.length === 0) return null;
  return (
    <View bookmark={{ title: 'Surgery' }}>
      <Text style={s.sec}>Surgery</Text>
      {model.surgeries.map((e) => (
        <SectionCard key={`${e.dayLabel}-${e.time}`} e={e} images={images} />
      ))}
    </View>
  );
}

export function DiagnosticsSection({
  model,
  images,
}: { model: ReportModel; images: Map<string, ReportImage> }) {
  if (model.diagnostics.length === 0) return null;
  return (
    <View bookmark={{ title: 'Diagnostics' }}>
      <Text style={s.sec}>Diagnostics</Text>
      {model.diagnostics.map((e) => (
        <SectionCard key={`${e.dayLabel}-${e.time}`} e={e} images={images} />
      ))}
    </View>
  );
}

export function AdmissionMediaSection({
  model,
  images,
}: { model: ReportModel; images: Map<string, ReportImage> }) {
  if (model.admissionMedia.length === 0) return null;
  return (
    <View bookmark={{ title: 'Admission media' }}>
      <Text style={s.sec}>Admission media ({model.admissionMedia.length})</Text>
      <View style={s.grid}>
        {model.admissionMedia.map((m: RawMedia) => (
          <View key={m.assetId}>
            <FitImage id={m.assetId} images={images} maxW={150} maxH={220} />
            <Text style={s.gcap}>{m.label || 'Admission'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Day-by-day log ────────────────────────────────────────────────────────

function detailPill(text: string, i: number) {
  return text.length <= 26 &&
    !/^(Notes|Remarks|Findings|Interpretation|Complications|Post-op|Bath notes|Summary):/.test(text) ? (
    <T key={i} style={s.dpill}>
      {text}
    </T>
  ) : null;
}

function ActivityBlock({ e, images }: { e: ReportEntry; images: Map<string, ReportImage> }) {
  const color = TYPE_COLOR[e.type] ?? BRAND.muted;
  const label = e.type[0] + e.type.slice(1).toLowerCase();

  // SURGERY / DIAGNOSTIC live as full cards in their own sections; the log
  // keeps a compact, cross-referenced row so the chronology stays complete.
  if (e.crossRef) {
    return (
      <View style={[s.crow, { borderLeftColor: color }]} wrap={false}>
        <Text style={s.time}>{e.time}</Text>
        <Text style={[s.chip, { backgroundColor: `${color}22`, color }]}>{label}</Text>
        <T style={{ flex: 1, fontSize: 9 }} dyn={e.summary}>
          {e.summary}
        </T>
        <Text style={s.crossRef}>{e.crossRef === 'surgery' ? '→ Surgery section' : '→ Diagnostics section'}</Text>
      </View>
    );
  }

  const pills = e.details.map((d, i) => detailPill(d, i)).filter(Boolean);
  const lines = e.details.filter(
    (d) =>
      d.length > 26 ||
      /^(Notes|Remarks|Findings|Interpretation|Complications|Post-op|Bath notes|Summary):/.test(d),
  );
  const head = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={[s.chip, { backgroundColor: `${color}22`, color }]}>{label}</Text>
      <Text style={s.time}>{e.time}</Text>
    </View>
  );
  const bodyText = (
    <>
      <T style={s.summary} dyn={e.summary}>
        {e.summary}
      </T>
      {pills.length > 0 && <View style={s.pills}>{pills}</View>}
      {lines.map((l) => (
        <T key={l} style={s.dline} dyn={l}>
          {l}
        </T>
      ))}
      {e.links.map((m) => (
        <T key={m.assetId} style={s.link} dyn={m.filename}>
          {m.kind === 'VIDEO' ? 'Video: ' : 'Doc: '}
          {m.filename}
        </T>
      ))}
      <T style={s.by} dyn={e.byName}>
        by {e.byName}
        {e.edited ? ' · edited' : ''}
      </T>
    </>
  );

  if (e.stills.length === 0) {
    return (
      <View style={[s.crow, { borderLeftColor: color }]} wrap={false}>
        <Text style={s.time}>{e.time}</Text>
        <Text style={[s.chip, { backgroundColor: `${color}22`, color }]}>{label}</Text>
        <T style={{ flex: 1, fontSize: 9 }} dyn={e.summary}>
          {e.summary}
        </T>
      </View>
    );
  }
  if (e.stills.length === 1) {
    return (
      <View style={[s.card, { borderLeftColor: color }]} wrap={false}>
        <View>
          <FitImage id={e.stills[0]?.assetId ?? ''} images={images} maxW={150} maxH={220} />
          <Text style={s.gcap}>
            {e.time} · {e.stills[0]?.label || 'Photo'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          {head}
          {bodyText}
        </View>
      </View>
    );
  }
  return (
    <View style={[s.card, { borderLeftColor: color, flexDirection: 'column' }]}>
      {head}
      {bodyText}
      <View style={s.grid}>
        {e.stills.map((m) => (
          <View key={m.assetId}>
            <FitImage id={m.assetId} images={images} maxW={150} maxH={220} />
            <Text style={s.gcap}>
              {e.time} · {m.label || (m.kind === 'XRAY' ? 'X-ray' : 'Photo')}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function DayLog({ model, images }: { model: ReportModel; images: Map<string, ReportImage> }) {
  return (
    <View bookmark={{ title: 'Day-by-day log' }}>
      <Text style={[s.sec, { fontFamily: 'Noto Serif', fontSize: 12, color: BRAND.ink }]}>Day-by-day log</Text>
      {model.days.map((d) => (
        <View key={d.key}>
          <View style={s.dayBand}>
            <Text style={s.dayLabel}>{d.label}</Text>
            <Text style={s.dayCnt}>
              {d.entries.length} {d.entries.length === 1 ? 'entry' : 'entries'}
            </Text>
          </View>
          {d.entries.map((e) => (
            <ActivityBlock key={`${e.type}-${e.time}`} e={e} images={images} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function DocumentsList({ model }: { model: ReportModel }) {
  if (model.documents.length === 0) return null;
  return (
    <View bookmark={{ title: 'Documents' }}>
      <Text style={s.sec}>Documents ({model.documents.length})</Text>
      {model.documents.map((doc) => (
        <T key={doc.id} style={s.dline} dyn={doc.name}>
          {doc.category} · {doc.name}
          {doc.file ? '' : ' (no file)'}
        </T>
      ))}
    </View>
  );
}

// ── Closing ───────────────────────────────────────────────────────────────

export function OutcomeSignoff({ model }: { model: ReportModel }) {
  const tone = OUTCOME_BG[model.outcome.kind];
  return (
    <View bookmark={{ title: 'Outcome & sign-off' }} wrap={false}>
      <Text style={s.sec}>Outcome & sign-off</Text>
      <View style={[s.outcomeBox, { borderColor: `${tone}88`, backgroundColor: `${tone}0d` }]}>
        <Text style={[s.outcomeTitle, { color: tone }]}>{model.outcome.label.toUpperCase()}</Text>
        {model.outcome.causeOfDeath && (
          <T style={s.dline} dyn={model.outcome.causeOfDeath}>
            Cause of death: {model.outcome.causeOfDeath}
          </T>
        )}
        {model.outcome.summary && (
          <T style={s.dline} dyn={model.outcome.summary}>
            {model.outcome.summary}
          </T>
        )}
        {model.outcome.instructions && (
          <T style={s.dline} dyn={model.outcome.instructions}>
            Aftercare: {model.outcome.instructions}
          </T>
        )}
        {model.outcome.byName && (
          <T style={s.by} dyn={model.outcome.byName}>
            {model.outcome.kind === 'deceased' ? 'Recorded by ' : 'Discharged by '}
            {model.outcome.byName}
          </T>
        )}
      </View>
      <View style={s.signRow}>
        <View style={s.signCell}>
          <View style={s.signRule} />
          <Text style={s.signLabel}>Attending veterinarian</Text>
        </View>
        <View style={s.signCell}>
          <View style={s.signRule} />
          <Text style={s.signLabel}>Date</Text>
        </View>
      </View>
      <T style={s.provenance} dyn={model.generatedByName}>
        Generated from IPD records on {istDateTime(model.generatedAt)} · by {model.generatedByName}
      </T>
    </View>
  );
}
```

- [ ] **Step 3: Rewrite `src/features/reports/patient-pdf/Report.tsx` as the thin assembly**

Replace the entire file with:

```tsx
import { Document, Page } from '@react-pdf/renderer';
import { loadLogo } from './assets';
import type { ReportImage } from './fit';
import type { ReportModel } from './model';
import {
  AdmissionMediaSection,
  DayLog,
  DiagnosticsSection,
  DocumentsList,
  Footer,
  Hero,
  Masthead,
  MedsTable,
  OutcomeSignoff,
  PageHeader,
  RecoveryStrip,
  StatTiles,
  SurgerySection,
} from './sections';
import { s } from './styles';

export function Report({ model, images }: { model: ReportModel; images: Map<string, ReportImage> }) {
  const logo = loadLogo();
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Masthead model={model} logo={logo} />
        <PageHeader model={model} logo={logo} />
        <Hero model={model} images={images} />
        <RecoveryStrip model={model} images={images} />
        <StatTiles model={model} />
        <MedsTable model={model} />
        <SurgerySection model={model} images={images} />
        <DiagnosticsSection model={model} images={images} />
        <AdmissionMediaSection model={model} images={images} />
        <DayLog model={model} images={images} />
        <DocumentsList model={model} />
        <OutcomeSignoff model={model} />
        <Footer model={model} />
      </Page>
    </Document>
  );
}
```

- [ ] **Step 4: Run the render test + full gates**

Run: `pnpm exec vitest run src/features/reports/patient-pdf/__tests__/render.test.ts && pnpm typecheck && pnpm lint && pnpm test`
Expected: all green. If react-pdf errors on the `render` prop of the fixed header View, the fallback is to render `<PageHeader>` content inside `<View fixed style={s.pgHead}>` unconditionally and accept it on page 1 too — but try the documented `render`-prop form first; it is supported in @react-pdf/renderer 4.x.

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/patient-pdf/sections.tsx src/features/reports/patient-pdf/Report.tsx src/features/reports/patient-pdf/__tests__/render.test.ts
git commit -m "feat(pdf): clinic-branded v2 document — masthead, sections, recovery strip, sign-off

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Spec addendum — aftercare instructions

**Files:**
- Modify: `docs/superpowers/specs/2026-06-12-patient-report-v2-design.md`

- [ ] **Step 1: Record the discovered field**

In the spec's section *11. Outcome & sign-off*, change the discharge sentence to mention instructions:

`+ discharge summary text + aftercare instructions (DischargeRecord.instructions, when present) + "Discharged by <name>"`

And in *Architecture changes → model.ts*: `discharge` gains `summary: string` (required in the DB) **and `instructions: string | null`**.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-12-patient-report-v2-design.md
git commit -m "docs: report v2 spec — include DischargeRecord.instructions in the outcome block

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Full-stack validation on the LOCAL database (+ visual PDF check)

**⚠️ Use only `.env.e2e.local` (local docker Postgres). Never the `.env.local` npm scripts.**

- [ ] **Step 1: Static gates**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: clean; unit suite green.

- [ ] **Step 2: Local DB up + env + host check**

```bash
pnpm db:up
docker compose ps   # wait for healthy
```

If `.env.e2e.local` is missing, recreate it:

```bash
cat > .env.e2e.local <<EOF
DATABASE_URL="postgresql://arham:arham_dev@localhost:5433/arham_ipd?schema=public"
DIRECT_URL="postgresql://arham:arham_dev@localhost:5433/arham_ipd?schema=public"
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_URL="http://localhost:3000"
STORAGE_DRIVER="local"
EOF
```

MANDATORY: `pnpm exec dotenv -e .env.e2e.local -- node -e "console.log(new URL(process.env.DATABASE_URL).host)"` must print `localhost:5433` — anything else: STOP.

```bash
pnpm exec dotenv -e .env.e2e.local -- pnpm exec prisma migrate deploy
pnpm exec dotenv -e .env.e2e.local -- pnpm exec tsx prisma/seed.ts
```

- [ ] **Step 3: Integration tests (local)**

Run: `pnpm exec dotenv -e .env.e2e.local -- pnpm exec vitest run --config vitest.integration.config.ts`
Expected: all pass, including the new `patient-pdf-data.test.ts`.

- [ ] **Step 4: E2E (local stack)**

```bash
lsof -ti:3000 && kill $(lsof -ti:3000) || true
pnpm exec dotenv -e .env.e2e.local -- pnpm exec next dev --port 3000   # background; wait for HTTP 200 on /login
pnpm test:e2e
```

Expected: full suite green (28 tests as of the last run — `patient-report.spec.ts` exercises the new document end-to-end).

- [ ] **Step 5: Visual PDF verification**

Generate a real PDF from the local stack and LOOK at it (the Read tool renders PDF pages):

1. Write a throwaway spec `tests/e2e/pdf-dump.spec.ts` (do NOT commit it):

```ts
import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { login } from './helpers';

test('dump a patient report PDF for visual inspection', async ({ page }) => {
  await login(page);
  // Admit a patient with a complaint so the report has content.
  await page.goto('/patients/new');
  await page.getByLabel('Animal name / temporary ID').fill('PdfVisualTest');
  await page.getByLabel('Species').selectOption('Dog');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Chief complaint').fill('Hit by vehicle — fracture suspected');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Admit animal' }).click();
  await page.waitForURL(/\/patients\/([a-z0-9]+)$/, { timeout: 30_000 });
  const id = page.url().split('/').pop();
  const res = await page.request.get(`/api/patients/${id}/report`);
  if (!res.ok()) throw new Error(`report route returned ${res.status()}`);
  writeFileSync('/tmp/report-v2.pdf', await res.body());
});
```

2. Run it as ADMIN (seed admin has `report.generate` via ADMIN role): `pnpm exec playwright test tests/e2e/pdf-dump.spec.ts --project=chromium-desktop`
3. Read `/tmp/report-v2.pdf` (pages 1-2) and verify: logo masthead on cream with gold rule; red patient name; outcome pill; sections styled red/gold; sign-off block with signature rules and provenance line; footer "Arham Always Care · Page N of M". For image-fit verification, also generate a report for the seeded e2e fixture animal (it has a READY photo) or attach a photo via the UI if quick.
4. Delete the throwaway spec: `rm tests/e2e/pdf-dump.spec.ts`
5. Stop the dev server.

- [ ] **Step 6: Fixes (only if needed)**

Visual problems (overlap, spacing, fixed-header collisions) are fixed in `styles.ts`/`sections.tsx`, committed as `fix(pdf): …`, and Step 5 is repeated until the document looks right.

---

### Task 8: Push and open the PR

- [ ] **Step 1: Push**

```bash
git push -u origin patient-report-v2
```

- [ ] **Step 2: Create the PR**

```bash
gh pr create --title "Patient report v2: clinic branding, clinical sections, uncropped images" --body "$(cat <<'EOF'
## Summary
- Rebrands the patient PDF onto Arham Always Care stationery: the real logo on a cream/gold masthead (page 1) and compact header (pages 2+), deep-red headings, gold rules, branded footer. Logo failure falls back to text — generation can never break on it.
- Every image now renders COMPLETE at its own aspect ratio inside a gold-matted frame (was: objectFit cover in fixed boxes — cropped X-rays). The image pipeline carries dimensions end-to-end.
- Surgery and Diagnostics get dedicated full-detail sections (with their images); the day-by-day log keeps compact cross-referenced rows so chronology stays complete without double-embedding images.
- New Recovery strip (first-day photo → last-day photo) on page 1 when the stay has distinct-day photos.
- New Outcome & sign-off closing block: discharge summary + aftercare instructions + by-name (or death record + recorded-by), ink-signature lines, and a "generated by" provenance line.
- PDF sidebar bookmarks for all major sections. No new dependencies; RBAC/route/download UX unchanged.

## Validation
- Unit (fit math, dimensioned images, model extraction/recovery/outcome, render)
- Integration against local Postgres incl. new getPatientReportData coverage
- Full Playwright e2e against the local stack
- Manual visual inspection of a generated PDF (masthead, sections, sign-off, image fit)

Spec: docs/superpowers/specs/2026-06-12-patient-report-v2-design.md
Plan: docs/superpowers/plans/2026-06-12-patient-report-v2.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
