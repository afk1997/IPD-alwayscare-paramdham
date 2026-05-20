# By-animal list + per-patient Share — design

**Date:** 2026-05-20
**Status:** Approved (pending user review of this written spec)

## Goal

Two related improvements:

1. Reports → **By animal** tab currently shows just a search box. Replace with a visible list of patients (admitted by default) so doctors can pick instead of having to remember a name to type.
2. Add a **Share** button on the patient detail page and on the per-animal report view that copies that patient's daily activities to the clipboard in the same WhatsApp-bold format as `/reports/today`.

## Why

- The empty "Pick an animal above" placeholder is dead space. A list of admitted patients on screen lets the doctor scan, recognise, and click — faster than typing.
- The `/reports/today` Share copies the whole clinic's day. To share only one patient's activities for a WhatsApp handover to the owner / a referring vet, the doctor today has to copy the whole day's report and manually delete every other patient's block. A per-patient Share button removes that scrubbing step.
- The infrastructure exists: `formatDailyReportText`, `copyToClipboard`, `getDailyReportRows`, `searchActiveAnimals` are all already shipped. This spec adds a small filter + a button + a list view.

## Architecture

Two units, both small:

1. **Patient list view** on `/reports/by-animal` — replace the `AnimalPicker` dropdown with a visible list. Server-side query extended to optionally include discharged + deceased patients.
2. **Per-patient daily Share** — one new server action `getPatientDailyShareTextAction(animalId, dateISO?)` and one new client component `<PatientShareButton animalId={...} />`. Mounted on `AnimalDetailActions` (patient page) and on `PerAnimalReportView` (per-animal report).

## Feature 1 — Default patient list on `/reports/by-animal`

### File changes

- **`src/features/animals/queries.ts`**: extend `_searchActiveAnimalsRaw` (or add a sibling) to accept `includePast: boolean`. When `true`, drop the `dischargedAt: null, deceasedAt: null` filters. Cache key includes `includePast` so the two variants cache separately. `take` stays at default 20, raised to 50 for the new list use case.
- **`src/features/animals/actions.ts`**: `searchAnimalsAction(query, includePast = false)` — existing callers (⌘K, QuickAdd) keep the default false. The new list view passes `includePast` from its toggle.
- **`src/features/reports/components/AnimalPicker.tsx`** → rewrite as **`AnimalPickerList.tsx`** (rename to reflect new behaviour):
  - Sticky top: search input + a small `[ ] Show past patients` checkbox.
  - Below: a scrolling list of `take=50` rows. Each row shows the patient's name, species, ward, and a small status pill (`Admitted` / `Discharged` / `Deceased`).
  - Clicking a row navigates to `/reports/by-animal?animalId={id}` (same behaviour as today).
  - When the list is empty post-filter, show "No active patients" / "No matches for '<query>'".
  - When `results.length === 50`, render a one-line hint "Showing first 50 — refine your search to narrow." (Server already caps at 50, so this is a faithful boundary indicator.)
- **`src/app/(app)/reports/by-animal/page.tsx`**: replace the empty-state paragraph with the always-on `<AnimalPickerList />`. When `animalId` is set, the list still renders above the report so the user can switch patients without back-navigation.

### Data flow

- Page load → server reads `searchParams.animalId`, calls `getPerAnimalReport(animalId)` only when set.
- `AnimalPickerList` is a `'use client'` component. On mount it calls `searchAnimalsAction('', false)`. On query/toggle change, debounced 180 ms, re-fetches.
- All three callers of `searchAnimalsAction` (⌘K, QuickAdd, AnimalPickerList) hit the same cached query — the `includePast=true` variant is a separate cache key.

## Feature 2 — Per-patient daily Share

### New server action

**`src/features/reports/actions.ts`** (new file):

```ts
'use server';

export interface PatientShareResult {
  ok: boolean;
  text?: string;
  error?: string;
}

export async function getPatientDailyShareTextAction(
  animalId: string,
  dateISO?: string, // YYYY-MM-DD; defaults to today in Asia/Kolkata
): Promise<PatientShareResult>;
```

Behaviour:
- Requires authenticated user (`requireActor`).
- Computes the IST day boundary for `dateISO ?? today` and calls a new internal `getDailyReportRowsForAnimal(date, animalId)` (small wrapper around the existing `getDailyReportRows`).
- Runs `formatDailyReportText(date, rows)` — same formatter as `/reports/today` Share, just with pre-filtered rows.
- Returns `{ ok: true, text }`. When the patient has no activities for the day, `formatDailyReportText` already handles `rows.length === 0` by emitting the header + "0 entries" line.

### Internal helper

**`src/features/reports/queries.ts`**: add `getDailyReportRowsForAnimal(date, animalId)`. Implementation: same Prisma query as `getDailyReportRows` but with an extra `animalId` filter in the `where` clause. Cached under the existing `today-timeline` tag (5 min revalidate).

### Client component

**`src/features/animals/components/PatientShareButton.tsx`** (new):

```tsx
'use client';
import { copyToClipboard } from '@/lib/clipboard';
import { useToast } from '@/components/ui/Toast';
import { getPatientDailyShareTextAction } from '@/features/reports/actions';
import { Share2 } from 'lucide-react';
import { useTransition } from 'react';

interface Props {
  animalId: string;
  variant?: 'primary' | 'ghost';
}

export function PatientShareButton({ animalId, variant = 'ghost' }: Props) {
  const { showToast } = useToast();
  const [pending, start] = useTransition();
  // …calls getPatientDailyShareTextAction(animalId) → copyToClipboard
}
```

Disabled-while-pending styling. No date picker — defaults to today.

### Surfaces

1. **`src/features/animals/components/AnimalDetailActions.tsx`** — insert `<PatientShareButton animalId={animalId} />` between the "Log activity" button and the "More" icon button. Matches the existing row layout.
2. **`src/features/reports/components/PerAnimalReportView.tsx`** — insert in the "Complete history · N" header row, before the "Open patient page ›" link. Same component, same props.

## Data flow (per-patient share)

```
Click Share
  → PatientShareButton.onClick
  → getPatientDailyShareTextAction(animalId)
      → requireActor()
      → getDailyReportRowsForAnimal(today, animalId)   // cached
      → formatDailyReportText(today, rows)
      → { ok: true, text }
  → copyToClipboard(text, { onSuccess, onFallback })
  → showToast("Patient's day copied — paste in WhatsApp / Slack / etc.")
```

## Caching

- Per-patient share: reuses `today-timeline` tag (existing). Per-animal filter happens after cache hit; no extra DB load.
- `searchAnimalsAction` cache key now includes `(query, take, includePast)` — the new past-patients variant caches separately, so the existing hot-path stays warm.

## Edge cases

- **Patient soft-deleted / not found:** action returns `{ ok: false, error: 'Patient not found' }`. Toast surfaces error.
- **0 activities today:** `formatDailyReportText` returns just the header + "0 entries". The doctor still gets a polite paste rather than an error.
- **DB has 51+ active patients:** list shows first 50 sorted by status asc + admittedAt desc; the hint nudges the user to type a query.
- **AnimalPicker callers other than this page:** none — `AnimalPicker` is only used by `/reports/by-animal`. Renaming the file is safe.
- **Toggle "Show past" with a query active:** refetches with the same query + new `includePast`. Cache keys keep them separate.

## Testing

### Unit
- `src/features/reports/__tests__/getDailyReportRowsForAnimal.test.ts` — given a seed of activities across 2 animals + 2 days, asserts the function returns exactly the rows matching `(date, animalId)`. (Small test, exercises the SQL filter.)

### E2E probes
- **`scripts/qa-patient-share.ts`** — log in, open a patient, click Share, read clipboard, assert: starts with `*🏥 Arham Always Care —`, includes the patient's name wrapped in `*…*`, includes only one animal block.
- **`scripts/qa-by-animal-list.ts`** — log in, navigate to `/reports/by-animal`, assert > 0 rows visible by default, type a search, assert filtering, toggle "Show past", assert row count changes when discharged patients exist (probe SKIPs gracefully if not).

## Verification checklist

1. `pnpm typecheck && pnpm lint && pnpm build` clean.
2. New + existing vitest suites pass under `TZ=UTC`.
3. `qa-patient-share.ts` PASS.
4. `qa-by-animal-list.ts` PASS.
5. Existing share probes (`qa-daily-report-share.ts`, `qa-activity-share.ts`) still PASS — no regression.
6. Manual: open `/reports/by-animal` cold → list visible without typing. Click a row → report renders. Click Share in the report header → toast confirms, paste contains exactly one animal block.
7. Manual: open `/patients/[id]` → Share button between "Log activity" and ⋮ → paste reads "🏥 Arham Always Care — <today>" + one patient block.

## Out of scope

- Date picker for per-patient share — defaults to today. Users wanting another day go to `/reports/today` (filter is global) or `/reports/by-animal` (full case history).
- Web Share API (`navigator.share`) — clipboard text is enough for WhatsApp.
- Server-side pagination of the patient list — `take=50` cap is sufficient until the clinic exceeds a few hundred active patients; revisit then.
- Refactoring ⌘K / QuickAdd to use the new `AnimalPickerList` — they're already fit for their contexts.
- Per-patient share for a specific patient activity from this surface — already covered by the per-activity Share on ActivitySheet / post-save toast.
