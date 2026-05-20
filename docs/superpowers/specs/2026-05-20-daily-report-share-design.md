# Daily report — Share / Copy button

**Status:** approved
**Date:** 2026-05-20
**Surface:** `/reports/today` (the Daily activity report page)

## Goal

Doctors finish a shift and want to paste the day's activities into WhatsApp
to send to owners, on-call staff, or the clinic group. Today they'd have to
hand-copy each row out of the table or wrangle the CSV in a spreadsheet.

A single "Share" button at the top of the Daily activity report should
build the day's activity log as plain text grouped by animal and write it
to the clipboard so the user can paste anywhere.

## User decisions captured during brainstorming

| Decision | Choice |
|---|---|
| Paste target | WhatsApp — plain text with light emojis |
| Scope | Always the full day (filter chips don't affect the copy) |
| Grouping | By animal |
| Architecture | Client-side formatter + `navigator.clipboard.writeText()` |

## Output format

```
🏥 Arham Always Care — Wed, 20 May 2026
18 entries

🐶 Bruno (Dog · Surgery-1)
• 09:15  Doctor round — Stable, 38.5°C  (Dr. Mehta)
• 09:30  Treatment — Amoxiclav 20mg/kg Oral  (Dr. Mehta)
• 12:30  Food — Kibble · Fully eaten  (Nurse Pooja)  📎
• 17:00  Walk — 15min · Normal · independent  (Sahil)

🐱 Milo (Cat · ISO-A)
• 09:00  Doctor round — Improving  (Dr. Iyer)
• 11:30  Diagnostic — Blood test  (Dr. Iyer)  📎
…
```

Rules:

- Top line is a fixed header with date in `EEE, d MMM yyyy` form (en-GB) +
  total entry count.
- Animals are sorted by name (case-insensitive), ascending.
- Within each animal, rows are sorted by `occurredAt` ascending — reads as
  a chronological narrative of that animal's day.
- Per-row time is 24-hour `HH:MM` (matches the rest of the app's clock-time
  formatter, deterministic across server/client locales).
- `(byName)` parenthetical is **always** appended after the summary.
  Doctors doing handover need to know who logged what; the visual cost
  is small and the "was it overridden?" inference would require
  comparing to the original logger's name (which we'd have to join in).
  Simpler rule, unambiguous to implement.
- A 📎 tag is appended **at the very end of the row, after `(byName)`**
  when the activity has at least one READY attached media. We do NOT
  include `/api/files/…` URLs — they're auth-gated and useless outside
  the app.

Full row template:

```
• HH:MM  {ActivityLabel} — {summary}  ({byName}){ 📎 if mediaCount > 0}
   ↳ {detailLine1}
   ↳ {detailLine2}
   …
```

Each row carries every populated field as an indented `↳` sub-bullet
after the headline. **No fields are dropped** — the spec name is
"everything the doctor logged". String fields that the doctor left
blank are skipped (no `Field: —` noise). Boolean fields (e.g.
vomiting, urination, stool-after-walk, assisted) are always emitted
as `yes`/`no` because "no" is clinically meaningful information on
a handover, not absence.

Detail-line formatter `activityDetailLines(type, data, remarks)` lives
in `src/features/activities/summary.ts` alongside the existing
`summarizeActivity`. Returns `string[]`. Per-type field mapping:

| Type | Lines emitted (when present) |
|---|---|
| TREATMENT | `Med N: name · dose · route` (one line per med), `Remarks: …` |
| ROUND | `Temp: …`, `Appetite: …`, `Hydration: …`, `Pain: …`, `Wound: …`, `Stool: …`, `Progress: …`, `Notes: …`, `Remarks: …` |
| DIAGNOSTIC | `Tests: …` (joined), `Findings: …`, `Interpretation: …`, `Remarks: …` |
| SURGERY | `Surgery name: …`, `Surgeon: …`, `Anesthesia: …`, `Duration: …`, `Findings: …`, `Complications: …`, `Post-op: …`, `Remarks: …` |
| FOOD | `Food type: …`, `Quantity: …`, `Water: …`, `Intake: …`, `Vomiting: yes/no`, `Remarks: …` |
| BATH | `Bath type: …`, `Grooming by: …`, `Bath notes: …` (data.remarks), `Remarks: …` (activity remarks) |
| WALK | `Duration: …`, `Mobility: …`, `Urinated: yes/no`, `Stool: yes/no`, `Assisted: yes/no`, `Remarks: …` |
| ADMISSION | `Summary: …`, `Remarks: …` |

Species emoji map: Dog 🐶 · Cat 🐱 · Cow 🐄 · Bird 🐦 · Goat 🐐 · Rabbit 🐰 ·
Other 🐾.

## Architecture

### Data shape

`listActivitiesOnDate` (in `src/features/reports/queries.ts`) currently
returns slim rows: `{ id, animalId, animalName, type, occurredAt, byName }`.
Extend it to also include:

- `data` (per-type activity payload, jsonb)
- `remarks`
- `animalSpecies`
- `animalWard`
- `mediaCount` — count of attached `READY` ActivityMedia rows
- `summary` — pre-computed via `summarizeActivity({ type, data, remarks })`
  so we don't ship the per-type `data` shape to the client

The `data` field is consumed only to compute `summary` server-side; it is
NOT included in the returned row.

The query stays uncached (it powers an interactive date picker) — adding
columns to an already-running query is cheap.

### Pure formatter

New module `src/features/reports/dailyReportText.ts` exporting a single
function:

```ts
export function formatDailyReportText(
  date: string,           // 'YYYY-MM-DD' as already used by the page
  rows: DailyReportRow[],
): string
```

`DailyReportRow` is the new shape returned by `listActivitiesOnDate`.

The function:

1. Builds the header line.
2. Groups rows by `animalId` (preserving display order via `animalName`).
3. For each group, emits the per-animal header + sorted rows.
4. Joins with `\n` and returns.

No DOM access, no clipboard call. Easy to unit-test.

### UI changes

In `src/features/reports/components/DailyReport.tsx`:

- Add a new button next to the existing **Export CSV** button labelled
  **Share** with a `Share` lucide icon. Same disabled gating as Export
  (`rows.length === 0`).
- On click:
  ```ts
  const text = formatDailyReportText(date, rows);
  try {
    await navigator.clipboard.writeText(text);
    showToast({ message: 'Daily report copied — paste in WhatsApp / Slack / etc.' });
  } catch {
    fallbackCopy(text);
    showToast({ message: 'Copied (fallback)' });
  }
  ```
- `fallbackCopy` creates a hidden `<textarea>`, selects it, runs
  `document.execCommand('copy')`, removes the element. Handles Safari
  iframes and any non-https origins that block the Clipboard API.

`useToast` is already imported across the codebase; nothing new to wire.

## Testing

### Unit (vitest)

`src/features/reports/__tests__/dailyReportText.test.ts`:

- **Empty rows** → returns just the header line + entry count (`0 entries`).
- **Single animal, 4 activities** → header + animal block with all four
  rows sorted by time.
- **Multiple animals** → animals sorted alphabetically; each animal's
  rows sorted by time.
- **Mixed media** → row with `mediaCount > 0` gets the 📎 tag at the
  end (after `(byName)`).
- **byName always present** → every row ends with `  (byName)`.

### E2E (playwright tsx probe)

`scripts/qa-daily-report-share.ts` (kept in scripts/, not committed as a
spec file):

- Login as admin
- Navigate to `/reports/today`
- Pick a date with known activities
- Click Share, assert toast is visible
- `page.evaluate(() => navigator.clipboard.readText())` returns the
  expected formatted string

## Out of scope

- Web Share API native share-sheet (`navigator.share()`) on mobile —
  natural follow-up, not blocking.
- Per-row media URLs in the copy — auth-gated; useless outside the app.
- Email / PDF export — separate feature.
- Customisable templates (without emojis, English/Hindi toggle) —
  not requested.

## Files touched

| Action | File |
|---|---|
| Modify | `src/features/reports/queries.ts` (extend `listActivitiesOnDate`) |
| Create | `src/features/reports/dailyReportText.ts` (pure formatter) |
| Create | `src/features/reports/__tests__/dailyReportText.test.ts` |
| Modify | `src/features/reports/components/DailyReport.tsx` (Share button + onClick) |
