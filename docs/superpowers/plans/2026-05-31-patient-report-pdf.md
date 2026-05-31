# Patient Report PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A DOCTOR/ADMIN/SUPER_ADMIN-only "Download report (PDF)" button on the patient page that generates a whole-stay (or date-range) clinical PDF — every activity in full detail, all photos embedded, videos as links.

**Architecture:** Pure view-model builder + pure image-downscaler + a `@react-pdf/renderer` document, composed by a thin data-fetch layer and a Node route handler that returns `application/pdf`. Core logic (model, image resize, PDF render) is unit-tested with fixtures and **no database**; the DB/route wiring is covered by e2e.

**Tech Stack:** Next.js App Router (Node runtime route handler), `@react-pdf/renderer@4.5.1` (vetted, 0 vulns), `sharp` (already present), Prisma, Vitest, Playwright, Biome.

**Spec:** `docs/superpowers/specs/2026-05-31-patient-report-pdf-design.md`

---

## ⚠️ Safety preflight (read before any DB/e2e step)

This repo's `.env.local` `DATABASE_URL` points at **live Neon prod**, and `pnpm test:integration` / the Playwright dev server use it. **Never** run a DB-writing test against Neon. Before any step that writes to a DB or runs the dev server/e2e, confirm the target is local:

```bash
pnpm exec dotenv -e .env.local -- node -e "console.log((process.env.DATABASE_URL||'').replace(/\/\/[^@]*@/,'//***@'))"
```
If it prints `neon.tech`, **STOP** and switch to the local DB (`postgresql://arham:arham_dev@localhost:5433/arham_ipd`) for that run. The unit tests in Tasks 2–6 and Task 3 use **no database** and are always safe.

---

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `package.json` | **Modify** | add `@react-pdf/renderer@4.5.1` |
| `next.config.*` | **Modify** | `outputFileTracingIncludes` so the route bundles the font TTFs on Vercel |
| `src/features/reports/patient-pdf/fonts/*.ttf` | **Create** | static Noto TTFs (OFL): Sans, Serif, Devanagari, Gujarati (Regular+Bold) |
| `src/features/reports/patient-pdf/fonts.ts` | **Create** | register fonts; `pickFont(text)` script-fallback helper |
| `src/lib/rbac.ts` | **Modify** | add `report.generate` action |
| `src/features/reports/patient-pdf/model.ts` | **Create** | pure `buildReportModel(raw)` → stats, meds aggregate, outcome, day groups (reuses `summarizeActivity`/`activityDetailLines`) |
| `src/features/reports/patient-pdf/images.ts` | **Create** | pure `downscaleImage(buf)` + `loadReportImages(assets)` (storage fetch, inline concurrency limit) |
| `src/features/reports/patient-pdf/Report.tsx` | **Create** | the `@react-pdf/renderer` document |
| `src/features/reports/patient-pdf/render.ts` | **Create** | `renderPatientReportPdf(model, images)` → Buffer |
| `src/features/reports/patient-pdf/data.ts` | **Create** | `getPatientReportData(animalId, range?)` Prisma fetch → `buildReportModel` |
| `src/app/api/patients/[id]/report/route.ts` | **Create** | GET → auth + `report.generate` + data + images + render → `application/pdf` |
| `src/features/reports/components/DownloadReportButton.tsx` | **Create** | role-gated button + generate dialog (whole stay / range) |
| `src/features/animals/components/AnimalDetailActions.tsx` | **Modify** | render the button beside Share |
| `tests/e2e/patient-report.spec.ts` | **Create** | DOCTOR downloads PDF; STAFF sees no button |

Route URL is `/api/patients/[id]/report` (matches the repo's existing route handlers under `app/api/`, avoids any page/route conflict).

---

## Task 1: Add the dependency (audited)

**Files:** `package.json`

- [ ] **Step 1: Install the pinned, vetted version**

Run: `pnpm add @react-pdf/renderer@4.5.1`
Expected: added to `dependencies` as `"@react-pdf/renderer": "4.5.1"`.

- [ ] **Step 2: Audit gate — must be clean**

Run: `pnpm audit --audit-level=high`
Expected: `No known vulnerabilities found` (or no high/critical). If anything high/critical appears that traces to this package, STOP and report.

- [ ] **Step 3: Typecheck still passes**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: add @react-pdf/renderer@4.5.1 (audited, 0 vulns) for patient report PDF"
```

---

## Task 2: Fonts (static TTFs + registration + script fallback)

**Files:**
- Create: `src/features/reports/patient-pdf/fonts/` (8 TTFs)
- Create: `src/features/reports/patient-pdf/fonts.ts`
- Modify: `next.config.*`
- Test: `src/features/reports/patient-pdf/__tests__/fonts.test.ts`

- [ ] **Step 1: Download static TTFs (OFL) from the Noto fonts repo**

Run:
```bash
mkdir -p "src/features/reports/patient-pdf/fonts"
cd "src/features/reports/patient-pdf/fonts"
BASE="https://github.com/notofonts/notofonts.github.io/raw/main/fonts"
curl -fsSL -o NotoSans-Regular.ttf            "$BASE/NotoSans/hinted/ttf/NotoSans-Regular.ttf"
curl -fsSL -o NotoSans-Bold.ttf               "$BASE/NotoSans/hinted/ttf/NotoSans-Bold.ttf"
curl -fsSL -o NotoSerif-Regular.ttf           "$BASE/NotoSerif/hinted/ttf/NotoSerif-Regular.ttf"
curl -fsSL -o NotoSerif-Bold.ttf              "$BASE/NotoSerif/hinted/ttf/NotoSerif-Bold.ttf"
curl -fsSL -o NotoSansDevanagari-Regular.ttf  "$BASE/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Regular.ttf"
curl -fsSL -o NotoSansDevanagari-Bold.ttf     "$BASE/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Bold.ttf"
curl -fsSL -o NotoSansGujarati-Regular.ttf    "$BASE/NotoSansGujarati/hinted/ttf/NotoSansGujarati-Regular.ttf"
curl -fsSL -o NotoSansGujarati-Bold.ttf       "$BASE/NotoSansGujarati/hinted/ttf/NotoSansGujarati-Bold.ttf"
cd -
```

- [ ] **Step 2: Verify they are real TrueType files**

Run: `file src/features/reports/patient-pdf/fonts/*.ttf`
Expected: every line says `TrueType` (e.g. "TrueType Font data"). If any file is tiny / says "ASCII text" / "HTML", the URL 404'd — instead download that family's static TTF from https://fonts.google.com (Download family → use the static `*-Regular.ttf` / `*-Bold.ttf`) and place it with the same filename. Do not proceed until all 8 are valid TrueType.

- [ ] **Step 3: Bundle the fonts into the route on Vercel**

In `next.config.*`, add `outputFileTracingIncludes` so the serverless function for the report route ships the TTFs. If the config is `next.config.ts`/`.mjs` exporting an object, merge:

```ts
const nextConfig = {
  // ...existing config...
  outputFileTracingIncludes: {
    '/api/patients/[id]/report': ['./src/features/reports/patient-pdf/fonts/*.ttf'],
  },
};
```

(If the file uses a different export shape, add the `outputFileTracingIncludes` key to the exported config object without disturbing existing keys.)

- [ ] **Step 4: Write the failing test**

Create `src/features/reports/patient-pdf/__tests__/fonts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pickFont } from '../fonts';

describe('pickFont — script fallback', () => {
  it('Latin → Noto Sans', () => {
    expect(pickFont('Bruno')).toBe('Noto Sans');
  });
  it('Devanagari → Noto Sans Devanagari', () => {
    expect(pickFont('रॉकी')).toBe('Noto Sans Devanagari');
  });
  it('Gujarati → Noto Sans Gujarati', () => {
    expect(pickFont('કૂતરો')).toBe('Noto Sans Gujarati');
  });
  it('empty / undefined → Noto Sans', () => {
    expect(pickFont('')).toBe('Noto Sans');
    expect(pickFont(null)).toBe('Noto Sans');
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `pnpm vitest run src/features/reports/patient-pdf/__tests__/fonts.test.ts`
Expected: FAIL — cannot resolve `../fonts`.

- [ ] **Step 6: Implement `fonts.ts`**

Create `src/features/reports/patient-pdf/fonts.ts`:

```ts
import { join } from 'node:path';
import { Font } from '@react-pdf/renderer';

const DIR = join(process.cwd(), 'src/features/reports/patient-pdf/fonts');
const ttf = (f: string) => join(DIR, f);

let registered = false;
// Register every family once. Server-only (reads TTFs from disk via Node).
export function registerReportFonts(): void {
  if (registered) return;
  registered = true;
  Font.register({
    family: 'Noto Sans',
    fonts: [{ src: ttf('NotoSans-Regular.ttf') }, { src: ttf('NotoSans-Bold.ttf'), fontWeight: 700 }],
  });
  Font.register({
    family: 'Noto Serif',
    fonts: [{ src: ttf('NotoSerif-Regular.ttf') }, { src: ttf('NotoSerif-Bold.ttf'), fontWeight: 700 }],
  });
  Font.register({
    family: 'Noto Sans Devanagari',
    fonts: [
      { src: ttf('NotoSansDevanagari-Regular.ttf') },
      { src: ttf('NotoSansDevanagari-Bold.ttf'), fontWeight: 700 },
    ],
  });
  Font.register({
    family: 'Noto Sans Gujarati',
    fonts: [
      { src: ttf('NotoSansGujarati-Regular.ttf') },
      { src: ttf('NotoSansGujarati-Bold.ttf'), fontWeight: 700 },
    ],
  });
  // No mid-word hyphenation in the PDF.
  Font.registerHyphenationCallback((word) => [word]);
}

// react-pdf does not fall back across families per glyph, so pick the family
// that covers a dynamic string's script (names/remarks may be Hindi/Gujarati).
export function pickFont(text: string | null | undefined): string {
  if (!text) return 'Noto Sans';
  if (/[઀-૿]/.test(text)) return 'Noto Sans Gujarati';
  if (/[ऀ-ॿ]/.test(text)) return 'Noto Sans Devanagari';
  return 'Noto Sans';
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm vitest run src/features/reports/patient-pdf/__tests__/fonts.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add src/features/reports/patient-pdf/fonts src/features/reports/patient-pdf/fonts.ts src/features/reports/patient-pdf/__tests__/fonts.test.ts next.config.*
git commit -m "feat(report): bundle Noto TTFs + font registration with script fallback"
```

---

## Task 3: RBAC action `report.generate`

**Files:**
- Modify: `src/lib/rbac.ts`
- Test: `src/lib/__tests__/rbac.test.ts` (add cases)

- [ ] **Step 1: Add failing test cases**

Append inside the existing `describe` in `src/lib/__tests__/rbac.test.ts`:

```ts
  it('DOCTOR/ADMIN/SUPER_ADMIN can generate a report; STAFF/VIEWER cannot', () => {
    expect(can({ id: 'u', role: 'DOCTOR' }, 'report.generate')).toBe(true);
    expect(can({ id: 'u', role: 'ADMIN' }, 'report.generate')).toBe(true);
    expect(can({ id: 'u', role: 'SUPER_ADMIN' }, 'report.generate')).toBe(true);
    expect(can({ id: 'u', role: 'STAFF' }, 'report.generate')).toBe(false);
    expect(can({ id: 'u', role: 'VIEWER' }, 'report.generate')).toBe(false);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/rbac.test.ts`
Expected: FAIL — `report.generate` not assignable to `Action` (type error) / `can` returns false for DOCTOR.

- [ ] **Step 3: Add the action**

In `src/lib/rbac.ts`, add `| 'report.generate'` to the `Action` union (after `'lifecycle.invalidate'`), and add to `PERMISSIONS`:

```ts
  'report.generate': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/rbac.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rbac.ts src/lib/__tests__/rbac.test.ts
git commit -m "feat(rbac): add report.generate (DOCTOR/ADMIN/SUPER_ADMIN)"
```

---

## Task 4: Pure view-model builder (`model.ts`)

**Files:**
- Create: `src/features/reports/patient-pdf/model.ts`
- Test: `src/features/reports/patient-pdf/__tests__/model.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/reports/patient-pdf/__tests__/model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildReportModel, type RawReportData } from '../model';

const raw: RawReportData = {
  generatedAt: '2026-05-31T06:30:00.000Z',
  range: null,
  animal: {
    name: 'Facebook ', species: 'Dog', breed: 'Indie', gender: 'MALE', ageText: '~2y',
    ward: 'ICU', cageName: 'C-3', status: 'DISCHARGED', admittedAt: '2026-05-25T10:00:00.000Z',
    complaint: 'Hit by vehicle', diagnosis: 'Fracture', rescuer: 'Asha', broughtBy: 'NGO',
    media: [{ assetId: 'adm1', kind: 'PHOTO', label: null, filename: 'a.jpg', storageKey: 'local:x/a.jpg' }],
    death: null, discharge: { dischargedAt: '2026-05-29T10:00:00.000Z' },
  },
  activities: [
    { type: 'TREATMENT', occurredAt: '2026-05-26T09:00:00.000Z', byName: 'Dr. Mehta', editedAt: null, remarks: null,
      data: { meds: [{ name: 'Amoxiclav', dose: '20mg/kg', route: 'Oral' }] }, media: [] },
    { type: 'FOOD', occurredAt: '2026-05-26T12:00:00.000Z', byName: 'Pooja', editedAt: null, remarks: null,
      data: { foodType: 'Khichdi', qty: '50g', intake: 'Fully', vomiting: false },
      media: [{ assetId: 'p1', kind: 'PHOTO', label: 'bowl', filename: 'p1.jpg', storageKey: 'local:x/p1.jpg' }] },
  ],
  documents: [],
};

describe('buildReportModel', () => {
  it('computes outcome, stats, meds, day groups', () => {
    const m = buildReportModel(raw);
    expect(m.patient.name).toBe('Facebook'); // trimmed
    expect(m.outcome.kind).toBe('discharged');
    expect(m.stats.days).toBe(4); // 25 -> 29 May
    expect(m.stats.perType.find((t) => t.type === 'TREATMENT')?.count).toBe(1);
    expect(m.stats.photos).toBe(1); // one activity still (admission counted separately)
    expect(m.meds).toHaveLength(1);
    expect(m.meds[0]?.name).toBe('Amoxiclav');
    expect(m.meds[0]?.times).toBe(1);
    expect(m.days).toHaveLength(1);
    expect(m.days[0]?.entries).toHaveLength(2);
    const food = m.days[0]?.entries.find((e) => e.type === 'FOOD');
    expect(food?.summary).toContain('Khichdi');
    expect(food?.stills).toHaveLength(1);
    expect(food?.details).toContain('Vomiting: no');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/features/reports/patient-pdf/__tests__/model.test.ts`
Expected: FAIL — cannot resolve `../model`.

- [ ] **Step 3: Implement `model.ts`**

Create `src/features/reports/patient-pdf/model.ts`:

```ts
import type { ActivityType } from '@/features/activities/schema';
import { activityDetailLines, summarizeActivity } from '@/features/activities/summary';

const TZ = 'Asia/Kolkata';
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: TZ });

export type MediaKindLite = 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC';
export interface RawMedia { assetId: string; kind: MediaKindLite; label: string | null; filename: string; storageKey: string }
export interface RawActivity {
  type: ActivityType; occurredAt: string; byName: string; editedAt: string | null; remarks: string | null;
  data: unknown; media: RawMedia[];
}
export interface RawDocument {
  id: string; category: string; kind: string; name: string; createdAt: string;
  file: { assetId: string; kind: MediaKindLite; filename: string; storageKey: string } | null;
}
export interface RawReportData {
  generatedAt: string;
  range: { from: string; to: string } | null;
  animal: {
    name: string; species: string; breed: string | null; gender: string | null; ageText: string | null;
    ward: string | null; cageName: string | null; status: string; admittedAt: string;
    complaint: string | null; diagnosis: string | null; rescuer: string | null; broughtBy: string | null;
    media: RawMedia[];
    death: { causeOfDeath: string; diedAt: string } | null;
    discharge: { dischargedAt: string } | null;
  };
  activities: RawActivity[];
  documents: RawDocument[];
}

export interface ReportEntry {
  type: ActivityType; time: string; byName: string; edited: boolean;
  summary: string; details: string[]; stills: RawMedia[]; links: RawMedia[];
}
export interface ReportDay { key: string; label: string; entries: ReportEntry[] }
export interface ReportMed { name: string; doses: string[]; routes: string[]; times: number; days: number; span: string }
export interface ReportModel {
  generatedAt: string;
  rangeLabel: string | null;
  patient: {
    name: string; species: string; breedAge: string; sexAge: string; wardCage: string;
    status: string; admittedAt: string; complaint: string | null; diagnosis: string | null;
    rescuer: string | null; broughtBy: string | null; avatarAssetId: string | null;
  };
  outcome: { kind: 'in-care' | 'discharged' | 'deceased'; label: string; causeOfDeath: string | null };
  stats: { days: number; perType: { type: ActivityType; label: string; count: number }[]; photos: number };
  meds: ReportMed[];
  admissionMedia: RawMedia[];
  days: ReportDay[];
  documents: RawDocument[];
}

const TYPE_LABEL: Record<ActivityType, string> = {
  ADMISSION: 'Admission', TREATMENT: 'Treatment', ROUND: 'Round', DIAGNOSTIC: 'Diagnostic',
  SURGERY: 'Surgery', FOOD: 'Food & water', BATH: 'Bath', WALK: 'Walk',
};
const isStill = (k: MediaKindLite) => k === 'PHOTO' || k === 'XRAY';

export function buildReportModel(raw: RawReportData): ReportModel {
  const a = raw.animal;
  const endIso = a.death?.diedAt ?? a.discharge?.dischargedAt ?? raw.generatedAt;
  const days = Math.max(1, Math.ceil((+new Date(endIso) - +new Date(a.admittedAt)) / 86_400_000));

  const perTypeMap = new Map<ActivityType, number>();
  let photos = 0;
  const medMap = new Map<string, { doses: Set<string>; routes: Set<string>; days: Set<string>; times: number }>();

  const grouped = new Map<string, ReportEntry[]>();
  for (const act of raw.activities) {
    perTypeMap.set(act.type, (perTypeMap.get(act.type) ?? 0) + 1);
    const stills = act.media.filter((m) => isStill(m.kind));
    photos += stills.length;
    if (act.type === 'TREATMENT') {
      const meds = ((act.data as { meds?: Array<{ name?: string; dose?: string; route?: string }> })?.meds) ?? [];
      for (const md of meds) {
        const k = (md.name || '—').trim();
        const e = medMap.get(k) ?? { doses: new Set(), routes: new Set(), days: new Set(), times: 0 };
        if (md.dose) e.doses.add(md.dose);
        if (md.route) e.routes.add(md.route);
        e.days.add(dayKey(act.occurredAt));
        e.times += 1;
        medMap.set(k, e);
      }
    }
    const entry: ReportEntry = {
      type: act.type,
      time: timeLabel(act.occurredAt),
      byName: act.byName,
      edited: !!act.editedAt,
      summary: summarizeActivity({ type: act.type, data: act.data, remarks: act.remarks }),
      details: activityDetailLines({ type: act.type, data: act.data, remarks: act.remarks }),
      stills,
      links: act.media.filter((m) => !isStill(m.kind)),
    };
    const key = dayKey(act.occurredAt);
    (grouped.get(key) ?? grouped.set(key, []).get(key)!).push(entry);
  }

  const daysArr: ReportDay[] = Array.from(grouped.entries())
    .sort(([x], [y]) => (x < y ? -1 : 1))
    .map(([key, entries]) => ({ key, label: dayLabel(`${key}T12:00:00+05:30`), entries }));

  const meds: ReportMed[] = Array.from(medMap.entries()).map(([name, e]) => {
    const ds = Array.from(e.days).sort();
    return {
      name, doses: [...e.doses], routes: [...e.routes], times: e.times, days: e.days.size,
      span: ds.length ? (ds.length === 1 ? shortDate(`${ds[0]}T12:00:00+05:30`) : `${shortDate(`${ds[0]}T12:00:00+05:30`)} – ${shortDate(`${ds[ds.length - 1]}T12:00:00+05:30`)}`) : '—',
    };
  });

  const outcome: ReportModel['outcome'] = a.death
    ? { kind: 'deceased', label: `Deceased · ${shortDate(a.death.diedAt)}`, causeOfDeath: a.death.causeOfDeath }
    : a.discharge
      ? { kind: 'discharged', label: `Discharged · ${shortDate(a.discharge.dischargedAt)}`, causeOfDeath: null }
      : { kind: 'in-care', label: 'In care', causeOfDeath: null };

  return {
    generatedAt: raw.generatedAt,
    rangeLabel: raw.range ? `${shortDate(`${raw.range.from}T12:00:00+05:30`)} – ${shortDate(`${raw.range.to}T12:00:00+05:30`)}` : null,
    patient: {
      name: a.name.trim(), species: a.species,
      breedAge: [a.species, a.breed].filter(Boolean).join(' · '),
      sexAge: [a.gender, a.ageText].filter(Boolean).join(' · '),
      wardCage: [a.ward, a.cageName].filter(Boolean).join(' · '),
      status: a.status, admittedAt: a.admittedAt, complaint: a.complaint, diagnosis: a.diagnosis,
      rescuer: a.rescuer, broughtBy: a.broughtBy, avatarAssetId: a.media.find((m) => isStill(m.kind))?.assetId ?? null,
    },
    outcome,
    stats: {
      days,
      perType: Array.from(perTypeMap.entries()).map(([type, count]) => ({ type, label: TYPE_LABEL[type], count })),
      photos,
    },
    meds,
    admissionMedia: a.media.filter((m) => isStill(m.kind)),
    days: daysArr,
    documents: raw.documents,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/features/reports/patient-pdf/__tests__/model.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/reports/patient-pdf/model.ts src/features/reports/patient-pdf/__tests__/model.test.ts
git commit -m "feat(report): pure patient-report view-model builder"
```

---

## Task 5: Image pipeline (`images.ts`)

**Files:**
- Create: `src/features/reports/patient-pdf/images.ts`
- Test: `src/features/reports/patient-pdf/__tests__/images.test.ts`

- [ ] **Step 1: Write the failing test** (pure downscaler, no DB/storage)

Create `src/features/reports/patient-pdf/__tests__/images.test.ts`:

```ts
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { downscaleImage } from '../images';

describe('downscaleImage', () => {
  it('fits within 1000px and outputs JPEG', async () => {
    const src = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: { r: 14, g: 124, b: 123 } } })
      .png()
      .toBuffer();
    const out = await downscaleImage(src);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width ?? 0).toBeLessThanOrEqual(1000);
    expect(meta.height ?? 0).toBeLessThanOrEqual(1000);
    expect(out.length).toBeLessThan(src.length);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/features/reports/patient-pdf/__tests__/images.test.ts`
Expected: FAIL — cannot resolve `../images`.

- [ ] **Step 3: Implement `images.ts`**

Create `src/features/reports/patient-pdf/images.ts`:

```ts
import sharp from 'sharp';
import { getStorage } from '@/lib/storage';

// Downscale + normalise orientation; JPEG keeps the PDF small. Pure (Buffer in/out).
export async function downscaleImage(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .rotate() // honour EXIF orientation
    .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

// Tiny inline concurrency limiter (avoids a p-limit dependency).
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
}

// Fetch + downscale every still. A single failure → skipped (renderer shows a
// placeholder); never fails the whole report.
export async function loadReportImages(assets: { assetId: string; storageKey: string }[]): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  const storage = getStorage();
  await mapLimit(assets, 4, async (a) => {
    try {
      const { stream } = await storage.getStreamOnly(a.storageKey);
      out.set(a.assetId, await downscaleImage(await streamToBuffer(stream)));
    } catch {
      // skip — placeholder in the PDF
    }
  });
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/features/reports/patient-pdf/__tests__/images.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/reports/patient-pdf/images.ts src/features/reports/patient-pdf/__tests__/images.test.ts
git commit -m "feat(report): image downscale + concurrency-limited loader"
```

---

## Task 6: PDF document + render

**Files:**
- Create: `src/features/reports/patient-pdf/Report.tsx`
- Create: `src/features/reports/patient-pdf/render.tsx`
- Test: `src/features/reports/patient-pdf/__tests__/render.test.ts`

- [ ] **Step 1: Implement the document `Report.tsx`**

Create `src/features/reports/patient-pdf/Report.tsx`:

```tsx
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { pickFont } from './fonts';
import type { RawMedia, ReportEntry, ReportModel } from './model';

const C = { teal: '#0E7C7B', ink: '#0F1B26', muted: '#5B6B7A', soft: '#90A0B0', line: '#E6ECF1', bg: '#F4F7F9' };
const TYPE_COLOR: Record<string, string> = {
  ADMISSION: '#0E7C7B', TREATMENT: '#2563EB', ROUND: '#7C3AED', DIAGNOSTIC: '#0891B2',
  SURGERY: '#B5471A', FOOD: '#15803D', BATH: '#0EA5E9', WALK: '#A16207',
};

const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 46, paddingHorizontal: 30, fontFamily: 'Noto Sans', fontSize: 9, color: C.ink },
  band: { backgroundColor: C.teal, marginHorizontal: -30, marginTop: -28, paddingHorizontal: 30, paddingVertical: 16, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: 'Noto Serif', fontWeight: 700, fontSize: 16, color: '#fff' },
  bandSub: { color: '#cdeceb', fontSize: 7, marginTop: 2 },
  bandMeta: { color: '#e8f6f5', fontSize: 7, textAlign: 'right' },
  hero: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  avatar: { width: 96, height: 96, borderRadius: 8, objectFit: 'cover', border: `1 solid ${C.line}` },
  avatarPh: { width: 96, height: 96, borderRadius: 8, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  heroName: { fontFamily: 'Noto Serif', fontWeight: 700, fontSize: 18 },
  pill: { alignSelf: 'flex-start', marginTop: 4, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8, fontSize: 8, fontWeight: 700 },
  kv: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  kvItem: { width: '50%', flexDirection: 'row', marginBottom: 3, paddingRight: 10 },
  k: { color: C.soft, width: 64 },
  v: { color: C.ink, fontWeight: 700, flex: 1 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  tile: { borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 9, backgroundColor: C.bg, minWidth: 78 },
  tileN: { fontSize: 15, fontWeight: 700 },
  tileL: { fontSize: 7, color: C.soft, marginTop: 3, textTransform: 'uppercase' },
  sec: { fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginTop: 12, marginBottom: 7 },
  table: { borderWidth: 1, borderColor: C.line, borderRadius: 6 },
  trH: { flexDirection: 'row', backgroundColor: C.bg },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line },
  th: { fontSize: 7, color: C.muted, textTransform: 'uppercase', padding: 5, flex: 1 },
  td: { fontSize: 8, padding: 5, flex: 1 },
  dayBand: { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 7, paddingVertical: 5, paddingHorizontal: 9, marginTop: 14, marginBottom: 8 },
  dayLabel: { fontSize: 9, fontWeight: 700, flex: 1 },
  dayCnt: { fontSize: 8, color: C.soft },
  card: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: C.line, borderLeftWidth: 3, borderRadius: 8, padding: 9, marginBottom: 7 },
  crow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.line, borderLeftWidth: 3, borderRadius: 7, paddingVertical: 5, paddingHorizontal: 9, marginBottom: 5 },
  chip: { fontSize: 8, fontWeight: 700, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 8 },
  time: { fontSize: 8, color: C.muted, fontWeight: 700 },
  summary: { fontSize: 10, fontWeight: 700, marginTop: 5 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  dpill: { fontSize: 8, color: C.muted, backgroundColor: '#eef2f5', borderRadius: 8, paddingVertical: 2, paddingHorizontal: 7 },
  dline: { fontSize: 8.5, color: C.muted, marginTop: 3 },
  by: { fontSize: 7.5, color: C.soft, marginTop: 6 },
  primary: { width: 150, height: 112, borderRadius: 7, objectFit: 'cover', border: `1 solid ${C.line}` },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  gcell: { width: 150 },
  gimg: { width: 150, height: 108, borderRadius: 7, objectFit: 'cover', border: `1 solid ${C.line}` },
  gcap: { fontSize: 6.5, color: C.soft, marginTop: 2 },
  imgPh: { borderRadius: 7, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', border: `1 solid ${C.line}` },
  link: { fontSize: 8, color: C.teal, marginTop: 4 },
  footer: { position: 'absolute', bottom: 18, left: 30, right: 30, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footText: { fontSize: 7.5, color: C.soft },
});

const OUTCOME_BG = { 'in-care': '#93370d', discharged: '#15803D', deceased: '#B42318' } as const;

function T({ children, style, dyn }: { children: React.ReactNode; style?: object | object[]; dyn?: string | null }) {
  const family = dyn ? pickFont(dyn) : undefined;
  return <Text style={[style as object, family ? { fontFamily: family } : {}]}>{children}</Text>;
}

function ImgOrPlaceholder({ id, images, w, h, style }: { id: string; images: Map<string, Buffer>; w: number; h: number; style?: object }) {
  const buf = images.get(id);
  if (buf) return <Image src={{ data: buf, format: 'jpg' }} style={[{ width: w, height: h }, style as object]} />;
  return <View style={[s.imgPh, { width: w, height: h }, style as object]}><Text style={{ fontSize: 7, color: C.soft }}>image unavailable</Text></View>;
}

function detailPill(text: string, i: number) {
  // short detail → pill; long (notes/remarks/findings/etc.) → line
  return text.length <= 26 && !/^(Notes|Remarks|Findings|Interpretation|Complications|Post-op|Bath notes|Summary):/.test(text)
    ? <T key={i} style={s.dpill}>{text}</T>
    : null;
}

function ActivityBlock({ e, images }: { e: ReportEntry; images: Map<string, Buffer> }) {
  const color = TYPE_COLOR[e.type] ?? C.muted;
  const label = e.type[0] + e.type.slice(1).toLowerCase();
  const pills = e.details.map((d, i) => detailPill(d, i)).filter(Boolean);
  const lines = e.details.filter((d) => d.length > 26 || /^(Notes|Remarks|Findings|Interpretation|Complications|Post-op|Bath notes|Summary):/.test(d));
  const head = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={[s.chip, { backgroundColor: `${color}22`, color }]}>{label}</Text>
      <Text style={s.time}>{e.time}</Text>
    </View>
  );
  const bodyText = (
    <>
      <T style={s.summary} dyn={e.summary}>{e.summary}</T>
      {pills.length > 0 && <View style={s.pills}>{pills}</View>}
      {lines.map((l, i) => <T key={i} style={s.dline} dyn={l}>{l}</T>)}
      {e.links.map((m, i) => <T key={i} style={s.link} dyn={m.filename}>{m.kind === 'VIDEO' ? 'Video: ' : 'Doc: '}{m.filename}</T>)}
      <T style={s.by} dyn={e.byName}>by {e.byName}{e.edited ? ' · edited' : ''}</T>
    </>
  );

  if (e.stills.length === 0) {
    return (
      <View style={[s.crow, { borderLeftColor: color }]} wrap={false}>
        <Text style={s.time}>{e.time}</Text>
        <Text style={[s.chip, { backgroundColor: `${color}22`, color }]}>{label}</Text>
        <T style={{ flex: 1, fontSize: 9 }} dyn={e.summary}>{e.summary}</T>
      </View>
    );
  }
  if (e.stills.length === 1) {
    return (
      <View style={[s.card, { borderLeftColor: color }]} wrap={false}>
        <View>
          <ImgOrPlaceholder id={e.stills[0]!.assetId} images={images} w={150} h={112} style={s.primary} />
          <Text style={s.gcap}>{e.time} · {e.stills[0]!.label || 'Photo'}</Text>
        </View>
        <View style={{ flex: 1 }}>{head}{bodyText}</View>
      </View>
    );
  }
  return (
    <View style={[s.card, { borderLeftColor: color, flexDirection: 'column' }]}>
      {head}{bodyText}
      <View style={s.grid}>
        {e.stills.map((m) => (
          <View key={m.assetId} style={s.gcell}>
            <ImgOrPlaceholder id={m.assetId} images={images} w={150} h={108} style={s.gimg} />
            <Text style={s.gcap}>{e.time} · {m.label || (m.kind === 'XRAY' ? 'X-ray' : 'Photo')}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Report({ model, images }: { model: ReportModel; images: Map<string, Buffer> }) {
  const p = model.patient;
  const kv = (label: string, val: string | null) =>
    val ? (<View style={s.kvItem}><Text style={s.k}>{label}</Text><T style={s.v} dyn={val}>{val}</T></View>) : null;
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.band}>
          <View><Text style={s.brand}>Arham Always Care</Text><Text style={s.bandSub}>PATIENT REPORT · {model.rangeLabel ?? 'WHOLE STAY'}</Text></View>
          <Text style={s.bandMeta}>Generated {new Date(model.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</Text>
        </View>

        <View style={s.hero}>
          {p.avatarAssetId
            ? <ImgOrPlaceholder id={p.avatarAssetId} images={images} w={96} h={96} style={s.avatar} />
            : <View style={s.avatarPh}><Text style={{ fontSize: 9, color: C.soft }}>No photo</Text></View>}
          <View style={{ flex: 1 }}>
            <T style={s.heroName} dyn={p.name}>{p.name}</T>
            <Text style={[s.pill, { backgroundColor: `${OUTCOME_BG[model.outcome.kind]}22`, color: OUTCOME_BG[model.outcome.kind] }]}>{model.outcome.label}</Text>
            <View style={s.kv}>
              {kv('Species', p.breedAge)}{kv('Sex / Age', p.sexAge)}
              {kv('Ward / Cage', p.wardCage)}{kv('Admitted', new Date(p.admittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }))}
              {kv('Complaint', p.complaint)}{kv('Diagnosis', p.diagnosis)}
              {kv('Rescuer', p.rescuer)}{kv('Brought by', p.broughtBy)}
            </View>
          </View>
        </View>

        <View style={s.stats}>
          <View style={s.tile}><Text style={s.tileN}>{model.stats.days}</Text><Text style={s.tileL}>Days admitted</Text></View>
          {model.stats.perType.map((t) => (
            <View key={t.type} style={s.tile}><Text style={s.tileN}>{t.count}</Text><Text style={s.tileL}>{t.label}</Text></View>
          ))}
          <View style={s.tile}><Text style={s.tileN}>{model.stats.photos}</Text><Text style={s.tileL}>Photos</Text></View>
        </View>
        {model.outcome.causeOfDeath && <T style={s.dline} dyn={model.outcome.causeOfDeath}>Cause of death: {model.outcome.causeOfDeath}</T>}

        {model.meds.length > 0 && (
          <>
            <Text style={s.sec}>Medications given</Text>
            <View style={s.table}>
              <View style={s.trH}><Text style={s.th}>Drug</Text><Text style={s.th}>Dose</Text><Text style={s.th}>Route</Text><Text style={s.th}>Times</Text><Text style={s.th}>Span</Text></View>
              {model.meds.map((m) => (
                <View key={m.name} style={s.tr}>
                  <T style={[s.td, { fontWeight: 700 }]} dyn={m.name}>{m.name}</T>
                  <Text style={s.td}>{m.doses.join(', ') || '—'}</Text>
                  <Text style={s.td}>{m.routes.join(', ') || '—'}</Text>
                  <Text style={s.td}>{m.times}×</Text>
                  <Text style={s.td}>{m.span}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {model.admissionMedia.length > 0 && (
          <>
            <Text style={s.sec}>Admission media ({model.admissionMedia.length})</Text>
            <View style={s.grid}>
              {model.admissionMedia.map((m: RawMedia) => (
                <View key={m.assetId} style={s.gcell}>
                  <ImgOrPlaceholder id={m.assetId} images={images} w={150} h={108} style={s.gimg} />
                  <Text style={s.gcap}>{m.label || 'Admission'}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={[s.sec, { fontFamily: 'Noto Serif', fontSize: 12, color: C.ink }]}>Activity log</Text>
        {model.days.map((d) => (
          <View key={d.key}>
            <View style={s.dayBand}><Text style={s.dayLabel}>{d.label}</Text><Text style={s.dayCnt}>{d.entries.length} {d.entries.length === 1 ? 'entry' : 'entries'}</Text></View>
            {d.entries.map((e, i) => <ActivityBlock key={i} e={e} images={images} />)}
          </View>
        ))}

        {model.documents.length > 0 && (
          <>
            <Text style={s.sec}>Documents ({model.documents.length})</Text>
            {model.documents.map((doc) => (
              <T key={doc.id} style={s.dline} dyn={doc.name}>{doc.category} · {doc.name}{doc.file ? '' : ' (no file)'}</T>
            ))}
          </>
        )}

        <View style={s.footer} fixed>
          <T style={s.footText} dyn={p.name}>{p.name} ({p.species}) · Confidential clinical record</T>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Implement `render.tsx`**

Create `src/features/reports/patient-pdf/render.tsx`:

```tsx
import { renderToBuffer } from '@react-pdf/renderer';
import { registerReportFonts } from './fonts';
import type { ReportModel } from './model';
import { Report } from './Report';

export async function renderPatientReportPdf(model: ReportModel, images: Map<string, Buffer>): Promise<Buffer> {
  registerReportFonts();
  return renderToBuffer(<Report model={model} images={images} />);
}
```

- [ ] **Step 3: Write the render smoke test**

Create `src/features/reports/patient-pdf/__tests__/render.test.ts`:

```ts
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import type { ReportModel } from '../model';
import { renderPatientReportPdf } from '../render';

const model: ReportModel = {
  generatedAt: '2026-05-31T06:30:00.000Z',
  rangeLabel: null,
  patient: { name: 'रॉकी', species: 'Dog', breedAge: 'Dog · Indie', sexAge: 'MALE · ~2y', wardCage: 'ICU · C-3', status: 'STABLE', admittedAt: '2026-05-25T10:00:00.000Z', complaint: 'Hit by vehicle', diagnosis: 'Fracture', rescuer: 'Asha', broughtBy: 'NGO', avatarAssetId: 'a1' },
  outcome: { kind: 'in-care', label: 'In care', causeOfDeath: null },
  stats: { days: 6, perType: [{ type: 'FOOD', label: 'Food & water', count: 1 }], photos: 1 },
  meds: [{ name: 'Amoxiclav', doses: ['20mg/kg'], routes: ['Oral'], times: 2, days: 2, span: '26 May – 27 May' }],
  admissionMedia: [],
  days: [{ key: '2026-05-26', label: 'Tue 26 May 2026', entries: [
    { type: 'FOOD', time: '12:00', byName: 'કૂતરો', edited: false, summary: 'Khichdi · 50g · Fully', details: ['Vomiting: no'], stills: [{ assetId: 'a1', kind: 'PHOTO', label: 'bowl', filename: 'p.jpg', storageKey: 'k' }], links: [] },
  ] }],
  documents: [],
};

describe('renderPatientReportPdf', () => {
  it('produces a PDF buffer (fonts load, image embeds, mixed scripts)', async () => {
    const img = await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 21, g: 128, b: 61 } } }).jpeg().toBuffer();
    const buf = await renderPatientReportPdf(model, new Map([['a1', img]]));
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(2000);
  });
});
```

- [ ] **Step 4: Run the render test**

Run: `pnpm vitest run src/features/reports/patient-pdf/__tests__/render.test.ts`
Expected: PASS. (If it errors on a missing font file, Task 2 Step 2 didn't produce valid TTFs — fix those first.)

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/reports/patient-pdf/Report.tsx src/features/reports/patient-pdf/render.tsx src/features/reports/patient-pdf/__tests__/render.test.ts
git commit -m "feat(report): react-pdf document + render-to-buffer"
```

---

## Task 7: Data fetch (`data.ts`)

**Files:**
- Create: `src/features/reports/patient-pdf/data.ts`
- Test: `src/features/reports/patient-pdf/__tests__/collect.test.ts` (pure helper only; the Prisma fetch is covered by the e2e)

- [ ] **Step 1: Implement `data.ts`**

Create `src/features/reports/patient-pdf/data.ts`:

```ts
import { filterBounds } from '@/features/activities/filter';
import { prisma } from '@/lib/prisma';
import { buildReportModel, type MediaKindLite, type RawMedia, type RawReportData, type ReportModel } from './model';

type MediaRow = { label: string | null; asset: { id: string; kind: string; filename: string; storageKey: string } };
const toRawMedia = (m: MediaRow): RawMedia => ({
  assetId: m.asset.id, kind: m.asset.kind as MediaKindLite, label: m.label ?? null,
  filename: m.asset.filename, storageKey: m.asset.storageKey,
});

export async function getPatientReportData(
  animalId: string,
  range?: { from: string; to: string },
): Promise<ReportModel | null> {
  const animal = await prisma.animal.findFirst({
    where: { id: animalId, deletedAt: null },
    include: {
      cage: { select: { name: true } },
      media: { where: { asset: { status: 'READY' } }, orderBy: { order: 'asc' }, include: { asset: true } },
      deathRecord: { select: { causeOfDeath: true, diedAt: true, invalidatedAt: true } },
      dischargeRecord: { select: { dischargedAt: true, invalidatedAt: true } },
    },
  });
  if (!animal) return null;

  const where: { animalId: string; deletedAt: null; occurredAt?: { gte: Date; lte: Date } } = { animalId, deletedAt: null };
  if (range) {
    const b = filterBounds({ kind: 'custom', from: range.from, to: range.to }, new Date());
    if (b) where.occurredAt = { gte: new Date(b.start), lte: new Date(b.end) };
  }
  const activities = await prisma.activity.findMany({
    where, orderBy: { occurredAt: 'asc' },
    include: { media: { where: { asset: { status: 'READY' } }, include: { asset: true } } },
  });
  const docs = await prisma.document.findMany({
    where: { animalId, deletedAt: null }, orderBy: [{ category: 'asc' }, { createdAt: 'desc' }], include: { file: true },
  });

  const death = animal.deathRecord && !animal.deathRecord.invalidatedAt
    ? { causeOfDeath: animal.deathRecord.causeOfDeath, diedAt: animal.deathRecord.diedAt.toISOString() } : null;
  const discharge = animal.dischargeRecord && !animal.dischargeRecord.invalidatedAt
    ? { dischargedAt: animal.dischargeRecord.dischargedAt.toISOString() } : null;

  const raw: RawReportData = {
    generatedAt: new Date().toISOString(),
    range: range ?? null,
    animal: {
      name: animal.name, species: animal.species, breed: animal.breed, gender: animal.gender, ageText: animal.ageText,
      ward: animal.ward, cageName: animal.cage?.name ?? null, status: animal.status, admittedAt: animal.admittedAt.toISOString(),
      complaint: animal.complaint, diagnosis: animal.diagnosis, rescuer: animal.rescuer, broughtBy: animal.broughtBy,
      media: animal.media.map(toRawMedia), death, discharge,
    },
    activities: activities.map((a) => ({
      type: a.type, occurredAt: a.occurredAt.toISOString(), byName: a.byName, editedAt: a.editedAt?.toISOString() ?? null,
      remarks: a.remarks, data: a.data, media: a.media.map(toRawMedia),
    })),
    documents: docs.map((d) => ({
      id: d.id, category: d.category, kind: d.kind, name: d.name, createdAt: d.createdAt.toISOString(),
      file: d.file ? { assetId: d.file.id, kind: d.file.kind as MediaKindLite, filename: d.file.filename, storageKey: d.file.storageKey } : null,
    })),
  };
  return buildReportModel(raw);
}

// Every still asset the PDF embeds (activity photos/x-rays + admission + document images).
export function collectImageAssets(model: ReportModel): { assetId: string; storageKey: string }[] {
  const out = new Map<string, string>();
  for (const m of model.admissionMedia) out.set(m.assetId, m.storageKey);
  for (const d of model.days) for (const e of d.entries) for (const m of e.stills) out.set(m.assetId, m.storageKey);
  for (const doc of model.documents)
    if (doc.file && (doc.file.kind === 'PHOTO' || doc.file.kind === 'XRAY')) out.set(doc.file.assetId, doc.file.storageKey);
  return Array.from(out.entries()).map(([assetId, storageKey]) => ({ assetId, storageKey }));
}
```

- [ ] **Step 2: Write a unit test for the pure collector**

Create `src/features/reports/patient-pdf/__tests__/collect.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { collectImageAssets } from '../data';
import type { ReportModel } from '../model';

const model = {
  admissionMedia: [{ assetId: 'adm1', storageKey: 'k-adm1', kind: 'PHOTO', label: null, filename: 'a' }],
  days: [{ key: 'd', label: 'd', entries: [{ stills: [{ assetId: 'p1', storageKey: 'k-p1', kind: 'PHOTO', label: null, filename: 'p' }], type: 'FOOD', time: '12:00', byName: 'x', edited: false, summary: '', details: [], links: [] }] }],
  documents: [{ id: 'd1', category: 'MEDICAL', kind: 'x', name: 'n', createdAt: 'iso', file: { assetId: 'doc1', storageKey: 'k-doc1', kind: 'PHOTO', filename: 'd' } }],
} as unknown as ReportModel;

describe('collectImageAssets', () => {
  it('dedupes and includes activity + admission + document images', () => {
    const got = collectImageAssets(model).map((x) => x.assetId).sort();
    expect(got).toEqual(['adm1', 'doc1', 'p1']);
  });
});
```

- [ ] **Step 3: Run it**

Run: `pnpm vitest run src/features/reports/patient-pdf/__tests__/collect.test.ts`
Expected: PASS.

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/reports/patient-pdf/data.ts src/features/reports/patient-pdf/__tests__/collect.test.ts
git commit -m "feat(report): patient report data fetch + image-asset collector"
```

---

## Task 8: Route handler

**Files:** Create: `src/app/api/patients/[id]/report/route.ts`

- [ ] **Step 1: Implement the route**

Create `src/app/api/patients/[id]/report/route.ts`:

```ts
import { getCurrentUser } from '@/lib/auth';
import { RbacError } from '@/lib/errors';
import { assertCan } from '@/lib/rbac';
import { collectImageAssets, getPatientReportData } from '@/features/reports/patient-pdf/data';
import { loadReportImages } from '@/features/reports/patient-pdf/images';
import { renderPatientReportPdf } from '@/features/reports/patient-pdf/render';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; // react-pdf + sharp need Node, not edge
export const maxDuration = 120; // image-heavy reports
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  try {
    assertCan({ id: user.id, role: user.role }, 'report.generate');
  } catch (e) {
    if (e instanceof RbacError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const sp = new URL(req.url).searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  const range = from && to ? { from, to } : undefined;

  const model = await getPatientReportData(id, range);
  if (!model) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const images = await loadReportImages(collectImageAssets(model));
  const pdf = await renderPatientReportPdf(model, images);

  const safe = `${model.patient.name}-${model.patient.species}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'patient';
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${safe}-report-${date}.pdf"`,
      'cache-control': 'no-store',
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Manual check (LOCAL DB — run the safety preflight first!)**

Confirm the DB target is local (see the safety preflight at the top), then with the local stack running and logged in as a DOCTOR/ADMIN, hit `/api/patients/<a-real-local-id>/report` in the browser → a PDF downloads. As a STAFF user → 403 JSON.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/patients/[id]/report/route.ts
git commit -m "feat(report): GET /api/patients/[id]/report -> application/pdf (RBAC-gated)"
```

---

## Task 9: Download button + generate dialog + wiring

**Files:**
- Create: `src/features/reports/components/DownloadReportButton.tsx`
- Modify: `src/features/animals/components/AnimalDetailActions.tsx`
- Modify: `src/features/animals/components/AnimalDetail.tsx`

- [ ] **Step 1: Implement `DownloadReportButton.tsx`** (modal mirrors `DocumentUploadDialog`)

Create `src/features/reports/components/DownloadReportButton.tsx`:

```tsx
'use client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { FileDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  animalId: string;
  canGenerate: boolean;
  admittedAt: string; // ISO; bounds the range picker
}

export function DownloadReportButton({ animalId, canGenerate, admittedAt }: Props) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<'all' | 'range'>('all');
  const minDate = admittedAt.slice(0, 10);
  const maxDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [from, setFrom] = useState(minDate);
  const [to, setTo] = useState(maxDate);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!canGenerate) return null;

  const generate = async () => {
    setBusy(true);
    try {
      const lo = from <= to ? from : to;
      const hi = from <= to ? to : from;
      const qs = scope === 'range' ? `?from=${lo}&to=${hi}` : '';
      const res = await fetch(`/api/patients/${animalId}/report${qs}`);
      if (!res.ok) {
        showToast({ message: 'Could not generate the report' });
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') ?? '';
      const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? 'patient-report.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch {
      showToast({ message: 'Could not generate the report' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <FileDown size={14} />
        Download report (PDF)
      </Button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" aria-modal="true" aria-label="Download report">
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 cursor-default bg-black/45" />
          <div ref={dialogRef} className="relative z-10 w-full max-w-md rounded-t-lg bg-paper p-6 shadow-2xl md:rounded-lg">
            <h2 className="font-display text-base font-bold">Download patient report</h2>
            <p className="mt-1 text-sm text-muted">A full clinical PDF with every activity and all photos.</p>
            <div className="mt-4 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />
                Whole stay
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="scope" checked={scope === 'range'} onChange={() => setScope('range')} />
                Date range
              </label>
              {scope === 'range' && (
                <div className="flex items-end gap-3 pl-6">
                  <label className="flex flex-col gap-1 text-[11px] text-muted">From
                    <Input type="date" min={minDate} max={maxDate} value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-muted">To
                    <Input type="date" min={minDate} max={maxDate} value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
                  </label>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button size="sm" onClick={generate} disabled={busy}>{busy ? 'Generating…' : 'Generate'}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Render it in `AnimalDetailActions.tsx`**

Add the import near the other imports:
```tsx
import { DownloadReportButton } from '@/features/reports/components/DownloadReportButton';
```
Extend `Props`:
```tsx
interface Props {
  animalId: string;
  status?: 'CRITICAL' | 'STABLE' | 'OBSERVATION' | 'DISCHARGED' | 'DECEASED';
  canReopen?: boolean;
  canRevalidate?: boolean;
  canGenerateReport?: boolean;
  admittedAt?: string;
}
```
Destructure the new props in the function signature:
```tsx
export function AnimalDetailActions({ animalId, status, canReopen, canRevalidate, canGenerateReport, admittedAt }: Props) {
```
Render the button right after `<PatientShareButton animalId={animalId} />` (line ~100):
```tsx
      <PatientShareButton animalId={animalId} />
      {canGenerateReport && admittedAt && (
        <DownloadReportButton animalId={animalId} canGenerate admittedAt={admittedAt} />
      )}
```

- [ ] **Step 3: Pass the props from `AnimalDetail.tsx`**

In `src/features/animals/components/AnimalDetail.tsx`, the `AnimalDetailActions` already receives `animalId`/`status`/`canReopen`/`canRevalidate`. Add:
```tsx
        <AnimalDetailActions
          animalId={animal.id}
          status={animal.status}
          canReopen={isSuperAdmin && caseClosed}
          canRevalidate={isSuperAdmin && !caseClosed && hasInvalidatedRecord}
          canGenerateReport={!!currentUser && ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)}
          admittedAt={animal.admittedAt.toISOString()}
        />
```
(`currentUser` and `animal` are already in scope in `AnimalDetail`.)

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm exec biome check src/features/reports/components/DownloadReportButton.tsx src/features/animals/components/AnimalDetailActions.tsx src/features/animals/components/AnimalDetail.tsx`
Expected: clean (apply `biome check --write` on these files if it reports formatting, then re-run).

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/components/DownloadReportButton.tsx src/features/animals/components/AnimalDetailActions.tsx src/features/animals/components/AnimalDetail.tsx
git commit -m "feat(report): role-gated Download report button + generate dialog"
```

---

## Task 10: End-to-end test

**Files:** Create: `tests/e2e/patient-report.spec.ts`

> **Run the DB safety preflight first.** The Playwright dev server uses `.env.local`; ensure it targets the **local** DB before running (these tests create a patient).

- [ ] **Step 1: Write the e2e**

Create `tests/e2e/patient-report.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { login } from './helpers';

async function admitPatient(page: import('@playwright/test').Page, name: string) {
  await page.goto('/patients/new');
  await page.getByLabel('Animal name / temporary ID').fill(name);
  await page.getByLabel('Species').selectOption('Cat');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Chief complaint').fill('Report test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Admit animal' }).click();
  await page.waitForURL(/\/patients\/[a-z0-9]+$/, { timeout: 30_000 });
}

test('admin can download a patient report PDF', async ({ page }) => {
  await login(page); // admin@arham.care (ADMIN) — allowed
  await admitPatient(page, 'ReportAdmin');
  await page.getByRole('button', { name: /download report/i }).click();
  await expect(page.getByRole('heading', { name: 'Download patient report' })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Generate', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
});

test('staff does not see the download report button', async ({ page }) => {
  await login(page, 'sahil@arham.care', 'staff1234'); // STAFF — not allowed
  await admitPatient(page, 'ReportStaff');
  await expect(page.getByRole('button', { name: /download report/i })).toHaveCount(0);
});
```

- [ ] **Step 2: Run it (against verified-local)**

Run: `pnpm test:e2e -- patient-report.spec.ts --project=chromium-desktop`
Expected: both tests PASS (a `.pdf` download for admin; no button for staff).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/patient-report.spec.ts
git commit -m "test(e2e): patient report PDF download + role gating"
```

---

## Task 11: Full verification gate

- [ ] **Step 1: Run every gate**

```bash
pnpm typecheck
pnpm lint
pnpm test                       # all unit incl fonts/model/images/render/collect/rbac
pnpm audit --audit-level=high   # dependency security gate
```
Expected: typecheck clean; lint shows only the pre-existing warnings (no new); all unit tests green; audit reports no high/critical.

- [ ] **Step 2: e2e against verified-local** (after the DB preflight)

Run: `pnpm test:e2e -- patient-report.spec.ts --project=chromium-desktop`
Expected: PASS.

- [ ] **Step 3: Confirm the diff is scoped**

Run: `git diff main --stat`
Expected: only the files in the File Structure table (+ the 8 font TTFs, `package.json`/lockfile, `next.config.*`, the committed spec). No schema/migration changes.

---

## Self-Review

**Spec coverage:**
- Engine `@react-pdf/renderer` → Tasks 1, 6. Audited 0 vulns + `pnpm audit` gate → Tasks 1, 11.
- Separate role-gated Download button (DOCTOR/ADMIN/SUPER_ADMIN), Share untouched → Tasks 3 (RBAC), 9 (button + `canGenerate`/wiring), 10 (gating e2e).
- Whole stay + optional range → Task 7 (`filterBounds` range), Task 9 (dialog scope).
- Everything visual embedded (activity photos/x-rays + admission + document images); videos/docs as links → Task 6 (`ActivityBlock`, admission grid, links), Task 7 (`collectImageAssets`).
- `sharp` downscale + concurrency limit + per-image failure tolerance → Task 5.
- Summary-first layout (hero, stat tiles, meds table, outcome, day-grouped log, compact rows, captioned grids, footer page numbers) → Task 6 + Task 4 (stats/meds/outcome).
- Non-Latin fonts + IST → Task 2 (`registerReportFonts`/`pickFont`), Task 4 (IST formatting).
- Route returns `application/pdf` attachment, 401/403/404 → Task 8.
- Tests run against local DB (Neon-write avoidance) → safety preflight + Tasks 10/11 notes; core logic unit-tested with no DB → Tasks 2,4,5,6,7.

**Placeholder scan:** none — every code/command/expected-output is concrete. (The only intentional "adjust if it 404s" is Task 2 Step 2 font verification, which has a concrete fallback + a hard gate.)

**Type consistency:** `RawReportData`/`RawMedia`/`ReportModel`/`ReportEntry`/`ReportDay`/`ReportMed`/`MediaKindLite` are defined once in `model.ts` and imported by `data.ts`, `Report.tsx`, `render.tsx`, and tests. `buildReportModel(raw): ReportModel`, `collectImageAssets(model): {assetId,storageKey}[]`, `loadReportImages(assets): Map<string,Buffer>`, `downscaleImage(buf): Buffer`, `renderPatientReportPdf(model, images): Buffer`, `registerReportFonts()`, `pickFont(text): string`, and RBAC `'report.generate'` are used with identical signatures across tasks. Route URL `/api/patients/[id]/report` matches the button's `fetch` and the `outputFileTracingIncludes` key.

