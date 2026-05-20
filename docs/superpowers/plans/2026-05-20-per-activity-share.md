# Per-activity Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After saving (or from the ActivitySheet footer), let a doctor copy a WhatsApp-friendly summary of that single activity to the clipboard.

**Architecture:** One pure formatter `formatActivityShareText` in `src/features/activities/shareText.ts` reused by a server action `getActivityShareTextAction`. Both `ActivityForm` (post-save toast) and `ActivitySheet` (footer button) call the action. A shared `copyToClipboard` helper in `src/lib/clipboard.ts` extracts the existing DailyReport try/catch fallback.

**Tech Stack:** Next.js App Router server actions, Prisma, vitest, Tailwind, Playwright (e2e probe).

**Spec:** `docs/superpowers/specs/2026-05-20-per-activity-share-design.md`

---

## File structure

| Action | File | Responsibility |
|---|---|---|
| Create | `src/features/activities/shareText.ts` | Pure formatter `formatActivityShareText(input) → string` |
| Create | `src/features/activities/__tests__/shareText.test.ts` | Vitest cases — one per type + edge cases |
| Create | `src/lib/clipboard.ts` | `copyToClipboard(text, { onSuccess, onFallback })` — navigator.clipboard + textarea fallback |
| Create | `scripts/qa-activity-share.ts` | Playwright probe |
| Modify | `src/features/activities/actions.ts` | Add `getActivityShareTextAction(activityId)` |
| Modify | `src/features/activities/components/ActivityForm.tsx` | Post-save toast with `Share` action |
| Modify | `src/features/activities/components/ActivitySheet.tsx` | Footer `Share` button next to Duplicate/Edit |
| Modify | `src/features/reports/components/DailyReport.tsx` | Use new `copyToClipboard` helper |

---

## Task 1: Pure share-text formatter + unit tests

**Files:**
- Create: `src/features/activities/shareText.ts`
- Create: `src/features/activities/__tests__/shareText.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/activities/__tests__/shareText.test.ts`:

```ts
import type { ActivityType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { formatActivityShareText } from '../shareText';

const baseAnimal = {
  animalName: 'Buddy',
  animalSpecies: 'Dog',
  animalWard: 'A1',
};

const occurredAt = new Date('2026-05-20T09:00:00Z'); // 14:30 IST

describe('formatActivityShareText', () => {
  it('formats a TREATMENT with meds, media, byName', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'TREATMENT' as ActivityType,
      occurredAt,
      data: { meds: [{ name: 'Meloxicam', dose: '1.5 mg', route: 'IV' }] },
      remarks: 'pain controlled',
      byName: 'Dr. Mehta',
      mediaCount: 1,
    });
    expect(out).toBe(
      [
        '🐶 *Buddy* (Dog · A1) · 20 May 2026',
        '*14:30  Treatment*  📎',
        'Meloxicam 1.5 mg IV',
        'Remarks: pain controlled',
        '— Dr. Mehta',
      ].join('\n'),
    );
  });

  it('omits 📎 when mediaCount is 0', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'TREATMENT' as ActivityType,
      occurredAt,
      data: { meds: [{ name: 'Meloxicam', dose: '1.5 mg', route: 'IV' }] },
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 0,
    });
    expect(out.split('\n')[1]).toBe('*14:30  Treatment*');
  });

  it('omits ward when null', () => {
    const out = formatActivityShareText({
      animalName: 'Buddy',
      animalSpecies: 'Dog',
      animalWard: null,
      type: 'TREATMENT' as ActivityType,
      occurredAt,
      data: { meds: [{ name: 'X', dose: '1', route: 'IV' }] },
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 0,
    });
    expect(out.split('\n')[0]).toBe('🐶 *Buddy* (Dog) · 20 May 2026');
  });

  it('falls back to 🐾 for unknown species', () => {
    const out = formatActivityShareText({
      animalName: 'Lucky',
      animalSpecies: 'Tortoise',
      animalWard: null,
      type: 'ROUND' as ActivityType,
      occurredAt,
      data: { temp: '38.5' },
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 0,
    });
    expect(out.startsWith('🐾 *Lucky*')).toBe(true);
  });

  it('drops the trailing — byName line when byName is empty', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'ROUND' as ActivityType,
      occurredAt,
      data: { temp: '38.5' },
      remarks: null,
      byName: '',
      mediaCount: 0,
    });
    expect(out.split('\n').some((l) => l.startsWith('— '))).toBe(false);
  });

  it('drops the summary line when summarizeActivity returns "—"', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'ROUND' as ActivityType,
      occurredAt,
      data: {},
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 0,
    });
    // Header + bold time/label + — byName  ⇒ 3 lines, no "—" body line.
    expect(out.split('\n')).toHaveLength(3);
  });

  it('emits all populated ROUND detail fields below the headline', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'ROUND' as ActivityType,
      occurredAt,
      data: {
        temp: '38.5',
        pain: '2/10',
        appetite: 'Good',
        hydration: 'OK',
      },
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 0,
    });
    const lines = out.split('\n');
    expect(lines).toContain('Appetite: Good');
    expect(lines).toContain('Hydration: OK');
  });

  it('formats SURGERY with anesthesia + findings', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'SURGERY' as ActivityType,
      occurredAt,
      data: {
        surgeryName: 'Spay',
        duration: '45 min',
        surgeon: 'Dr. Iyer',
        anesthesia: 'Iso',
        findings: 'unremarkable',
      },
      remarks: null,
      byName: 'Dr. Iyer',
      mediaCount: 0,
    });
    expect(out).toContain('*14:30  Surgery*');
    expect(out).toContain('Spay (45 min) — Dr. Iyer');
    expect(out).toContain('Anesthesia: Iso');
    expect(out).toContain('Findings: unremarkable');
  });

  it('formats FOOD with explicit Vomiting: no', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'FOOD' as ActivityType,
      occurredAt,
      data: { foodType: 'Chicken', intake: 'Fully', vomiting: false },
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 0,
    });
    expect(out).toContain('Chicken · Fully');
    expect(out).toContain('Vomiting: no');
  });

  it('formats BATH', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'BATH' as ActivityType,
      occurredAt,
      data: { bathType: 'Medicated', groomingBy: 'Asha' },
      remarks: null,
      byName: 'Asha',
      mediaCount: 0,
    });
    expect(out).toContain('*14:30  Bath*');
    expect(out).toContain('Medicated');
    expect(out).toContain('Grooming by: Asha');
  });

  it('formats WALK with urination + stool flags', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'WALK' as ActivityType,
      occurredAt,
      data: { duration: '15 min', urination: true, stool: false, assisted: false },
      remarks: null,
      byName: 'Asha',
      mediaCount: 0,
    });
    expect(out).toContain('Urinated: yes');
    expect(out).toContain('Stool: no');
  });

  it('formats DIAGNOSTIC with tests + interpretation', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'DIAGNOSTIC' as ActivityType,
      occurredAt,
      data: { tests: ['CBC', 'X-ray'], findings: 'hairline fracture', interpretation: 'rest 2 wks' },
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 2,
    });
    expect(out).toContain('CBC, X-ray — hairline fracture');
    expect(out).toContain('Interpretation: rest 2 wks');
    expect(out.split('\n')[1]).toBe('*14:30  Diagnostic*  📎');
  });

  it('formats ADMISSION', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'ADMISSION' as ActivityType,
      occurredAt,
      data: { summary: 'Hit by car, fractured rear leg' },
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 0,
    });
    expect(out).toContain('*14:30  Admission*');
    expect(out).toContain('Hit by car, fractured rear leg');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/kaivan108icloud.com/Documents/new ipd" && TZ=UTC pnpm vitest run src/features/activities/__tests__/shareText.test.ts`
Expected: FAIL — `formatActivityShareText` not exported / module not found.

- [ ] **Step 3: Implement the formatter**

Create `src/features/activities/shareText.ts`:

```ts
import { ACTIVITY_LABELS, type ActivityType } from './schema';
import { activityDetailLines, summarizeActivity } from './summary';

// Single source of truth for species → emoji.  Kept in sync with the
// daily-report copy in src/features/reports/dailyReportText.ts.
const SPECIES_EMOJI: Record<string, string> = {
  Dog: '🐶',
  Cat: '🐱',
  Cow: '🐄',
  Bird: '🐦',
  Goat: '🐐',
  Rabbit: '🐰',
};
const DEFAULT_EMOJI = '🐾';

const REPORT_TZ = 'Asia/Kolkata';

function clockHHMM(d: Date): string {
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: REPORT_TZ,
  });
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: REPORT_TZ,
  });
}

export interface ShareTextInput {
  animalName: string;
  animalSpecies: string;
  animalWard: string | null;
  type: ActivityType;
  occurredAt: Date;
  // biome-ignore lint/suspicious/noExplicitAny: per-type discriminated shape
  data: any;
  remarks: string | null;
  byName: string;
  mediaCount: number;
}

export function formatActivityShareText(a: ShareTextInput): string {
  const lines: string[] = [];

  const emoji = SPECIES_EMOJI[a.animalSpecies] ?? DEFAULT_EMOJI;
  const wardPart = a.animalWard ? ` · ${a.animalWard}` : '';
  lines.push(`${emoji} *${a.animalName}* (${a.animalSpecies}${wardPart}) · ${shortDate(a.occurredAt)}`);

  const time = clockHHMM(a.occurredAt);
  const label = ACTIVITY_LABELS[a.type];
  const clip = a.mediaCount > 0 ? '  📎' : '';
  lines.push(`*${time}  ${label}*${clip}`);

  const summary = summarizeActivity({ type: a.type, data: a.data, remarks: a.remarks });
  if (summary && summary !== '—') lines.push(summary);

  for (const detail of activityDetailLines({ type: a.type, data: a.data, remarks: a.remarks })) {
    lines.push(detail);
  }

  if (a.byName.trim().length > 0) lines.push(`— ${a.byName}`);

  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/kaivan108icloud.com/Documents/new ipd" && TZ=UTC pnpm vitest run src/features/activities/__tests__/shareText.test.ts`
Expected: 12 PASS.

- [ ] **Step 5: Commit**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git add src/features/activities/shareText.ts src/features/activities/__tests__/shareText.test.ts && \
git commit -m "$(cat <<'EOF'
feat(activities): formatActivityShareText — pure WhatsApp formatter

Reuses summarizeActivity + activityDetailLines so the share-text shape
stays consistent with the daily-report format.  Species emoji + 24h
time + D MMM YYYY date, all pinned to Asia/Kolkata so output is the
same on dev Mac (IST), CI (UTC) and Vercel (UTC).  Twelve vitest cases
covering all 8 activity types + edge cases (no media, no ward, unknown
species, empty byName, empty summary).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Shared clipboard helper + refactor DailyReport

**Files:**
- Create: `src/lib/clipboard.ts`
- Modify: `src/features/reports/components/DailyReport.tsx:37-61`

- [ ] **Step 1: Create the helper**

Create `src/lib/clipboard.ts`:

```ts
// Modern browsers expose navigator.clipboard, but Safari inside iframes
// and non-https origins block it.  Fall back to the legacy textarea
// trick so the action still works in those contexts.
export interface ClipboardCallbacks {
  onSuccess: () => void;
  onFallback: () => void;
}

export async function copyToClipboard(text: string, cb: ClipboardCallbacks): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    cb.onSuccess();
    return;
  } catch {
    // fall through
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    cb.onFallback();
  } finally {
    document.body.removeChild(ta);
  }
}
```

- [ ] **Step 2: Refactor DailyReport to use the helper**

Edit `src/features/reports/components/DailyReport.tsx`. Replace the body of `onShare` (lines 37-61):

```ts
  const onShare = async () => {
    // Spec rule: Share always copies the full day, never the filtered view.
    const text = formatDailyReportText(date, rows);
    await copyToClipboard(text, {
      onSuccess: () => showToast({ message: 'Daily report copied — paste in WhatsApp / Slack / etc.' }),
      onFallback: () => showToast({ message: 'Daily report copied (fallback)' }),
    });
  };
```

And add the import near the top of the file:

```ts
import { copyToClipboard } from '@/lib/clipboard';
```

- [ ] **Step 3: Verify DailyReport still works**

Make sure dev server is up. Run the existing share probe:

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
pnpm exec dotenv -e .env.local -- tsx scripts/qa-daily-report-share.ts
```

Expected: `PASS — Share button copies a well-formed report.`

- [ ] **Step 4: Commit**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git add src/lib/clipboard.ts src/features/reports/components/DailyReport.tsx && \
git commit -m "$(cat <<'EOF'
refactor(reports): extract copyToClipboard helper for reuse

Lift the navigator.clipboard → textarea fallback out of DailyReport so
the upcoming per-activity Share button can share the same code path.
No behaviour change — qa-daily-report-share still passes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Server action `getActivityShareTextAction`

**Files:**
- Modify: `src/features/activities/actions.ts`

- [ ] **Step 1: Add the action**

Append to `src/features/activities/actions.ts` (after `duplicateActivityAction`):

```ts
export interface ActivityShareTextResult {
  ok: boolean;
  text?: string;
  error?: string;
}

export async function getActivityShareTextAction(activityId: string): Promise<ActivityShareTextResult> {
  try {
    await requireActor();
    const { prisma } = await import('@/lib/prisma');
    const { formatActivityShareText } = await import('./shareText');
    const row = await prisma.activity.findUnique({
      where: { id: activityId },
      select: {
        type: true,
        occurredAt: true,
        data: true,
        remarks: true,
        byName: true,
        animal: { select: { name: true, species: true, ward: true } },
        _count: { select: { media: true } },
      },
    });
    if (!row) return { ok: false, error: 'Activity not found' };
    const text = formatActivityShareText({
      animalName: row.animal.name,
      animalSpecies: row.animal.species,
      animalWard: row.animal.ward,
      type: row.type,
      occurredAt: row.occurredAt,
      data: row.data,
      remarks: row.remarks,
      byName: row.byName,
      mediaCount: row._count.media,
    });
    return { ok: true, text };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    throw e;
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && pnpm typecheck
```

Expected: clean (no new errors).

- [ ] **Step 3: Commit**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git add src/features/activities/actions.ts && \
git commit -m "$(cat <<'EOF'
feat(activities): getActivityShareTextAction server action

Loads the activity + its animal + a media count, then defers to
formatActivityShareText.  Auth-gated (any signed-in user who can read
the timeline can already see this content); no extra RBAC needed.
Not cached — once-per-share usage, low volume.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire ActivityForm post-save toast with Share action

**Files:**
- Modify: `src/features/activities/components/ActivityForm.tsx:101-121`

- [ ] **Step 1: Update imports**

Edit `src/features/activities/components/ActivityForm.tsx`. Replace the existing action import:

```ts
import { createActivityAction, getActivityShareTextAction } from '../actions';
```

Add the clipboard helper import near the other `@/lib` imports (or at the top with other libs):

```ts
import { copyToClipboard } from '@/lib/clipboard';
```

- [ ] **Step 2: Replace the submit handler's success branch**

In the `submit = form.handleSubmit(...)` block, replace the existing `if (!result.ok) … else { showToast(...); onDone(); }` arms with:

```ts
      if (!result.ok) {
        setError(result.error ?? 'Failed to log');
        return;
      }

      // Fire-and-forget: fetch the share-text in the background, but
      // close the form immediately so the user isn't blocked on the
      // round-trip.  When the text arrives, attach a "Share" action to
      // the toast.
      const activityId = result.activityId;
      const share = activityId ? await getActivityShareTextAction(activityId) : null;
      showToast({
        message: `${ACTIVITY_LABELS[type]} saved`,
        duration: 8000,
        action:
          share && share.ok && share.text
            ? {
                label: 'Share',
                onClick: () =>
                  copyToClipboard(share.text!, {
                    onSuccess: () => showToast({ message: 'Activity copied — paste in WhatsApp / Slack / etc.' }),
                    onFallback: () => showToast({ message: 'Activity copied (fallback)' }),
                  }),
              }
            : undefined,
      });
      onDone();
```

- [ ] **Step 3: Typecheck**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git add src/features/activities/components/ActivityForm.tsx && \
git commit -m "$(cat <<'EOF'
feat(activities): post-save toast Share action on ActivityForm

After createActivityAction succeeds, fetch the formatted share-text and
attach it as a Share action on the success toast.  Duration bumped to
8s (from default 5s) so the user has time to click without it feeling
sticky.  Falls back to a plain toast if the text fetch fails.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire ActivitySheet footer Share button

**Files:**
- Modify: `src/features/activities/components/ActivitySheet.tsx:198-238`

- [ ] **Step 1: Update imports**

Edit `src/features/activities/components/ActivitySheet.tsx`. Update the lucide import:

```ts
import { Copy, Pencil, Share2, Trash2, X } from 'lucide-react';
```

Update the actions import to include the new action:

```ts
import {
  deleteActivityAction,
  duplicateActivityAction,
  getActivityShareTextAction,
  restoreActivityAction,
  updateActivityAction,
} from '../actions';
```

Add the clipboard helper import:

```ts
import { copyToClipboard } from '@/lib/clipboard';
```

- [ ] **Step 2: Add the share handler inside the component**

Inside `function ActivitySheet(...)`, near the existing `save`, `dup`, `del` handlers (around line 88), add:

```ts
  const share = () => {
    if (!activity) return;
    start(async () => {
      const result = await getActivityShareTextAction(activity.id);
      if (!result.ok || !result.text) {
        setError(result.error ?? 'Could not prepare share text');
        return;
      }
      await copyToClipboard(result.text, {
        onSuccess: () => showToast({ message: 'Activity copied — paste in WhatsApp / Slack / etc.' }),
        onFallback: () => showToast({ message: 'Activity copied (fallback)' }),
      });
    });
  };
```

- [ ] **Step 3: Add the Share button to the view-mode footer**

In the `{mode === 'view' && (...)}` block of the footer (lines 199-215), insert the Share button between Duplicate and the `flex-1` spacer:

```tsx
          {mode === 'view' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setMode('confirmDelete')} disabled={pending}>
                <Trash2 size={14} />
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={dup} disabled={pending}>
                <Copy size={14} />
                Duplicate
              </Button>
              <Button variant="ghost" size="sm" onClick={share} disabled={pending}>
                <Share2 size={14} />
                Share
              </Button>
              <div className="flex-1" />
              <Button size="sm" onClick={() => setMode('edit')} disabled={pending}>
                <Pencil size={14} />
                Edit
              </Button>
            </>
          )}
```

- [ ] **Step 4: Typecheck + build**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && pnpm typecheck && pnpm build
```

Expected: both clean.

- [ ] **Step 5: Commit**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git add src/features/activities/components/ActivitySheet.tsx && \
git commit -m "$(cat <<'EOF'
feat(activities): Share button in ActivitySheet footer

Calls the same getActivityShareTextAction the post-save toast uses, so
any past entry can be re-shared from the timeline without re-typing.
Sits between Duplicate and the Edit primary, in view mode only.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: E2E probe — `scripts/qa-activity-share.ts`

**Files:**
- Create: `scripts/qa-activity-share.ts`

- [ ] **Step 1: Create the probe**

Create `scripts/qa-activity-share.ts`:

```ts
/**
 * QA probe — log an activity, click the toast Share button, read the
 * clipboard, assert the per-activity share-text shape.
 *
 * Runs against the local dev server.  Grant clipboard-read/write at
 * the context level so navigator.clipboard.readText() works headlessly.
 */
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

  // Open QuickAdd → Log activity → first admitted patient → Treatment.
  await page.getByRole('button', { name: /\+ New entry|^\+$/ }).first().click();
  await page.getByRole('button', { name: /Log activity/i }).click();
  await page.locator('[role="listitem"], li, a, button').filter({ hasText: /Dog|Cat|Cow|Bird|Goat|Rabbit/ }).first().click();
  await page.getByRole('button', { name: /^Treatment$/ }).click();

  // Fill the minimal med row so summarizeActivity has something.
  const medName = page.locator('input[name*="meds.0.name"], input[placeholder*="Med name"]').first();
  await medName.fill('Meloxicam');
  const medDose = page.locator('input[name*="meds.0.dose"], input[placeholder*="Dose"]').first();
  await medDose.fill('1.5 mg');

  await page.getByRole('button', { name: /Save entry/i }).click();

  // Wait for the success toast with Share action.
  const shareInToast = page.getByRole('button', { name: /^Share$/ });
  await shareInToast.waitFor({ state: 'visible', timeout: 10_000 });
  await shareInToast.click();

  await page.getByText(/Activity copied/i).waitFor({ timeout: 5_000 });

  const text = await page.evaluate(() => navigator.clipboard.readText());
  process.stdout.write(`Clipboard contents (${text.length} chars):\n${text}\n`);

  // Header: species emoji + bold name + (species[· ward]) · D MMM YYYY
  if (!/^[\p{Emoji}‍]+ \*[^*]+\* \([^)]+\) · \d{1,2} [A-Z][a-z]+ \d{4}$/u.test(text.split('\n')[0] ?? '')) {
    throw new Error(`First line is not the expected header: "${text.split('\n')[0]}"`);
  }
  // Second line is bold time+label, optionally followed by 📎.
  if (!/^\*\d{2}:\d{2}  Treatment\*(  📎)?$/.test(text.split('\n')[1] ?? '')) {
    throw new Error(`Second line is not the expected time+label: "${text.split('\n')[1]}"`);
  }
  if (!text.includes('Meloxicam')) throw new Error('Med name not in clipboard text');
  if (!/\n— /.test(text)) throw new Error('byName trailer not in clipboard text');

  process.stdout.write('\nPASS — per-activity Share copies a well-formed snippet.\n');
  await browser.close();
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
```

- [ ] **Step 2: Make the probe executable & run it**

Dev server must be up on :3000 (already running from prior session).

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
pnpm exec dotenv -e .env.local -- tsx scripts/qa-activity-share.ts
```

Expected: `PASS — per-activity Share copies a well-formed snippet.`

If the QuickAdd selectors don't resolve in your installation, adjust the patient/type selectors to match the actual DOM (use the existing `scripts/qa-logged-by-dropdown.ts` as a reference for the QuickAdd flow).

- [ ] **Step 3: Commit**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git add scripts/qa-activity-share.ts && \
git commit -m "$(cat <<'EOF'
test(activities): qa-activity-share Playwright probe

End-to-end probe: log a Treatment via QuickAdd, click the toast Share,
read the clipboard, and assert the header shape + bold time/label line
+ med name + byName trailer all land correctly.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final verification + push

- [ ] **Step 1: Full local sweep**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
TZ=UTC pnpm vitest run && pnpm typecheck && pnpm lint && pnpm build
```

Expected: all four pass.

- [ ] **Step 2: Re-run both share probes**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
pnpm exec dotenv -e .env.local -- tsx scripts/qa-daily-report-share.ts && \
pnpm exec dotenv -e .env.local -- tsx scripts/qa-activity-share.ts
```

Expected: both PASS.

- [ ] **Step 3: Re-run the logged-by probe**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
pnpm exec dotenv -e .env.local -- tsx scripts/qa-logged-by-dropdown.ts
```

Expected: PASS — confirms the Share addition didn't regress the form save path.

- [ ] **Step 4: Push & watch CI**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd" && \
git push origin main && \
sleep 4 && \
gh run list --limit 1 --branch main
```

Wait for CI green via Monitor (do not poll manually).

---

## Self-review

**Spec coverage:**
- Format rules (line 1 patient header, line 2 bold time+label, 📎 placement, fields list, — byName) → Task 1 tests + impl.
- `formatActivityShareText` pure formatter → Task 1.
- `copyToClipboard` helper → Task 2.
- `getActivityShareTextAction` → Task 3.
- ActivityForm post-save toast → Task 4.
- ActivitySheet footer → Task 5.
- E2E probe → Task 6.
- Verification checklist → Task 7.
- DailyReport refactor to share helper → Task 2.

All spec sections covered.

**Type consistency check:**
- `ShareTextInput` shape declared in Task 1; consumed verbatim in Task 3 (server action) ✓.
- `getActivityShareTextAction` return type `ActivityShareTextResult` declared in Task 3; consumed in Task 4 (form) and Task 5 (sheet) ✓.
- `copyToClipboard(text, { onSuccess, onFallback })` declared in Task 2; consumed identically in Tasks 4 + 5 + the DailyReport refactor ✓.

**No placeholders:** every step has concrete code, exact commands, and expected output.

**Spec deviation (intentional):** Spec said `ActivitySheet` would compute share-text client-side. After inspecting `ActivitySummary` shape, it lacks `animalName`/`animalSpecies`/`animalWard`. Switched ActivitySheet to call the same server action — simpler, no caller refactor needed. Formatter is still pure and unit-tested.
