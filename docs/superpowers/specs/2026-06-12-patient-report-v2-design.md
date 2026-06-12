# Patient Report v2 — clinic branding, clinical sections, uncropped images

- **Date:** 2026-06-12
- **Status:** Approved (brainstormed with visual companion; direction A + C-signature chosen)
- **Builds on:** `docs/superpowers/specs/2026-05-31-patient-report-pdf-design.md` (v1)

## Problem

The v1 patient PDF works but undersells the clinic and the data: app-teal chrome with a text-only brand line (no logo), photos and X-rays cropped into fixed boxes (`objectFit: cover` — clinically bad for X-rays), surgeries and diagnostics buried inside the chronological log, no closing summary or signature for official use, and no at-a-glance recovery story for owners/NGOs/donors.

## Decisions (from brainstorming)

| Decision | Choice |
| --- | --- |
| Audience | Both readerships, summary-first: 30-second read for owners/NGOs up top, full clinical depth below |
| Visual direction | **A — clinic stationery**: cream `#FDFBF6` chrome, deep red `#8B1A12` headings, gold `#C9A55C` hairline rules, with the real **Arham Always Care logo**; plus **C's signature block** on the closing section |
| Logo source | `Arham Always Care cc.png` (repo root, user-provided, 696px) → downscaled copy committed at `src/features/reports/patient-pdf/assets/logo.png` |
| Images | **Never cropped.** Every image renders complete at its own aspect ratio inside a max box (smaller than original is fine) |
| New sections | Surgery, Diagnostics, Recovery strip, Outcome & sign-off |
| Cover page | **Skipped** (user decision). Page 1 = big masthead then content. The printed contents list dies with it; **PDF sidebar bookmarks stay** |
| Rejected | Vitals trend chart, medication day-matrix, WhatsApp share of the PDF, QR code, printed TOC page numbers |

## Document structure (v2)

1. **Masthead (page 1 only, in flow):** cream band, centered logo (~64% width), kicker line `PATIENT REPORT · WHOLE STAY` (or the range label) + generated date, gold rule.
2. **Hero:** framed patient photo (uncropped, gold-mat frame), name in red serif, outcome pill (green discharged / red deceased / amber in-care), key-facts grid (species·breed, sex·age, admitted, complaint, diagnosis, rescuer, brought by, cage).
3. **Recovery strip:** "Day 1" photo → red arrow → "Day N" photo with labels (`DAY 1 · at admission`, `DAY N · at discharge/latest`). Candidates consider `kind === 'PHOTO'` only (never X-rays). Selection rule: Day-1 candidate = first admission-media photo, else the chronologically first activity photo; Day-N candidate = the chronologically last activity photo. Render only when both exist, are different assets, AND fall on different calendar days (IST) — otherwise the strip is omitted entirely.
4. **Stay at a glance:** stat tiles (days, per-type counts, photos) in red/gold styling; cause-of-death line when applicable.
5. **Medications given:** existing aggregate table (Drug / Dose / Route / Times / Span), restyled.
6. **Surgery** *(only if ≥1 SURGERY activity)*: one full card per surgery — name, date·time, duration, surgeon, anesthesia, findings, complications, post-op notes, remarks, and its stills (uncropped) with captions.
7. **Diagnostics** *(only if ≥1 DIAGNOSTIC activity)*: one full card per diagnostic — tests, findings, interpretation, remarks, stills (X-rays) uncropped.
8. **Admission media:** captioned grid, uncropped.
9. **Day-by-day log:** day bands + entries as today, EXCEPT SURGERY and DIAGNOSTIC entries always render as compact one-line rows suffixed `→ Surgery section` / `→ Diagnostics section`; their stills appear only in the dedicated sections (no double-embedding, smaller files). Photo stats count each still once.
10. **Documents:** as today, restyled.
11. **Outcome & sign-off (closing section, kept unsplit on a page via `wrap={false}` / break control):**
    - Outcome box: `DISCHARGED · date` + discharge summary text + "Discharged by <name>" — or `DECEASED · date` + cause of death + "Recorded by <name>" — or `IN CARE` with current status.
    - Signature lines: `Attending veterinarian` and `Date` (blank rules for ink).
    - Provenance line: `Generated from IPD records on <datetime IST> · by <current user name>`.
12. **Chrome on every page:** pages 2+ get a fixed compact header (small logo left, `<NAME> · PATIENT REPORT · GENERATED <date>` right, gold rule); all pages keep the fixed footer — left `name (species) · Confidential clinical record`, right `Arham Always Care · Page N of M`.
13. **Bookmarks:** react-pdf `bookmark` props on the section containers (Summary, Surgery, Diagnostics, Admission media, Day-by-day log, Documents, Outcome) → PDF sidebar outline. No printed TOC.

## Brand tokens

`styles.ts` exports `BRAND = { red: '#8B1A12', gold: '#C9A55C', cream: '#FDFBF6', ink: '#221A14', muted: '#5D5347', soft: '#9A8D76', line: '#E8E0D0' }`. Activity `TYPE_COLOR` rails are unchanged (they match the app). Fonts unchanged (Fraunces headings, Noto Sans body + Devanagari/Gujarati fallbacks via `pickFont`).

## Architecture changes

All inside `src/features/reports/patient-pdf/`:

- **`assets/logo.png`** *(new)*: the user's PNG downscaled to ~600px width. Loaded with the same packaging mechanism the bundled fonts already use (filesystem path relative to the feature, traced into the serverless bundle the same way `fonts/` is). Missing/unreadable at runtime → text fallback "Arham Always Care" in the masthead; the report must never fail because of the logo.
- **`images.ts`**: `loadReportImages` now resolves each still via `sharp(...).toBuffer({ resolveWithObject: true })` and returns `Map<assetId, ReportImage>` where `ReportImage = { data: Buffer; width: number; height: number }`. Resize stays `fit: 'inside'` ≤1000px, JPEG q72 — `inside` already preserves the full image; v2 finally *renders* it that way.
- **`model.ts`**:
  - `RawReportData.animal.discharge` gains `summary: string | null` and `dischargedByName: string | null`; `death` gains `recordedByName: string | null`. New top-level `generatedByName: string`.
  - `ReportModel` gains: `recovery: { first: { assetId, label }, last: { assetId, label } } | null`; `surgeries: ReportEntry[]`; `diagnostics: ReportEntry[]` (full entries with stills, each also carrying its `dayLabel` for the card header); day-log entries for those two types carry `crossRef: 'surgery' | 'diagnostics'` and empty `stills`; `outcome` gains `summary`, `byName`; `generatedByName`.
- **`data.ts`**: select `dischargeRecord.summary` + `dischargedBy.name` and `deathRecord.recordedBy.name` (both already loaded by relation in the existing query — only the mapping grows); accept and pass through `generatedByName` from the route.
- **Route (`patients/[id]/report/route.ts`)**: passes `actor.name` as `generatedByName`. No other change (auth/RBAC/params/filename unchanged).
- **Renderer split** (Report.tsx is 485 lines and growing):
  - `styles.ts` — BRAND tokens + the shared `StyleSheet`.
  - `components.tsx` — `T` (font-picking Text), `FitImage` (aspect-ratio-preserving image in a gold-mat frame: given `maxW`/`maxH`, scales to `min(maxW/w, maxH/h)`; placeholder when the buffer is missing), `kv`, chip/pill helpers.
  - `sections.tsx` — `Masthead`, `PageHeader` (fixed, pages 2+ via the `render` page-number prop), `Hero`, `RecoveryStrip`, `StatTiles`, `MedsTable`, `SurgerySection`, `DiagnosticsSection`, `AdmissionMedia`, `DayLog`, `DocumentsList`, `OutcomeSignoff`, `Footer`.
  - `Report.tsx` — thin assembly of the above.
- **`render.ts`**: unchanged signature; accepts the new images map type.

## Image fit rules

- Hero photo: fit within 110×110. Recovery strip: fit within 160×120 each. Section/grid stills: fit within 150×220 (tall X-rays stay complete). Single-photo activity card: fit within 150×220.
- Frames: 1px `BRAND.gold` at 40% on `#F1ECE2` mat; caption line below (time · label) as today.
- `objectFit: 'cover'` and all fixed image w×h boxes are removed.

## Error handling

- Logo load failure → text-brand fallback (report still renders).
- Recovery strip rule unsatisfied → section omitted (no empty frames).
- No surgeries/diagnostics → those sections are omitted (the compact cross-ref rows only ever exist for entries of those types, so no cross-ref can dangle).
- Discharge record without summary → outcome box shows the status line + by-line only.
- Everything else (per-image placeholder, empty stay, 401/403/404/500) — unchanged from v1.

## Testing

Same safety rails as always: **never** the `.env.local` scripts; integration/e2e run against local docker Postgres per the established recipe.

- **Unit (model):** recovery-pair selection (admission-still preferred; distinct-days rule; same-day → null), surgery/diagnostics extraction with log entries compacted + photos counted once, outcome block fields (summary/byName, death recordedBy), `generatedByName` passthrough, fit-math helper (`fitWithin(w, h, maxW, maxH)`).
- **Unit (images):** dimensions returned alongside buffers (fixture image).
- **Render test:** fixture updated to the new `ReportModel` shape; still asserts a parseable `%PDF` with sane size; add a fixture surgery + recovery pair so the new sections execute.
- **Integration:** `getPatientReportData` returns discharge summary/by-name and death recorded-by for seeded records.
- **E2E:** existing `patient-report.spec.ts` (DOCTOR downloads a real PDF; STAFF sees no button) — unchanged, re-run.
- **Manual check:** generate one PDF for a seeded patient with surgery + photos on the local stack and eyeball page 1, image completeness, and the sign-off page.

## Out of scope / YAGNI

Vitals trend charts; medication day-matrix; WhatsApp/share-sheet delivery; QR codes; printed TOC page numbers; caching generated PDFs; any change to who can generate (RBAC) or how the dialog works.
