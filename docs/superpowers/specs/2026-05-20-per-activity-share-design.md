# Per-activity Share button — design

**Date:** 2026-05-20
**Status:** Approved (pending user review of this written spec)

## Goal

After a doctor logs (or edits) an activity, give them a one-tap way to copy a WhatsApp-friendly summary of that single activity to the clipboard. Mirrors the existing `/reports/today` Share button, but scoped to one entry instead of the whole day.

## Why

- The daily-report Share dumps the entire day. To share one round or one treatment, doctors today either screenshot or hand-type. Both lose structure.
- They paste into WhatsApp groups for handover, owner updates, and external referrals. WhatsApp markdown (`*bold*`) renders correctly across iOS, Android, and Web.
- The infrastructure exists: `summarizeActivity`, `activityDetailLines`, `SPECIES_EMOJI`, and the clipboard fallback pattern are already shipped for the daily report. This spec wires them into two new surfaces with one shared formatter.

## Architecture

One pure formatter + one tiny clipboard helper, consumed in two places:

1. **`src/features/activities/shareText.ts`** — `formatActivityShareText(input) → string`. Pure. Fully unit-tested. Reuses `summarizeActivity` + `activityDetailLines` + `SPECIES_EMOJI` so output stays consistent with the daily report.
2. **`src/lib/clipboard.ts`** — `copyToClipboard(text, { onSuccess, onFallback }) → Promise<void>`. Extracts the duplicated navigator.clipboard → textarea fallback from `DailyReport.tsx:41-60`.
3. **`ActivityForm.tsx`** — on save success, calls a new server action `getActivityShareTextAction(activityId)` to fetch the formatted text, then shows a toast with a `Share` action button.
4. **`ActivitySheet.tsx`** — adds a `<button>Share</button>` next to Duplicate/Edit in the footer; builds text client-side from props already in scope (no fetch).

## Text format

```
🐶 *Buddy* (Dog · A1) · 20 May 2026
*14:30  Treatment*  📎
Inj. Meloxicam 1.5 mg IV
Route: IV
Remarks: pain controlled
— Dr. Mehta
```

### Format rules

- **Line 1:** `<species emoji> *<animalName>* (<species>[· <ward>]) · <D MMM YYYY>`
  - Species emoji from existing `SPECIES_EMOJI` map; `🐾` fallback.
  - Ward dropped when null/empty (no dangling `· `).
  - Date pinned to Asia/Kolkata (matches daily-report convention). Year included so forwarded messages stay unambiguous.
- **Line 2:** `*HH:MM  <Type label>*[two spaces 📎]`
  - Time HH:MM 24h Asia/Kolkata.
  - Type label from `ACTIVITY_LABELS` ("Treatment", "Doctor round", etc).
  - 📎 appended only when `mediaCount > 0`. Two spaces between label and clip so the bold tag closes cleanly.
- **Lines 3+:** populated detail fields, one per line, no indent prefix.
  - Line 3 = the headline `summarizeActivity` output (e.g. "Inj. Meloxicam 1.5 mg IV"). When summary is `—` (all fields empty), drop the line.
  - Subsequent lines = `activityDetailLines` output (label-value pairs like `Route: IV`).
  - Both functions already skip empty fields; no extra filtering needed.
- **Last line:** `— <byName>` (em-dash + space + name). Dropped when byName is blank.

## Data flow

**Post-save toast (create):**
1. `createActivityAction(input)` returns `{ ok: true, activityId }`.
2. `ActivityForm.submit` calls the new `getActivityShareTextAction(activityId)`.
3. Action loads the row with `prisma.activity.findUnique({ include: { animal, media } })`, then calls `formatActivityShareText(...)`. Returns `{ ok: true, text }`.
4. Form shows `showToast({ message: '<Label> saved', action: { label: 'Share', onClick: () => copyToClipboard(text, ...) }, duration: 8000 })`.
5. Click triggers clipboard write + secondary toast "Activity copied — paste in WhatsApp / Slack / etc."

**ActivitySheet (any time):**
1. Sheet props already include `activity`, `animalName`, `animalSpecies`, `animalWard`, `media[]`.
2. Footer Share button calls `formatActivityShareText(...)` synchronously.
3. `copyToClipboard` + toast as above.
4. Button hidden when `activity.deletedAt !== null` (no sense sharing tombstoned rows).

## Server action — `getActivityShareTextAction`

Lives in `src/features/activities/actions.ts`. Signature:

```ts
export async function getActivityShareTextAction(
  activityId: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }>;
```

- Requires authenticated user (`requireActor`).
- Reads the row + its animal + its media count.
- No RBAC check beyond auth: anyone who can read the activity can share text describing it (no media payloads leaked, no new attack surface — the same info is already visible in the timeline).
- Returns the pre-formatted string. Keeps `formatActivityShareText` free of Prisma coupling.

Cache: not cached. Called once per save, low volume.

## Files

| Action | File |
|---|---|
| Create | `src/features/activities/shareText.ts` |
| Create | `src/features/activities/__tests__/shareText.test.ts` |
| Create | `src/lib/clipboard.ts` |
| Create | `scripts/qa-activity-share.ts` |
| Modify | `src/features/activities/actions.ts` — add `getActivityShareTextAction` |
| Modify | `src/features/activities/components/ActivityForm.tsx` — fetch share text + toast action |
| Modify | `src/features/activities/components/ActivitySheet.tsx` — Share button in footer |
| Modify | `src/features/reports/components/DailyReport.tsx` — switch to `copyToClipboard` helper |

## Edge cases

- **Clipboard API blocked** (Safari iframe / non-https): existing textarea fallback. Toast reads "Activity copied (fallback)".
- **Toast action not clicked within duration:** entry is in the timeline; user can open `ActivitySheet` and use the footer Share button. Toast duration bumped to 8 s (from 5 s default) to give a comfortable window without lingering forever.
- **Empty headline summary:** if `summarizeActivity` returns `—` (rare — ROUND with all fields blank), drop that line instead of printing the dash.
- **byName empty:** drop the `— <byName>` trailer line.
- **Deleted activity:** Share button hidden in `ActivitySheet`.
- **Edit save:** no new toast Share button; the sheet's footer button is already in front of the user.

## Testing

### Unit — `src/features/activities/__tests__/shareText.test.ts`

One case per activity type (TREATMENT, ROUND, DIAGNOSTIC, SURGERY, FOOD, BATH, WALK, ADMISSION) plus edge cases:

- TZ pinned (`process.env.TZ = 'UTC'`) renders `20 May 2026` correctly.
- `mediaCount === 0` omits 📎.
- `mediaCount > 0` appends `  📎` to the bold line.
- Null ward omits `· <ward>`.
- Unknown species falls back to `🐾`.
- Empty detail fields don't appear.
- Empty byName drops the trailer line.

~12 cases.

### E2E — `scripts/qa-activity-share.ts`

1. Log in as admin.
2. Open QuickAdd → Log activity → pick first admitted patient → Treatment.
3. Fill med name + dose + route, save.
4. Wait for toast with "Share" button (8 s).
5. Click Share.
6. Read clipboard.
7. Assert text contains:
   - The patient's name wrapped in `*…*`
   - `· 20 May 2026` (or current Asia/Kolkata date)
   - `*<HH:MM>  Treatment*`
   - The dose substring
   - A trailing `— <byName>` line

## Verification checklist

1. `pnpm typecheck`, `pnpm lint`, `pnpm build` all clean.
2. New vitest cases pass under `TZ=UTC`.
3. `qa-activity-share.ts` passes.
4. Existing `qa-daily-report-share.ts` still passes (no regression from the `copyToClipboard` extraction).
5. Manual: log a TREATMENT with one image attached → toast Share copies text containing `📎`.
6. Manual: open existing ROUND from timeline → ActivitySheet footer Share copies same shape (no day header, no media flag if none).
7. Manual: Safari iOS — paste lands as bold WhatsApp markdown.

## Out of scope

- Web Share API (`navigator.share`) — copy-to-clipboard solves the WhatsApp paste case without adding a mobile-only branch.
- Sharing media payloads (Drive thumbnails / files) — text only.
- A "Share patient timeline" affordance — daily report covers the per-day case; per-patient timeline is a separate need.
- Localised date / time formatting — fixed to Asia/Kolkata + English to match the daily report.
- Optimistic share-text generation in the toast (without the server roundtrip) — too much duplication for a once-per-save call.
