# Daily report — Share button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Share button to `/reports/today` that builds a WhatsApp-friendly plain-text summary of the day's activities (grouped by animal, sorted by time) and copies it to the clipboard.

**Architecture:** Pure client-side formatter + `navigator.clipboard.writeText()`. The existing server query is extended to include enough fields to render each row's summary, and the formatting is done by a pure function so it's trivial to unit-test. No new server actions, no new caches.

**Tech Stack:** Next.js 15 (App Router), React client components, Prisma, Vitest (unit), Playwright (e2e probe), Tailwind, `lucide-react` icons.

---

## File structure

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/features/reports/queries.ts` | Extend `ActivityRow` + `listActivitiesOnDate` to include `animalSpecies`, `animalWard`, `summary`, `mediaCount` |
| Create | `src/features/reports/dailyReportText.ts` | Pure `formatDailyReportText(date, rows)` — no DOM, no clipboard |
| Create | `src/features/reports/__tests__/dailyReportText.test.ts` | Vitest spec covering: empty, single-animal, multi-animal, mediaCount, byName-always |
| Modify | `src/features/reports/components/DailyReport.tsx` | Add Share button next to Export CSV, wire clipboard + toast |
| Create | `scripts/qa-daily-report-share.ts` | One-off Playwright probe: click Share → assert clipboard content |

The spec is at `docs/superpowers/specs/2026-05-20-daily-report-share-design.md`. Re-read it before each task.

---

### Task 1: Extend the daily-report query with summary + mediaCount

**Files:**
- Modify: `src/features/reports/queries.ts:146-174`

The current query returns only `{ id, animalId, animalName, type, occurredAt, byName }`. We need `animalSpecies`, `animalWard`, `summary` (computed server-side via `summarizeActivity`), and `mediaCount` (count of READY media on the activity) so the formatter has everything it needs without the client doing per-type case analysis.

- [ ] **Step 1: Update the `ActivityRow` interface**

In `src/features/reports/queries.ts`, replace the existing `ActivityRow`:

```ts
export interface ActivityRow {
  id: string;
  animalId: string;
  animalName: string;
  animalSpecies: string;
  animalWard: string | null;
  type: ActivityType;
  occurredAt: Date;
  byName: string;
  summary: string;
  mediaCount: number;
}
```

- [ ] **Step 2: Update `listActivitiesOnDate` to populate the new fields**

Replace the body of `listActivitiesOnDate` with:

```ts
export async function listActivitiesOnDate(date: Date): Promise<ActivityRow[]> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const rows = await prisma.activity.findMany({
    where: { occurredAt: { gte: start, lt: end }, deletedAt: null },
    orderBy: { occurredAt: 'desc' },
    take: ACTIVITIES_ON_DATE_CAP,
    select: {
      id: true,
      animalId: true,
      type: true,
      occurredAt: true,
      byName: true,
      remarks: true,
      data: true,
      animal: { select: { name: true, species: true, ward: true } },
      // Count only READY assets — PENDING / FAILED would 425/410 through
      // /api/files and shouldn't claim the 📎 indicator in the copy.
      _count: { select: { media: { where: { asset: { status: 'READY' } } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    animalId: r.animalId,
    animalName: r.animal.name,
    animalSpecies: r.animal.species,
    animalWard: r.animal.ward,
    type: r.type,
    occurredAt: r.occurredAt,
    byName: r.byName,
    summary: summarizeActivity({ type: r.type, data: r.data, remarks: r.remarks }),
    mediaCount: r._count.media,
  }));
}
```

Note: `summarizeActivity` is already imported at the top of the file (used by `_listTodayActivitiesRaw`); confirm the import exists, add it if not.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: passes. The only consumer of `ActivityRow` is `DailyReport.tsx`, which will be updated in Task 4 — but the new fields are additive (no field was removed), so existing usage of `r.byName`, `r.animalName` etc. still compiles. TypeScript only fails if the consumer destructures something we removed; we removed nothing.

If typecheck fails on `DailyReport.tsx` referencing a field that doesn't exist on the new shape, leave the consumer alone — that will be addressed in Task 4. The error should not appear because we only added fields.

- [ ] **Step 4: Commit**

```bash
git add src/features/reports/queries.ts
git commit -m "feat(reports): extend ActivityRow with species/ward/summary/mediaCount"
```

---

### Task 2: Write `formatDailyReportText` — TDD

**Files:**
- Create: `src/features/reports/dailyReportText.ts`
- Create: `src/features/reports/__tests__/dailyReportText.test.ts`

Strict TDD: write a failing test, see it fail, write the minimal code, see it pass, add the next test, etc. The function is pure (no clipboard, no DOM, no I/O), so tests are fast and exhaustive.

- [ ] **Step 1: Create the test file with the empty-rows case**

Create `src/features/reports/__tests__/dailyReportText.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatDailyReportText } from '../dailyReportText';
import type { ActivityRow } from '../queries';

function row(over: Partial<ActivityRow>): ActivityRow {
  return {
    id: 't1',
    animalId: 'a1',
    animalName: 'Bruno',
    animalSpecies: 'Dog',
    animalWard: null,
    type: 'TREATMENT',
    occurredAt: new Date('2026-05-20T09:30:00+05:30'),
    byName: 'Dr. Mehta',
    summary: 'Amoxiclav 20mg/kg Oral',
    mediaCount: 0,
    ...over,
  };
}

describe('formatDailyReportText', () => {
  it('returns header + "0 entries" when rows is empty', () => {
    const out = formatDailyReportText('2026-05-20', []);
    expect(out).toBe(
      `🏥 Arham Always Care — Wed, 20 May 2026\n0 entries`,
    );
  });
});
```

- [ ] **Step 2: Run the test, watch it fail**

Run: `pnpm exec vitest run src/features/reports/__tests__/dailyReportText.test.ts`
Expected: FAIL with "Cannot find module '../dailyReportText'".

- [ ] **Step 3: Create the file with the minimal implementation**

Create `src/features/reports/dailyReportText.ts`:

```ts
import type { ActivityType } from '@prisma/client';
import { ACTIVITY_LABELS } from '@/features/activities/schema';
import type { ActivityRow } from './queries';

const SPECIES_EMOJI: Record<string, string> = {
  Dog: '🐶',
  Cat: '🐱',
  Cow: '🐄',
  Bird: '🐦',
  Goat: '🐐',
  Rabbit: '🐰',
};
const DEFAULT_EMOJI = '🐾';

function speciesEmoji(species: string): string {
  return SPECIES_EMOJI[species] ?? DEFAULT_EMOJI;
}

function headerDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD.  Format as "EEE, d MMM yyyy" (en-GB) so it
  // looks the same regardless of viewer locale.
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function clockHHMM(d: Date): string {
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDailyReportText(date: string, rows: ActivityRow[]): string {
  const lines: string[] = [];
  lines.push(`🏥 Arham Always Care — ${headerDate(date)}`);
  lines.push(`${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`);

  if (rows.length === 0) return lines.join('\n');

  // Group by animalId; preserve first-seen order then sort groups by name.
  const groups = new Map<string, { name: string; species: string; ward: string | null; rows: ActivityRow[] }>();
  for (const r of rows) {
    const g = groups.get(r.animalId) ?? {
      name: r.animalName,
      species: r.animalSpecies,
      ward: r.animalWard,
      rows: [],
    };
    g.rows.push(r);
    groups.set(r.animalId, g);
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
  );

  for (const g of sortedGroups) {
    lines.push(''); // blank line before each animal block
    const wardPart = g.ward ? ` · ${g.ward}` : '';
    lines.push(`${speciesEmoji(g.species)} ${g.name} (${g.species}${wardPart})`);
    const sortedRows = g.rows.slice().sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    for (const r of sortedRows) {
      const time = clockHHMM(r.occurredAt);
      const label = ACTIVITY_LABELS[r.type as ActivityType];
      const tag = r.mediaCount > 0 ? '  📎' : '';
      lines.push(`• ${time}  ${label} — ${r.summary}  (${r.byName})${tag}`);
    }
  }

  return lines.join('\n');
}
```

- [ ] **Step 4: Run the test, watch it pass**

Run: `pnpm exec vitest run src/features/reports/__tests__/dailyReportText.test.ts`
Expected: PASS — `1 test passed`.

- [ ] **Step 5: Add the single-animal test**

Append to the `describe` block:

```ts
  it('groups rows under a single animal block sorted by time', () => {
    const rows: ActivityRow[] = [
      row({
        id: 'a',
        occurredAt: new Date('2026-05-20T12:30:00+05:30'),
        type: 'FOOD',
        summary: 'Kibble · Fully',
        byName: 'Nurse Pooja',
      }),
      row({
        id: 'b',
        occurredAt: new Date('2026-05-20T09:15:00+05:30'),
        type: 'ROUND',
        summary: 'Stable',
        byName: 'Dr. Mehta',
      }),
      row({
        id: 'c',
        occurredAt: new Date('2026-05-20T09:30:00+05:30'),
        type: 'TREATMENT',
        summary: 'Amoxiclav 20mg/kg Oral',
        byName: 'Dr. Mehta',
      }),
    ];
    const out = formatDailyReportText('2026-05-20', rows);
    expect(out).toBe(
      [
        '🏥 Arham Always Care — Wed, 20 May 2026',
        '3 entries',
        '',
        '🐶 Bruno (Dog)',
        '• 09:15  Doctor round — Stable  (Dr. Mehta)',
        '• 09:30  Treatment — Amoxiclav 20mg/kg Oral  (Dr. Mehta)',
        '• 12:30  Food & water — Kibble · Fully  (Nurse Pooja)',
      ].join('\n'),
    );
  });
```

- [ ] **Step 6: Run, expect PASS**

Run: `pnpm exec vitest run src/features/reports/__tests__/dailyReportText.test.ts`
Expected: PASS — `2 tests passed`.

- [ ] **Step 7: Add the multi-animal test (alphabetical group sort + ward)**

Append:

```ts
  it('sorts animal groups alphabetically (case-insensitive) and includes ward', () => {
    const rows: ActivityRow[] = [
      row({
        id: 'a',
        animalId: 'milo',
        animalName: 'Milo',
        animalSpecies: 'Cat',
        animalWard: 'ISO-A',
        occurredAt: new Date('2026-05-20T09:00:00+05:30'),
        type: 'ROUND',
        summary: 'Improving',
        byName: 'Dr. Iyer',
      }),
      row({
        id: 'b',
        animalId: 'bruno',
        animalName: 'bruno', // lowercase to test case-insensitive sort
        animalSpecies: 'Dog',
        animalWard: 'Surgery-1',
        occurredAt: new Date('2026-05-20T09:15:00+05:30'),
        type: 'ROUND',
        summary: 'Stable',
        byName: 'Dr. Mehta',
      }),
    ];
    const out = formatDailyReportText('2026-05-20', rows);
    expect(out).toBe(
      [
        '🏥 Arham Always Care — Wed, 20 May 2026',
        '2 entries',
        '',
        '🐶 bruno (Dog · Surgery-1)',
        '• 09:15  Doctor round — Stable  (Dr. Mehta)',
        '',
        '🐱 Milo (Cat · ISO-A)',
        '• 09:00  Doctor round — Improving  (Dr. Iyer)',
      ].join('\n'),
    );
  });
```

- [ ] **Step 8: Run, expect PASS**

Run: `pnpm exec vitest run src/features/reports/__tests__/dailyReportText.test.ts`
Expected: PASS — `3 tests passed`.

- [ ] **Step 9: Add the mediaCount + species-emoji-fallback test**

Append:

```ts
  it('appends 📎 to rows with mediaCount > 0 and falls back to 🐾 for unknown species', () => {
    const rows: ActivityRow[] = [
      row({
        animalSpecies: 'Goldfish', // not in the emoji map
        type: 'BATH',
        summary: 'Medicated bath',
        mediaCount: 2,
      }),
    ];
    const out = formatDailyReportText('2026-05-20', rows);
    expect(out).toContain('🐾 Bruno (Goldfish)');
    expect(out).toMatch(/Medicated bath {2}\(Dr\. Mehta\) {2}📎$/);
  });
```

- [ ] **Step 10: Run, expect PASS**

Run: `pnpm exec vitest run src/features/reports/__tests__/dailyReportText.test.ts`
Expected: PASS — `4 tests passed`.

- [ ] **Step 11: Commit**

```bash
git add src/features/reports/dailyReportText.ts src/features/reports/__tests__/dailyReportText.test.ts
git commit -m "feat(reports): formatDailyReportText pure formatter + tests"
```

---

### Task 3: Wire the Share button into DailyReport.tsx

**Files:**
- Modify: `src/features/reports/components/DailyReport.tsx`

Add a Share button next to Export CSV. On click, build the text via the formatter, write it to clipboard, toast on success or fallback. Disabled gating matches Export CSV.

- [ ] **Step 1: Read the current `DailyReport.tsx` structure**

Open `src/features/reports/components/DailyReport.tsx`. Locate:
- The import block (top of file).
- The `downloadCsv` function (~line 53).
- The Export CSV button (~line 94-102).
- The `Download` lucide import.

- [ ] **Step 2: Add imports**

Add to the existing import block:

```tsx
import { useToast } from '@/components/ui/Toast';
import { formatDailyReportText } from '../dailyReportText';
import { Download, Share2 } from 'lucide-react';
```

Replace the existing `import { Download } from 'lucide-react';` with the combined `Download, Share2` import shown above.

- [ ] **Step 3: Inside the `DailyReport` component body, add the `useToast` hook and `onShare` callback**

Place this immediately after the existing hooks (after `useState`, `useMemo`, etc.) and before `downloadCsv`:

```tsx
const { showToast } = useToast();

const onShare = async () => {
  const text = formatDailyReportText(date, rows);
  try {
    await navigator.clipboard.writeText(text);
    showToast({ message: 'Daily report copied — paste in WhatsApp / Slack / etc.' });
  } catch {
    // Fallback for Safari iframes / non-https origins where the
    // Clipboard API rejects.  Old-school textarea trick.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast({ message: 'Daily report copied (fallback)' });
    } finally {
      document.body.removeChild(ta);
    }
  }
};
```

Note: the share text uses `rows` (the prop containing the **full day's** activities), not `filtered`. This matches the spec's "always full day, ignores filter chips" rule.

- [ ] **Step 4: Insert the Share button immediately before the Export CSV button**

The existing Export CSV button starts with `<button type="button" onClick={downloadCsv}` at ~line 94. Insert this directly above it:

```tsx
<button
  type="button"
  onClick={onShare}
  disabled={rows.length === 0}
  className="flex items-center gap-1.5 self-end rounded-md border border-line bg-paper px-3 py-1.5 font-semibold text-[12.5px] text-text transition hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-50"
>
  <Share2 size={14} />
  Share
</button>
```

The class list mirrors Export CSV verbatim so the two buttons look identical.

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck`
Expected: passes.

Run: `pnpm exec biome check src/features/reports/components/DailyReport.tsx`
Expected: no errors. If `biome` flags any formatting, run `pnpm exec biome check --write src/features/reports/components/DailyReport.tsx` and re-run.

- [ ] **Step 6: Build to make sure the page still compiles**

Run: `pnpm build`
Expected: completes successfully. If it fails on `DailyReport.tsx`, re-read the file and reconcile.

- [ ] **Step 7: Commit**

```bash
git add src/features/reports/components/DailyReport.tsx
git commit -m "feat(reports): Share button on Daily activity report copies WhatsApp-friendly text"
```

---

### Task 4: Playwright probe — click Share, assert clipboard

**Files:**
- Create: `scripts/qa-daily-report-share.ts`

A one-off Playwright script (not a Vitest test) that drives a real browser. Grants clipboard permission to the context, clicks Share, reads `navigator.clipboard.readText()`, and asserts the output matches the expected shape.

- [ ] **Step 1: Confirm the dev server is running**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login`
Expected: `200`. If it returns anything else, ask the user to start the dev server with `pnpm dev`.

- [ ] **Step 2: Create the probe**

Create `scripts/qa-daily-report-share.ts`:

```ts
import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();

  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@arham.care');
  await page.getByLabel('Password').fill('admin1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/', { timeout: 30_000 });

  await page.goto('/reports/today');
  await page.getByRole('heading', { name: /Daily activity report/i }).waitFor({ timeout: 10_000 });

  const shareBtn = page.getByRole('button', { name: /^Share$/ });
  await shareBtn.waitFor({ state: 'visible' });

  // If there are no entries today the button is disabled — log and exit
  // success.  The shape is still correct; nothing to copy.
  if (await shareBtn.isDisabled()) {
    process.stdout.write('No entries today; Share button is disabled as expected.\n');
    await browser.close();
    return;
  }

  await shareBtn.click();
  // Toast should appear
  await page.getByText(/Daily report copied/i).waitFor({ timeout: 5_000 });

  const text = await page.evaluate(() => navigator.clipboard.readText());
  process.stdout.write(`Clipboard contents (${text.length} chars):\n${text}\n`);

  if (!text.startsWith('🏥 Arham Always Care —')) {
    throw new Error('Clipboard text does not start with the expected header');
  }
  if (!/\d+ (entry|entries)$/m.test(text.split('\n')[1] ?? '')) {
    throw new Error('Second line is not the entry-count line');
  }

  process.stdout.write('\nPASS — Share button copies a well-formed report.\n');
  await browser.close();
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
```

- [ ] **Step 3: Run the probe**

Run: `pnpm exec dotenv -e .env.local -- tsx scripts/qa-daily-report-share.ts`
Expected output ends with `PASS — Share button copies a well-formed report.`

If the DB has no activities for today, the script prints "No entries today; Share button is disabled as expected." and exits 0 — also a success. Log one activity via QuickAdd and re-run if you want to see real content.

- [ ] **Step 4: Commit (the probe is kept as a manual verification tool)**

```bash
git add scripts/qa-daily-report-share.ts
git commit -m "test(reports): scripts/qa-daily-report-share Playwright probe"
```

---

### Task 5: Full test sweep + push

- [ ] **Step 1: Run all unit tests**

Run: `pnpm test`
Expected: passes — the new `dailyReportText.test.ts` runs alongside existing tests.

- [ ] **Step 2: Run typecheck + lint one final time**

Run: `pnpm typecheck && pnpm lint`
Expected: both clean.

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 4: Push**

Run: `git push origin main`
Expected: the commits from Tasks 1–4 land on `origin/main` under the (now-corrected) `Kaivan Doshi <kaivandoshi1997@gmail.com>` author.

- [ ] **Step 5: Verify CI on GitHub**

Run: `gh run list --limit 1 --branch main`
Then: `gh run watch <run-id>` (or wait for the notification). Expected: green CI.

---

## Self-review

**Spec coverage:**

| Spec requirement | Covered by |
|---|---|
| Header line + entry count | Task 2, Step 3 (impl) + Step 1 (test) |
| Group by animal, sorted alphabetically | Task 2, Step 7 |
| Per-animal block with species + ward | Task 2, Steps 3 + 7 |
| Per-row time in `HH:MM` 24h | Task 2, Step 3 (`clockHHMM`) |
| `(byName)` always present | Task 2, Step 3 (template) |
| 📎 tag when `mediaCount > 0` | Task 2, Steps 3 + 9 |
| WhatsApp-friendly emojis, deterministic locale | Task 2, Step 3 (`'en-GB'`) |
| Share button next to Export CSV, same disabled gating | Task 3, Step 4 |
| `navigator.clipboard.writeText` + textarea fallback | Task 3, Step 3 |
| Toast on success | Task 3, Step 3 |
| Always full day (ignores filter) | Task 3, Step 3 (uses `rows` not `filtered`) |
| Query returns `summary`, `mediaCount`, species, ward | Task 1 |
| Unit tests (5 scenarios) | Task 2, Steps 1, 5, 7, 9 (4 — combined byName-always with the others since it's the default; the "empty" test covers the no-rows case) |
| Playwright probe | Task 4 |

**Placeholder scan:** No TBDs, no "implement later", no "add error handling" — every step has concrete code.

**Type consistency:** `ActivityRow` interface is defined in Task 1 and consumed identically in Task 2's tests + formatter. `formatDailyReportText` signature is `(date: string, rows: ActivityRow[]) => string` everywhere. `mediaCount: number`, `animalWard: string | null`, `summary: string` — all consistent across tasks.

**Ambiguity:** The unit-test scenario count in the spec listed 5; this plan ships 4 because "byName always present" is exercised by every test case (the assertion is on the full string match), so a dedicated test would be redundant. That's a deliberate consolidation, not a coverage gap.
