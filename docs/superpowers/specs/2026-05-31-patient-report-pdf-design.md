# Patient Report PDF — Design

- **Date:** 2026-05-31
- **Status:** Draft (awaiting user review)
- **Area:** Patient detail page → downloadable clinical report

## Problem

There's no way to export a patient's full clinical record. The existing Share button copies a **single day's** text summary to the clipboard. Staff need a complete, presentable **PDF of the whole stay** — every activity in full detail, with the photos — to hand to owners, NGOs, or for records.

## Goals

1. A one-click **downloadable PDF** covering a patient's whole stay (optionally a date range), with **every activity in full detail** and **all images embedded** — nothing omitted.
2. A polished, branded document (the layout validated during brainstorming): summary-first page, then a chronological activity log.
3. Generate it server-side on **Vercel** without heavyweight infrastructure.

## Non-goals / hard constraints

- **No headless Chromium.** Rendered with `@react-pdf/renderer` (pure JS) — Vercel-serverless-safe.
- **No new vulnerable dependencies.** `@react-pdf/renderer@4.5.1` is the only new runtime dependency; it was vetted (see *Security & dependencies*). No `p-limit` (inline limiter); fonts are static OFL TTFs. A `pnpm audit` gate is added.
- **Don't mutate / read-for-write any prod data.** This is read-only generation. All tests run against the **local** Postgres — and the implementation must force a verified-local `DATABASE_URL` (the repo's `.env.local` points at Neon prod; see `docs` and project memory). 
- **IST everywhere** (`Asia/Kolkata`), reusing the existing report time formatting.
- **react-pdf is not HTML/CSS.** The approved mock is the *visual reference*; the document is rebuilt in react-pdf primitives. No colour emoji (type icons become small colour marks); fonts must be registered TTFs.

## UX decisions (from brainstorming)

| Decision | Choice |
| --- | --- |
| Engine | `@react-pdf/renderer` → real `.pdf` file download |
| Trigger | **Separate** "Download report (PDF)" button on the patient page, beside Share (Share unchanged) |
| Access | New RBAC `report.generate` = **DOCTOR / ADMIN / SUPER_ADMIN** (STAFF & VIEWER excluded) |
| Coverage | Whole stay by default; optional **date range** in the generate dialog |
| Media | **Everything visual**: activity photos + X-rays, admission photos, and Documents-tab files. Videos → tappable signed-URL links. Photos downscaled via `sharp`. |
| Layout | Summary-first page (hero + stat tiles + outcome + meds table + admission media) → activity log grouped by day; **variable rhythm** (compact rows for photo-less entries, full photo cards otherwise); type-colour rails; tag pills; captioned photo grids; serif headings (Fraunces), Noto Sans body |

## Architecture

New folder `src/features/reports/patient-pdf/`. Units are isolated so the data assembly and image pipeline are testable without rendering, and the renderer is pure.

### `data.ts` — assemble everything (server, read-only)
`getPatientReportData(animalId, range?: { from: string; to: string }): Promise<PatientReportData | null>`
- Loads the patient (reusing `getAnimal`-style includes: cage, createdBy, `deathRecord`, `dischargeRecord`, admission `media`).
- Loads **all** activities (ascending, soft-deleted excluded), filtered to `range` if given (reuse the day-bounds logic from `src/features/activities/filter.ts`). No 500 cap for the report.
- Loads Documents-tab files (`listDocumentsForAnimal`).
- For each media row, selects the **`MediaAsset.storageKey`**, `kind`, `mimeType`, `label` (so `images.ts` can fetch bytes directly) plus a `signMediaUrl(assetId)` link (for video/doc links in the PDF).
- Computes: day groups, **stats** (days admitted from `admittedAt`→discharge/death/now; counts per `ActivityType`; photo count), **outcome** (`death`/`discharge` records, ignoring invalidated), and a **medications aggregate** (over `TREATMENT` `data.meds`: by drug → doses, routes, #times, #days).
- Returns a typed, serialisable `PatientReportData`.

### `images.ts` — fetch + downscale (server)
`loadReportImages(assets): Promise<Map<assetId, Buffer>>`
- For each still (`PHOTO`/`XRAY`): `getStorage().getStreamOnly(storageKey)` → buffer → `sharp(buf).rotate().resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer()`.
- **Inline concurrency limiter** (e.g. `mapLimit(assets, 4, …)`) so Drive isn't hammered; no new dependency.
- A single failed/unsupported image (e.g. HEIC where libvips lacks HEIF) resolves to **omit → placeholder** in the doc; it never fails the whole report.
- Videos/docs are **not** fetched — they render as links.

### `fonts.ts` — register TTFs
`Font.register` for **Noto Sans** (400/600/700/800), **Noto Sans Devanagari**, **Noto Sans Gujarati** (body + non-Latin names), and **Fraunces** (600/700) for headings. TTFs bundled at `src/features/reports/patient-pdf/fonts/` (OFL). `Font.registerHyphenationCallback` disabled (no mid-word breaks).

### `Report.tsx` — the document (react-pdf)
`<Document><Page size="A4">…`, `StyleSheet` mirroring the approved mock. Components: `Header`, `PatientHero`, `StatTiles`, `MedsTable`, `AdmissionMedia`, `DaySection`, `ActivityCard` (full photo-left / compact one-line), `PhotoGrid` (captioned), `Footer` (fixed, page numbers via `render={({ pageNumber, totalPages }) => …}`). Images via `<Image src={imagesMap.get(assetId)} />`. Type icons → small colour dots (no emoji).

### `render.ts`
`renderPatientReportPdf(data, images): Promise<Buffer>` → `renderToBuffer(<Report data={data} images={images} />)`.

### Route handler — `src/app/(app)/patients/[id]/report/route.ts` (GET)
```ts
export const runtime = 'nodejs';      // react-pdf + sharp need Node, not edge
export const maxDuration = 120;       // image-heavy reports
```
- `getCurrentUser()`; if none → 401. `assertCan(actor, 'report.generate')` → 403 on failure.
- Parse optional `?from=YYYY-MM-DD&to=YYYY-MM-DD`.
- `data = await getPatientReportData(id, range)`; if `null` → 404.
- `images = await loadReportImages(...)`; `buf = await renderPatientReportPdf(data, images)`.
- `return new Response(buf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="<name>-<species>-report-<YYYY-MM-DD>.pdf"' } })` (filename sanitised; name trimmed, e.g. `"Facebook "` → `Facebook`).

### RBAC — `src/lib/rbac.ts`
Add `'report.generate': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN']` to `PERMISSIONS`.

### UI
- **`src/features/reports/components/DownloadReportButton.tsx`** (`'use client'`), props `{ animalId: string; canGenerate: boolean }`. Renders nothing when `!canGenerate`. Button → small dialog: scope radio **Whole stay** (default) / **Date range** (two `<Input type="date">`, `min`=admission day, `max`=today, mirroring the activity filter). **Generate** → `fetch('/patients/<id>/report?from=&to=')` → `blob` → object-URL anchor click to download; `useState`/`useTransition` drives a "Generating…" spinner; non-OK → toast.
- **`AnimalDetailActions.tsx`**: render `<DownloadReportButton animalId canGenerate={canGenerateReport} />` beside `<PatientShareButton>`. `canGenerateReport` computed in `AnimalDetail` from `currentUser.role ∈ {DOCTOR,ADMIN,SUPER_ADMIN}` and passed down (new prop on `AnimalDetailActions`).

### Data flow
button → `GET /patients/[id]/report?from&to` → auth + RBAC → `getPatientReportData` → `loadReportImages` (sharp, limited) → `renderPatientReportPdf` → `Response(application/pdf, attachment)` → browser downloads.

## Content & layout (approved mock)

- **Header band:** clinic name (Fraunces) + "Patient Report · Whole Stay" + generated date / by-user.
- **Hero:** patient photo, name, outcome pill (green discharged / red deceased / amber in-care), 2-col info grid (species·breed, sex·age, ward·cage, admitted, complaint, diagnosis, rescuer, brought-by).
- **Stat tiles:** Days admitted · per-type counts · Photos. Cause-of-death line if applicable.
- **Medications table:** Drug · Dose · Route · Times · Span.
- **Admission media** grid (captioned).
- **Activity log:** day section bands; each entry either a full card (type-colour left rail, chip, time, tag pills for vitals/booleans, detail lines, photo-left or captioned grid, video/doc links, by-line) or — when it has no photos — a compact one-line row.
- **Footer:** patient · "Confidential clinical record" · page numbers.

## Security & dependencies

- **`@react-pdf/renderer@4.5.1`** — vetted by resolving its full tree in isolation and running `npm audit`: **0 vulnerabilities** (101 transitive packages). Pin `4.5.1`.
- **No other new runtime deps:** `sharp` already present; concurrency limiter is inline; fonts are static OFL TTFs (not npm packages).
- **Gate:** the dependency-adding task runs `pnpm audit --audit-level=high` (must pass); re-vet on any version bump. (See project memory: *vet-dependencies-for-vulnerabilities*.)

## Error handling

- Unauthenticated → 401; lacking `report.generate` → 403; animal missing/soft-deleted → 404.
- Per-image fetch/decode failure → placeholder tile, report still renders.
- Empty stay (no activities) → still renders header + summary + "No activities recorded."
- Generation error → route returns 500; the button shows a toast and re-enables.

## Testing

All DB-touching tests run against **local** Postgres with a **forced local `DATABASE_URL`** (never `.env.local`/Neon — see memory *env-local-points-to-neon-prod*).
- **Unit:** `data.ts` aggregation (stats, meds aggregate, outcome from death/discharge incl. invalidated-ignored, range filtering); `images.ts` resize on a fixture image (asserts JPEG output within 1000px via `sharp.metadata()`); filename sanitisation.
- **Integration:** route handler — seed an animal + multi-day activities + media locally; `GET` as DOCTOR → 200, `Content-Type: application/pdf`, body starts with `%PDF`, `Content-Disposition` filename correct; as STAFF and VIEWER → 403; unknown id → 404.
- **E2E (Playwright):** DOCTOR → patient page → "Download report (PDF)" visible → dialog → Generate → a PDF downloads (assert the download / response content-type). STAFF login → button absent.

## Out of scope / YAGNI

- Auto-emailing / WhatsApp-attaching the PDF (download only).
- A whole-stay **text** report (Share stays per-day).
- Caching or persisting generated PDFs.
- Video frame extraction (videos are links).
- Non-IST locales / multi-language report chrome.
