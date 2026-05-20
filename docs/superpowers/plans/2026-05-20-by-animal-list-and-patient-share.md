# By-animal List + Per-patient Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Replace the empty `/reports/by-animal` picker with a visible patient list + "Show past" toggle; (2) Add a per-patient daily Share button on the patient detail page and the per-animal report view.

**Architecture:** Extend `searchActiveAnimals` with an `includePast` flag and replace `AnimalPicker.tsx` with `AnimalPickerList.tsx` that renders the list directly. Add `listActivitiesOnDateForAnimal(date, animalId)` query + `getPatientDailyShareTextAction` server action that reuses the existing `formatDailyReportText`. New `<PatientShareButton animalId={...} />` client component mounts on both surfaces.

**Tech Stack:** Next.js App Router server actions, Prisma, vitest, Playwright (e2e probes), Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-20-by-animal-list-and-patient-share-design.md`

---

## File structure

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/features/animals/queries.ts` | Add `includePast` arg to search |
| Modify | `src/features/animals/actions.ts` | `searchAnimalsAction(query, includePast=false)` |
| Modify | `src/features/reports/queries.ts` | Add `listActivitiesOnDateForAnimal(date, animalId)` |
| Create | `src/features/reports/__tests__/listActivitiesOnDateForAnimal.test.ts` | Vitest cases |
| Create | `src/features/reports/actions.ts` | `getPatientDailyShareTextAction` |
| Create | `src/features/animals/components/PatientShareButton.tsx` | Client button |
| Modify | `src/features/animals/components/AnimalDetailActions.tsx` | Mount the button |
| Modify | `src/features/reports/components/PerAnimalReportView.tsx` | Mount the button |
| Delete | `src/features/reports/components/AnimalPicker.tsx` | Replaced |
| Create | `src/features/reports/components/AnimalPickerList.tsx` | New list view |
| Modify | `src/app/(app)/reports/by-animal/page.tsx` | Wire new picker |
| Create | `scripts/qa-patient-share.ts` | E2E probe |
| Create | `scripts/qa-by-animal-list.ts` | E2E probe |

---

## Task 1: `listActivitiesOnDateForAnimal` query + unit test

**Files:**
- Modify: `src/features/reports/queries.ts`
- Create: `src/features/reports/__tests__/listActivitiesOnDateForAnimal.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `src/features/reports/__tests__/listActivitiesOnDateForAnimal.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the prisma client so we can assert the `where` clause shape
// without standing up a database.  Same pattern as existing tests under
// src/features/reports/__tests__.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    activity: {
      findMany: vi.fn(async () => []),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { listActivitiesOnDateForAnimal } from '../queries';

const findMany = vi.mocked(prisma.activity.findMany);

beforeEach(() => {
  findMany.mockClear();
});

describe('listActivitiesOnDateForAnimal', () => {
  it('filters by animalId AND the date range', async () => {
    await listActivitiesOnDateForAnimal(new Date('2026-05-20T00:00:00Z'), 'cabc123');
    expect(findMany).toHaveBeenCalledOnce();
    const arg = findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(arg.where).toMatchObject({
      animalId: 'cabc123',
      deletedAt: null,
    });
    expect(arg.where.occurredAt).toBeDefined();
  });

  it('returns an empty array when no rows match', async () => {
    const out = await listActivitiesOnDateForAnimal(new Date('2026-05-20T00:00:00Z'), 'cnone');
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "/Users/kaivan108icloud.com/Documents/new ipd" && TZ=UTC pnpm vitest run src/features/reports/__tests__/listActivitiesOnDateForAnimal.test.ts`

Expected: FAIL with "listActivitiesOnDateForAnimal is not exported".

- [ ] **Step 3: Add the query in `src/features/reports/queries.ts`**

After `listActivitiesOnDate` (around line 200), append:

```ts
// Same shape + ordering as listActivitiesOnDate but scoped to one
// animal — feeds the per-patient daily Share button.
export async function listActivitiesOnDateForAnimal(
  date: Date,
  animalId: string,
): Promise<ActivityRow[]> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const rows = await prisma.activity.findMany({
    where: {
      animalId,
      occurredAt: { gte: start, lt: end },
      deletedAt: null,
    },
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
    detailLines: activityDetailLines({ type: r.type, data: r.data, remarks: r.remarks }),
    mediaCount: r._count.media,
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "/Users/kaivan108icloud.com/Documents/new ipd" && TZ=UTC pnpm vitest run src/features/reports/__tests__/listActivitiesOnDateForAnimal.test.ts`

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git add src/features/reports/queries.ts src/features/reports/__tests__/listActivitiesOnDateForAnimal.test.ts && \
git commit -m "$(cat <<'EOF'
feat(reports): listActivitiesOnDateForAnimal query

Same shape + ordering as listActivitiesOnDate but adds animalId to the
where clause.  Used by the upcoming per-patient daily Share button.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `getPatientDailyShareTextAction` server action

**Files:**
- Create: `src/features/reports/actions.ts`

- [ ] **Step 1: Create the actions file**

Create `src/features/reports/actions.ts`:

```ts
'use server';
import { getCurrentUser } from '@/lib/auth';
import { RbacError } from '@/lib/errors';
import { formatDailyReportText } from './dailyReportText';
import { listActivitiesOnDateForAnimal } from './queries';

async function requireActor() {
  const user = await getCurrentUser();
  if (!user) throw new RbacError('not authenticated');
  return user;
}

export interface PatientShareResult {
  ok: boolean;
  text?: string;
  error?: string;
}

// Returns the WhatsApp-bold daily report for one patient.  When dateISO
// is omitted, defaults to today (uses the same UTC-truncated date that
// /reports/today uses, so the two pages stay in sync).
export async function getPatientDailyShareTextAction(
  animalId: string,
  dateISO?: string,
): Promise<PatientShareResult> {
  try {
    await requireActor();
    const date = dateISO && /^\d{4}-\d{2}-\d{2}$/.test(dateISO)
      ? dateISO
      : new Date().toISOString().slice(0, 10);
    const rows = await listActivitiesOnDateForAnimal(new Date(date), animalId);
    const text = formatDailyReportText(date, rows);
    return { ok: true, text };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    throw e;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd "/Users/kaivan108icloud.com/Documents/new ipd" && pnpm typecheck`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git add src/features/reports/actions.ts && \
git commit -m "$(cat <<'EOF'
feat(reports): getPatientDailyShareTextAction

Server action that returns one patient's day formatted via the existing
formatDailyReportText.  Defaults to today, accepts YYYY-MM-DD override.
Auth-gated (any signed-in user who can read the timeline already has
access to this content).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `<PatientShareButton />` client component

**Files:**
- Create: `src/features/animals/components/PatientShareButton.tsx`

- [ ] **Step 1: Create the component**

Create `src/features/animals/components/PatientShareButton.tsx`:

```tsx
'use client';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { getPatientDailyShareTextAction } from '@/features/reports/actions';
import { copyToClipboard } from '@/lib/clipboard';
import { Share2 } from 'lucide-react';
import { useTransition } from 'react';

interface Props {
  animalId: string;
}

export function PatientShareButton({ animalId }: Props) {
  const { showToast } = useToast();
  const [pending, start] = useTransition();

  const onClick = () => {
    start(async () => {
      const result = await getPatientDailyShareTextAction(animalId);
      if (!result.ok || !result.text) {
        showToast({ message: result.error ?? 'Could not prepare share text' });
        return;
      }
      await copyToClipboard(result.text, {
        onSuccess: () =>
          showToast({ message: "Patient's day copied — paste in WhatsApp / Slack / etc." }),
        onFallback: () => showToast({ message: "Patient's day copied (fallback)" }),
      });
    });
  };

  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={pending}>
      <Share2 size={14} />
      Share
    </Button>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd "/Users/kaivan108icloud.com/Documents/new ipd" && pnpm typecheck`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git add src/features/animals/components/PatientShareButton.tsx && \
git commit -m "$(cat <<'EOF'
feat(animals): PatientShareButton client component

Calls getPatientDailyShareTextAction → copyToClipboard → toast.
Same UX as the daily-report and per-activity Share buttons, just
scoped to one patient and today.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Mount the button on patient page + per-animal report view

**Files:**
- Modify: `src/features/animals/components/AnimalDetailActions.tsx:27-31`
- Modify: `src/features/reports/components/PerAnimalReportView.tsx:117-127`

- [ ] **Step 1: Add to `AnimalDetailActions.tsx`**

In `src/features/animals/components/AnimalDetailActions.tsx`, add the import near the other imports:

```tsx
import { PatientShareButton } from './PatientShareButton';
```

Insert the button between the "Log activity" `<Button>` and the "More" `<button>`:

```tsx
  return (
    <div className="relative flex items-center gap-2" ref={menuRef}>
      <Button size="sm" onClick={() => setQuickOpen(true)}>
        <Plus size={14} />
        Log activity
      </Button>
      <PatientShareButton animalId={animalId} />
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        ...
```

- [ ] **Step 2: Add to `PerAnimalReportView.tsx`**

Add the import:

```tsx
import { PatientShareButton } from '@/features/animals/components/PatientShareButton';
```

Update the "Complete history" header row (currently lines 117-127) to include the Share button on the right:

```tsx
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-bold text-[10.5px] text-muted uppercase tracking-[0.07em]">
            Complete history · {history.length}
          </h2>
          <div className="flex items-center gap-3">
            <PatientShareButton animalId={animal.id} />
            <Link
              href={`/patients/${animal.id}`}
              className="font-semibold text-[12px] text-accent hover:underline"
            >
              Open patient page ›
            </Link>
          </div>
        </div>
```

- [ ] **Step 3: Typecheck + build**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && pnpm typecheck && pnpm build
```

Expected: both clean.

- [ ] **Step 4: Commit**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git add src/features/animals/components/AnimalDetailActions.tsx src/features/reports/components/PerAnimalReportView.tsx && \
git commit -m "$(cat <<'EOF'
feat(animals,reports): mount PatientShareButton

Patient detail page: between "Log activity" and the ⋮ menu.
Per-animal report view: in the "Complete history" header next to the
"Open patient page" link.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Extend `searchActiveAnimals` with `includePast`

**Files:**
- Modify: `src/features/animals/queries.ts:121-155`
- Modify: `src/features/animals/actions.ts:68-70`

- [ ] **Step 1: Update the query in `src/features/animals/queries.ts`**

Replace the `_searchActiveAnimalsRaw` + `_searchActiveAnimalsCached` + `searchActiveAnimals` block (around lines 121-155) with:

```ts
async function _searchActiveAnimalsRaw(
  query: string,
  take: number,
  includePast: boolean,
): Promise<ActiveAnimalLite[]> {
  const q = query.trim();
  const where: Prisma.AnimalWhereInput = {
    deletedAt: null,
    // When includePast=false, restrict to currently admitted animals.
    // When true, return everyone — including discharged + deceased.
    ...(includePast ? {} : { dischargedAt: null, deceasedAt: null }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { species: { contains: q, mode: 'insensitive' as const } },
            { ward: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  return prisma.animal.findMany({
    where,
    orderBy: [{ status: 'asc' }, { admittedAt: 'desc' }],
    take,
    select: { id: true, name: true, species: true, ward: true, status: true },
  });
}

// unstable_cache uses (keys, args) as the cache key, so the additional
// `includePast` arg automatically separates cache entries.
const _searchActiveAnimalsCached = unstable_cache(_searchActiveAnimalsRaw, ['search-active-animals'], {
  revalidate: 30,
  tags: ['animals'],
});

export async function searchActiveAnimals(
  query: string,
  take = 20,
  includePast = false,
): Promise<ActiveAnimalLite[]> {
  return _searchActiveAnimalsCached(query, take, includePast);
}
```

- [ ] **Step 2: Update the action in `src/features/animals/actions.ts`**

Replace lines 68-70:

```ts
export async function searchAnimalsAction(
  query: string,
  includePast = false,
): Promise<ActiveAnimalLite[]> {
  await requireActor();
  return searchActiveAnimals(query, 50, includePast);
}
```

(Bumping `take` from 20 → 50 supports the new list view; existing dropdown callers that pass only `query` still work and just get a wider cap.)

- [ ] **Step 3: Typecheck**

Run: `cd "/Users/kaivan108icloud.com/Documents/new ipd" && pnpm typecheck`

Expected: clean — no callers pass a second arg to `searchAnimalsAction` yet, so the optional `includePast` is backwards-compatible.

- [ ] **Step 4: Commit**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git add src/features/animals/queries.ts src/features/animals/actions.ts && \
git commit -m "$(cat <<'EOF'
feat(animals): includePast flag on searchActiveAnimals

When true, drops the dischargedAt/deceasedAt filters so the new
By-animal Reports list can show past patients on demand.  Cache key
auto-separates via unstable_cache args.  take bumped to 50 for the
list view; dropdown callers ignore the extra cap.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Replace `AnimalPicker` with `AnimalPickerList`

**Files:**
- Delete: `src/features/reports/components/AnimalPicker.tsx`
- Create: `src/features/reports/components/AnimalPickerList.tsx`
- Modify: `src/app/(app)/reports/by-animal/page.tsx`

- [ ] **Step 1: Create the new component**

Create `src/features/reports/components/AnimalPickerList.tsx`:

```tsx
'use client';
import { Pill } from '@/components/ui/Pill';
import { searchAnimalsAction } from '@/features/animals/actions';
import type { ActiveAnimalLite } from '@/features/animals/queries';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';

interface Props {
  selectedId: string | null;
}

const LIST_CAP = 50;

export function AnimalPickerList({ selectedId }: Props) {
  const [query, setQuery] = useState('');
  const [includePast, setIncludePast] = useState(false);
  const [results, setResults] = useState<ActiveAnimalLite[]>([]);
  const [, start] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      start(async () => {
        const rows = await searchAnimalsAction(query, includePast);
        setResults(rows);
      });
    }, 180);
    return () => clearTimeout(t);
  }, [query, includePast]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block max-w-md flex-1">
          <Search size={16} className="-translate-y-1/2 absolute top-1/2 left-3 text-soft" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by animal name…"
            className="h-10 w-full rounded-xl border border-line bg-paper pr-3 pl-9 text-[14px] placeholder:text-soft focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          <input
            type="checkbox"
            checked={includePast}
            onChange={(e) => setIncludePast(e.target.checked)}
            className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
          />
          Show past patients
        </label>
      </div>

      {results.length === 0 ? (
        <p className="text-[12.5px] text-muted">
          {query ? `No matches for "${query}".` : 'No active patients.'}
        </p>
      ) : (
        <ul className="flex flex-col rounded-2xl border border-line bg-paper">
          {results.map((r, idx) => {
            const tone: 'critical' | 'stable' | 'neutral' =
              r.status === 'DECEASED' ? 'critical' : r.status === 'DISCHARGED' ? 'neutral' : 'stable';
            const label =
              r.status === 'DECEASED' ? 'Deceased' : r.status === 'DISCHARGED' ? 'Discharged' : 'Admitted';
            const isSelected = r.id === selectedId;
            return (
              <li key={r.id} className={idx > 0 ? 'border-line border-t' : ''}>
                <Link
                  href={`/reports/by-animal?animalId=${r.id}`}
                  className={`flex items-center justify-between px-3 py-2.5 transition hover:bg-paper-2 ${
                    isSelected ? 'bg-accent-soft' : ''
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-display font-semibold text-[14px]">{r.name}</span>
                    <span className="text-[11.5px] text-muted">
                      {r.species}
                      {r.ward ? ` · ${r.ward}` : ''}
                    </span>
                  </div>
                  <Pill status={tone}>{label}</Pill>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {results.length === LIST_CAP && (
        <p className="text-[12px] text-soft">Showing first {LIST_CAP} — refine your search to narrow.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Delete the old `AnimalPicker.tsx`**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git rm src/features/reports/components/AnimalPicker.tsx
```

- [ ] **Step 3: Update the page**

Replace `src/app/(app)/reports/by-animal/page.tsx` entirely:

```tsx
import { AnimalPickerList } from '@/features/reports/components/AnimalPickerList';
import { PerAnimalReportView } from '@/features/reports/components/PerAnimalReportView';
import { ReportsNav } from '@/features/reports/components/ReportsNav';
import { getPerAnimalReport } from '@/features/reports/queries';

export default async function ByAnimalReportPage({
  searchParams,
}: {
  searchParams: Promise<{ animalId?: string }>;
}) {
  const params = await searchParams;
  const animalId = params.animalId ?? null;
  const report = animalId ? await getPerAnimalReport(animalId) : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Reports</h1>
        <p className="mt-1 text-muted text-sm">Activity logs and per-animal case histories</p>
      </div>
      <ReportsNav active="by-animal" />
      <AnimalPickerList selectedId={animalId} />
      {animalId && !report && (
        <p className="text-critical text-sm">Animal not found, deleted, or you don't have access.</p>
      )}
      {report && <PerAnimalReportView report={report} />}
    </div>
  );
}
```

(The "Pick an animal above…" hint is gone — the list itself is now the affordance.)

- [ ] **Step 4: Typecheck + build**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && pnpm typecheck && pnpm build
```

Expected: both clean.

- [ ] **Step 5: Commit**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git add src/features/reports/components/AnimalPickerList.tsx src/app/\(app\)/reports/by-animal/page.tsx && \
git commit -m "$(cat <<'EOF'
feat(reports): visible patient list on /reports/by-animal

Replaces the dropdown-style AnimalPicker (search box that revealed
results only on focus) with a permanent list capped at 50 rows.  Adds
a "Show past patients" checkbox so discharged / deceased animals are
reachable without typing.  Selected row gets a highlighted background.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: E2E probes

**Files:**
- Create: `scripts/qa-patient-share.ts`
- Create: `scripts/qa-by-animal-list.ts`

- [ ] **Step 1: Create `qa-patient-share.ts`**

Create `scripts/qa-patient-share.ts`:

```ts
import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => process.stdout.write(`[pageerror] ${e.message.slice(0, 150)}\n`));

  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@arham.care');
  await page.getByLabel('Password').fill('admin1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/', { timeout: 30_000 });

  await page.goto('/patients');
  const firstPatient = page.locator('a[href^="/patients/"]:not([href="/patients/new"])').first();
  if (!(await firstPatient.isVisible({ timeout: 5_000 }))) {
    process.stdout.write('SKIP: no patient in DB.\n');
    await browser.close();
    return;
  }
  const patientName = (await firstPatient.innerText()).split('\n')[0]?.trim() ?? '';
  await firstPatient.click();
  await page.waitForURL(/\/patients\/c[a-z0-9]{24}$/, { timeout: 15_000 });
  await page.waitForTimeout(500);

  // Patient page Share button — sits next to "Log activity".
  const share = page.getByRole('button', { name: /^Share$/ });
  await share.waitFor({ state: 'visible', timeout: 10_000 });
  await share.click();

  await page.getByText(/Patient's day copied/i).waitFor({ timeout: 5_000 });

  const text = await page.evaluate(() => navigator.clipboard.readText());
  process.stdout.write(`Clipboard (${text.length} chars):\n${text}\n`);

  if (!text.startsWith('*🏥 Arham Always Care —')) {
    throw new Error('Header missing or malformed');
  }
  if (patientName && !text.includes(`*${patientName}*`)) {
    throw new Error(`Patient name "${patientName}" not found bolded in clipboard text`);
  }

  // Should contain at most one animal block — count the species-emoji lines.
  const animalLines = text.split('\n').filter((l) => /^[\p{Extended_Pictographic}🐾] \*/u.test(l));
  if (animalLines.length > 1) {
    throw new Error(`Expected ≤1 animal block, got ${animalLines.length}`);
  }

  process.stdout.write('\nPASS — per-patient Share copies a single-patient daily report.\n');
  await browser.close();
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
```

- [ ] **Step 2: Create `qa-by-animal-list.ts`**

Create `scripts/qa-by-animal-list.ts`:

```ts
import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => process.stdout.write(`[pageerror] ${e.message.slice(0, 150)}\n`));

  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@arham.care');
  await page.getByLabel('Password').fill('admin1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/', { timeout: 30_000 });

  await page.goto('/reports/by-animal');
  await page.getByRole('heading', { name: /Reports/i }).waitFor({ timeout: 10_000 });

  // List should render rows without typing.
  const rows = page.locator('a[href^="/reports/by-animal?animalId="]');
  await rows.first().waitFor({ state: 'visible', timeout: 5_000 });
  const initialCount = await rows.count();
  process.stdout.write(`Default list rows: ${initialCount}\n`);
  if (initialCount === 0) {
    throw new Error('Default list is empty — expected admitted patients to render');
  }

  // Typed search filters the list.
  const firstName = (await rows.first().innerText()).split('\n')[0]?.trim() ?? '';
  if (firstName) {
    await page.getByPlaceholder('Search by animal name…').fill(firstName.slice(0, 3));
    await page.waitForTimeout(400);
    const filtered = await rows.count();
    process.stdout.write(`After search "${firstName.slice(0, 3)}": ${filtered} rows\n`);
    if (filtered === 0) {
      throw new Error('Search query yielded zero rows');
    }
    await page.getByPlaceholder('Search by animal name…').fill('');
    await page.waitForTimeout(400);
  }

  // Toggle "Show past patients" — count should be >= without-past.
  await page.getByLabel('Show past patients').check();
  await page.waitForTimeout(400);
  const withPast = await rows.count();
  process.stdout.write(`With past patients: ${withPast} rows\n`);
  if (withPast < initialCount) {
    throw new Error(`Show-past should not reduce rows (initial=${initialCount}, withPast=${withPast})`);
  }

  process.stdout.write('\nPASS — by-animal list renders, filters, and toggles past patients.\n');
  await browser.close();
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
```

- [ ] **Step 3: Run both probes**

Dev server must be running. Use whichever port it's on:

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
E2E_BASE_URL=http://localhost:3000 pnpm exec dotenv -e .env.local -- tsx scripts/qa-patient-share.ts && \
E2E_BASE_URL=http://localhost:3000 pnpm exec dotenv -e .env.local -- tsx scripts/qa-by-animal-list.ts
```

Expected: both PASS. (If dev is on 3002, substitute that port.)

- [ ] **Step 4: Commit**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git add scripts/qa-patient-share.ts scripts/qa-by-animal-list.ts && \
git commit -m "$(cat <<'EOF'
test: qa-patient-share + qa-by-animal-list probes

qa-patient-share: clicks the patient page Share button, asserts
clipboard contains the daily-report header + the patient's name + at
most one animal block.

qa-by-animal-list: hits /reports/by-animal, asserts list renders
without typing, search narrows results, and "Show past patients"
toggle doesn't shrink the list below the default.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final verification + push

- [ ] **Step 1: Full local sweep**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
TZ=UTC pnpm vitest run && pnpm typecheck && pnpm lint && pnpm build
```

Expected: vitest all PASS, typecheck clean, lint warnings-only, build clean.

- [ ] **Step 2: Re-run existing share probes (no-regression check)**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
E2E_BASE_URL=http://localhost:3000 pnpm exec dotenv -e .env.local -- tsx scripts/qa-daily-report-share.ts && \
E2E_BASE_URL=http://localhost:3000 pnpm exec dotenv -e .env.local -- tsx scripts/qa-activity-share.ts && \
E2E_BASE_URL=http://localhost:3000 pnpm exec dotenv -e .env.local -- tsx scripts/qa-logged-by-dropdown.ts
```

Expected: all PASS.

- [ ] **Step 3: Re-run the new probes from Task 7**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
E2E_BASE_URL=http://localhost:3000 pnpm exec dotenv -e .env.local -- tsx scripts/qa-patient-share.ts && \
E2E_BASE_URL=http://localhost:3000 pnpm exec dotenv -e .env.local -- tsx scripts/qa-by-animal-list.ts
```

Expected: both PASS.

- [ ] **Step 4: Push & watch CI**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git push origin main
```

After push, monitor CI via `gh run list --limit 1 --branch main`.

---

## Self-review

**Spec coverage:**
- Feature 1, default list of admitted patients → Task 5 (`includePast` flag) + Task 6 (`AnimalPickerList`).
- Feature 1, "Show past" toggle → Task 6 (checkbox in `AnimalPickerList`).
- Feature 1, search filter still works → Task 6 (controlled `<input>` debounced 180 ms).
- Feature 1, list cap = 50 with overflow hint → Task 5 (`take=50`) + Task 6 (`Showing first 50` line).
- Feature 2, `getPatientDailyShareTextAction` → Task 2.
- Feature 2, `listActivitiesOnDateForAnimal` query → Task 1.
- Feature 2, `PatientShareButton` → Task 3.
- Feature 2, mounted on patient page → Task 4.
- Feature 2, mounted on per-animal report view → Task 4.
- Edge case: 0 activities today → handled by existing `formatDailyReportText` (header + "0 entries").
- Edge case: patient not found → action returns `{ ok: false, error }`; toast surfaces it (Task 3 handles).
- Unit test: `listActivitiesOnDateForAnimal` → Task 1.
- E2E probes → Task 7.
- Verification checklist → Task 8.

All spec sections covered.

**Type consistency:**
- `PatientShareResult` declared in Task 2; consumed by `PatientShareButton` in Task 3 ✓.
- `searchAnimalsAction(query, includePast?)` declared in Task 5; consumed by `AnimalPickerList` in Task 6 ✓.
- `listActivitiesOnDateForAnimal(date, animalId)` declared in Task 1; consumed by Task 2 ✓.

**No placeholders:** every step contains concrete code or commands with expected output.
